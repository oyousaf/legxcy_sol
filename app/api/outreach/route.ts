import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { Browser } from "puppeteer-core";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.NEXT_PUBLIC_PAGESPEED_API_KEY!;
const LOCAL_CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  email: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: number | "N/A";
};

async function getPageSpeedScore(url: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`
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
  let browser: Browser | null = null;

  try {
    const isDev = process.env.NODE_ENV !== "production";

    browser = await puppeteer.launch({
      args: [...chromium.args, "--disable-blink-features=AutomationControlled"],
      defaultViewport: chromium.defaultViewport,
      executablePath: isDev ? LOCAL_CHROME : await chromium.executablePath(),
      headless: isDev ? false : chromium.headless, // ⬅️ Show browser in dev
    });

    const page = await browser.newPage();
    await page.goto(
      "https://www.yell.com/ucs/UcsSearchAction.do?keywords=website&location=United+Kingdom",
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    let yellResults: BusinessEntry[] = [];

    try {
      await page.waitForSelector(".row.businessCapsule", { timeout: 15000 });

      yellResults = await page.evaluate(() => {
        const data: BusinessEntry[] = [];
        document.querySelectorAll(".row.businessCapsule").forEach((el) => {
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

          data.push({
            name,
            url,
            phone,
            email: null,
            hasWebsite: !!url,
            profileLink,
            performanceScore: "N/A" as const,
          });
        });
        return data.slice(0, 5);
      });
    } catch (err) {
      console.warn("⚠️ Yell scrape failed:", err);
      yellResults = [];
    }

    const yellEnriched: BusinessEntry[] = await Promise.all(
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
          ...biz,
          email,
          performanceScore: score ?? "N/A",
        };
      })
    );

    const mapsRes = await fetch(
      `${GOOGLE_API}?query=businesses+in+United+Kingdom&key=${API_KEY}`
    );

    const mapsData: {
      results?: {
        name: string;
        formatted_address: string;
        website?: string;
        formatted_phone_number?: string;
      }[];
    } = await mapsRes.json();

    const mapsResults: BusinessEntry[] = (mapsData.results || [])
      .filter((place) => !place.website)
      .map((place) => ({
        name: place.name,
        url: null,
        phone: place.formatted_phone_number || null,
        email: null,
        hasWebsite: false,
        profileLink: null,
        performanceScore: "N/A" as const,
      }))
      .slice(0, 5);

    const combined: BusinessEntry[] = [...mapsResults, ...yellEnriched].sort(
      (a, b) => {
        if (a.hasWebsite === b.hasWebsite) return 0;
        return a.hasWebsite ? 1 : -1;
      }
    );

    return NextResponse.json(combined);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    return NextResponse.json(
      { error: "Outreach API failed", details: errorMsg },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
