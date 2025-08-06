import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;

type BusinessEntry = {
  name: string;
  url: null; // always null now
  phone: string | null;
  email: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: number | "N/A";
};

async function getPageSpeedScore(url: string): Promise<number | "N/A"> {
  try {
    const res = await fetch(
      `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`
    );
    const data = await res.json();
    const score = data.lighthouseResult?.categories?.performance?.score;
    return score !== undefined ? Math.round(score * 100) : "N/A";
  } catch (err) {
    console.error("PageSpeed fetch failed", err);
    return "N/A";
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "electricians in Ossett";
    const cacheKey = `outreach:${queryParam}`;

    // 1️⃣ Check KV cache
    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) {
      console.log("⚡ Served from KV cache:", cached.length);
      return NextResponse.json(cached);
    }

    // 2️⃣ Fetch Google Maps Text Search
    console.log("🔍 Fetching Google Maps results for:", queryParam);
    const mapsRes = await fetch(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );

    if (!mapsRes.ok)
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    const mapsData = await mapsRes.json();
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    // 3️⃣ Enrich with Place Details + PageSpeed
    const results: BusinessEntry[] = await Promise.all(
      (mapsData.results || []).slice(0, 10).map(async (place: any) => {
        let phone: string | null = null;
        let website: string | null = null;

        try {
          const detailsRes = await fetch(
            `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${API_KEY}`
          );
          const details = await detailsRes.json();
          phone = details.result?.formatted_phone_number || null;
          website = details.result?.website || null;
        } catch (err) {
          console.warn(`⚠️ Failed details for ${place.name}`, err);
        }

        // Only fetch PageSpeed if a website exists
        const performanceScore =
          website && website.startsWith("http")
            ? await getPageSpeedScore(website)
            : "N/A";

        return {
          name: place.name,
          url: null, // we never show websites
          phone,
          email: null, // Google rarely provides emails
          hasWebsite: !!website,
          profileLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          performanceScore,
        };
      })
    );

    console.log("✅ Fresh results:", results.length);

    // 4️⃣ Cache for 24 hours
    await kv.set(cacheKey, results, { ex: 86400 });

    return NextResponse.json(results);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    console.error("❌ Outreach API Error:", errorMsg);
    return NextResponse.json(
      { error: "Outreach API failed", details: errorMsg },
      { status: 500 }
    );
  }
}
