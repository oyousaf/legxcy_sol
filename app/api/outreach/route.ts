import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.NEXT_PUBLIC_PAGESPEED_API_KEY!;

// Change this path if Chrome is installed somewhere else
const LOCAL_CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function getPageSpeedScore(url: string) {
  try {
    const res = await fetch(
      `${PAGESPEED_API}?url=${encodeURIComponent(
        url
      )}&strategy=mobile&key=${API_KEY}`
    );
    if (!res.ok) throw new Error(`PageSpeed API error ${res.status}`);
    const data = await res.json();
    const score = data.lighthouseResult?.categories?.performance?.score;
    return score !== undefined ? Math.round(score * 100) : null;
  } catch (err) {
    console.error("PageSpeed fetch failed for", url, err);
    return null;
  }
}

export async function GET() {
  let browser;
  try {
    const isDev = process.env.NODE_ENV !== "production";

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isDev ? LOCAL_CHROME : await chromium.executablePath(),
      headless: chromium.headless,
    });

    // 1️⃣ Scrape Yell
    const page = await browser.newPage();
    await page.goto(
      "https://www.yell.com/ucs/UcsSearchAction.do?keywords=website&location=United+Kingdom",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    const yellResults = await page.evaluate(() => {
      const data: {
        name: string;
        url: string | null;
        phone: string | null;
        profileLink: string | null;
      }[] = [];

      document
        .querySelectorAll(".businessCapsule--mainContent")
        .forEach((el) => {
          const name =
            el.querySelector("h2 a")?.textContent?.trim() || "Unknown";
          const rawUrl =
            el
              .querySelector(".businessCapsule--ctas a")
              ?.getAttribute("href") || null;
          const phone =
            el.querySelector(".business--telephone")?.textContent?.trim() ||
            null;
          const profileLink =
            (el.querySelector("h2 a") as HTMLAnchorElement)?.href || null;

          const url = rawUrl && rawUrl.startsWith("http") ? rawUrl : null;
          data.push({ name, url, phone, profileLink });
        });

      return data.slice(0, 5);
    });

    const yellEnriched = await Promise.all(
      yellResults.map(async (biz) => {
        let email: string | null = null;
        if (biz.profileLink) {
          try {
            const profilePage = await browser!.newPage();
            await profilePage.goto(biz.profileLink, {
              waitUntil: "domcontentloaded",
              timeout: 45000,
            });
            email = await profilePage.evaluate(() => {
              const node = document.querySelector("a[href^='mailto:']");
              return node
                ? node.getAttribute("href")?.replace("mailto:", "") || null
                : null;
            });
            await profilePage.close();
          } catch {
            console.warn(`No email found for ${biz.name}`);
          }
        }

        const score = biz.url ? await getPageSpeedScore(biz.url) : null;

        return {
          name: biz.name,
          url: biz.url,
          phone: biz.phone,
          email,
          hasWebsite: !!biz.url,
          profileLink: biz.profileLink,
          performanceScore: score ?? "N/A",
        };
      })
    );

    // 2️⃣ Google Maps (no-website businesses)
    const query = "new businesses United Kingdom";
    const mapsRes = await fetch(
      `${GOOGLE_API}?query=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    const mapsData = await mapsRes.json();

    const mapsResults = (mapsData.results || [])
      .filter((place: any) => !place.website)
      .map((place: any) => ({
        name: place.name,
        url: null,
        phone: place.formatted_phone_number || null,
        email: null,
        hasWebsite: false,
        profileLink: null,
        performanceScore: "N/A",
      }))
      .slice(0, 5);

    // 3️⃣ Merge & Sort (no websites first)
    const combined = [...mapsResults, ...yellEnriched].sort((a, b) => {
      if (a.hasWebsite === b.hasWebsite) return 0;
      return a.hasWebsite ? 1 : -1;
    });

    console.log("✅ Outreach results ready:", combined.length);
    return NextResponse.json(combined);
  } catch (err: any) {
    console.error("❌ Outreach API Error:", err.message || err);
    return NextResponse.json(
      { error: "Outreach API failed", details: err.message || String(err) },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
