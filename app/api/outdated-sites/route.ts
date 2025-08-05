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
    "https://www.yell.com/ucs/UcsSearchAction.do?keywords=website&location=United+Kingdom"
  );

  const results = await page.evaluate(() => {
    const businesses: {
      name: string;
      url: string;
      phone: string | null;
    }[] = [];

    document.querySelectorAll(".businessCapsule--mainContent").forEach((el) => {
      const name = el.querySelector("h2 a")?.textContent?.trim() || "Unknown";
      const url =
        el.querySelector(".businessCapsule--ctas a")?.getAttribute("href") ||
        "";
      const phone =
        el.querySelector(".business--telephone")?.textContent?.trim() || null;
      businesses.push({ name, url, phone });
    });
    return businesses.slice(0, 5); // Limit for speed
  });

  // Fetch PageSpeed scores in parallel
  const enrichedResults = await Promise.all(
    results.map(async (biz) => {
      const score = biz.url ? await getPageSpeedScore(biz.url) : null;
      return { ...biz, performanceScore: score ?? "N/A" };
    })
  );

  await browser.close();
  return NextResponse.json(enrichedResults);
}
