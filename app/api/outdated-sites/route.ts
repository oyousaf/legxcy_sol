import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.NEXT_PUBLIC_PAGESPEED_API_KEY!;

async function getPageSpeedScore(url: string) {
  try {
    const res = await fetch(
      `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`
    );
    const data = await res.json();
    const score = data.lighthouseResult?.categories?.performance?.score;
    return score !== undefined ? Math.round(score * 100) : null;
  } catch (err) {
    console.error("PageSpeed fetch failed for", url, err);
    return null;
  }
}

export async function GET() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(
    "https://www.yell.com/ucs/UcsSearchAction.do?keywords=website&location=United+Kingdom",
    { waitUntil: "domcontentloaded" }
  );

  // Grab initial business data
  const businesses = await page.evaluate(() => {
    const data: {
      name: string;
      url: string;
      phone: string | null;
      profileLink: string | null;
    }[] = [];

    document.querySelectorAll(".businessCapsule--mainContent").forEach((el) => {
      const name = el.querySelector("h2 a")?.textContent?.trim() || "Unknown";
      const url =
        el.querySelector(".businessCapsule--ctas a")?.getAttribute("href") ||
        "";
      const phone =
        el.querySelector(".business--telephone")?.textContent?.trim() || null;
      const profileLink =
        (el.querySelector("h2 a") as HTMLAnchorElement)?.href || null;
      data.push({ name, url, phone, profileLink });
    });

    return data.slice(0, 5); // limit to 5 for speed
  });

  // Visit each profile to extract email + performance score
  const enrichedResults = await Promise.all(
    businesses.map(async (biz) => {
      let email: string | null = null;

      if (biz.profileLink) {
        try {
          const profilePage = await browser.newPage();
          await profilePage.goto(biz.profileLink, {
            waitUntil: "domcontentloaded",
          });

          email = await profilePage.evaluate(() => {
            const emailNode = document.querySelector("a[href^='mailto:']");
            return emailNode ? emailNode.textContent?.trim() || null : null;
          });

          await profilePage.close();
        } catch (err) {
          console.warn(`Could not fetch email for ${biz.name}`, err);
        }
      }

      const performanceScore = biz.url
        ? await getPageSpeedScore(biz.url)
        : null;

      return {
        name: biz.name,
        url: biz.url,
        phone: biz.phone,
        email,
        performanceScore: performanceScore ?? "N/A",
      };
    })
  );

  await browser.close();
  return NextResponse.json(enrichedResults);
}
