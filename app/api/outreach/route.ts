import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: {
        score?: number;
      };
    };
  };
}

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: {
    mobile: number | "N/A";
    desktop: number | "N/A";
  };
  priorityScore: number;
};

type GooglePlaceResult = {
  place_id: string;
  name: string;
};

const getScore = (data: PageSpeedResponse): number | "N/A" =>
  data?.lighthouseResult?.categories?.performance?.score !== undefined
    ? Math.round(data.lighthouseResult.categories.performance.score * 100)
    : "N/A";

async function getPageSpeedScore(
  url: string
): Promise<{ mobile: number | "N/A"; desktop: number | "N/A" }> {
  try {
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`
      ),
      fetch(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=desktop&key=${API_KEY}`
      ),
    ]);

    const [mobileData, desktopData] = await Promise.all([
      mobileRes.json(),
      desktopRes.json(),
    ]);

    return {
      mobile: getScore(mobileData),
      desktop: getScore(desktopData),
    };
  } catch {
    return { mobile: "N/A", desktop: "N/A" };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "businesses in Ossett";
    const refresh = searchParams.get("refresh") === "1";
    const cacheKey = `outreach:${queryParam}`;

    if (refresh) {
      await kv.del(cacheKey);
      console.log("♻️ KV cache cleared for:", cacheKey);
    }

    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) {
      console.log("⚡ Pulled from KV cache:", cached.length);
      return NextResponse.json(cached);
    }

    const mapsRes = await fetch(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );
    if (!mapsRes.ok)
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    const mapsData = await mapsRes.json();
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const results: BusinessEntry[] = await Promise.all(
      (mapsData.results || [])
        .slice(0, 15)
        .map(async (place: GooglePlaceResult) => {
          let phone: string | null = null;
          let website: string | null = null;
          let performanceScore: BusinessEntry["performanceScore"] = {
            mobile: "N/A",
            desktop: "N/A",
          };

          try {
            const detailsRes = await fetch(
              `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${API_KEY}`
            );
            const details = await detailsRes.json();
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;

            if (website && website.startsWith("http")) {
              performanceScore = await getPageSpeedScore(website);
            }
          } catch (err) {
            console.warn(`⚠️ Failed details for ${place.name}`, err);
          }

          const mobileScore = performanceScore.mobile;

          return {
            name: place.name,
            url: website,
            phone,
            hasWebsite: !!website,
            profileLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            performanceScore,
            priorityScore: !website
              ? 100
              : website && !website.startsWith("https")
                ? 80
                : typeof mobileScore === "number" && mobileScore < 50
                  ? 60
                  : 0,
          };
        })
    );

    const filteredResults = results.filter((entry) => {
      if (!entry.hasWebsite) return true;
      if (entry.url && !entry.url.startsWith("https")) return true;
      const score = entry.performanceScore.mobile;
      return typeof score === "number" && score < 50;
    });

    const sorted = filteredResults.sort(
      (a, b) => b.priorityScore - a.priorityScore
    );
    await kv.set(cacheKey, sorted, { ex: 86400 });

    return NextResponse.json(sorted);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    console.error("❌ Outreach API Error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
