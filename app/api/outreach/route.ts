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
  url: string | null;
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
  } catch {
    return "N/A";
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "electricians in Ossett";
    const cacheKey = `outreach:${queryParam}`;

    // ⚡ Check KV cache
    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) {
      console.log("⚡ Served from KV cache:", cached.length);
      return NextResponse.json(cached);
    }

    console.log("🔍 Fetching Google Maps results for:", queryParam);
    const mapsRes = await fetch(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );

    if (!mapsRes.ok)
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    const mapsData = await mapsRes.json();
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const results: BusinessEntry[] = await Promise.all(
      (mapsData.results || []).slice(0, 12).map(async (place: any) => {
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

        const performanceScore =
          website && website.startsWith("http")
            ? await getPageSpeedScore(website)
            : "N/A";

        return {
          name: place.name,
          url: website,
          phone,
          email: null, // Google rarely provides emails
          hasWebsite: !!website,
          profileLink: `https://search.google.com/local/place?id=${place.place_id}`,
          performanceScore,
        };
      })
    );

    // 🚫 Sort: No-website businesses first
    const sorted = results.sort((a, b) => (a.hasWebsite ? 1 : -1));

    console.log("✅ Fresh results:", sorted.length);
    await kv.set(cacheKey, sorted, { ex: 86400 });

    return NextResponse.json(sorted);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    console.error("❌ Outreach API Error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
