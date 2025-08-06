import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  rating: number | "N/A";
  hasWebsite: boolean;
  profileLink: string | null;
};

type GooglePlace = {
  place_id: string;
  name: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "electricians in Ossett";
    const cacheKey = `outreach:${queryParam}`;

    // ⚡ Try KV cache
    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) {
      console.log("⚡ HIT from KV cache:", cached.length);
      return NextResponse.json(cached);
    }

    console.log("❌ MISS — fetching fresh results");
    const mapsRes = await fetch(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );

    if (!mapsRes.ok)
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    const mapsData = await mapsRes.json();
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const results: BusinessEntry[] = await Promise.all(
      ((mapsData.results as GooglePlace[]) || [])
        .slice(0, 12)
        .map(async (place) => {
          let phone: string | null = null;
          let website: string | null = null;
          let rating: number | "N/A" = "N/A";

          try {
            const detailsRes = await fetch(
              `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website,rating&key=${API_KEY}`
            );
            const details = await detailsRes.json();
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;
            rating = details.result?.rating ?? "N/A";
          } catch (err) {
            console.warn(`⚠️ Failed details for ${place.name}`, err);
          }

          return {
            name: place.name,
            url: website,
            phone,
            rating,
            hasWebsite: !!website,
            profileLink: `https://search.google.com/local/place?id=${place.place_id}`,
          };
        })
    );

    // 🚫 Sort: No-website businesses first
    const sorted = results.sort((a, b) =>
      a.hasWebsite === b.hasWebsite ? 0 : a.hasWebsite ? 1 : -1
    );

    try {
      await kv.set(cacheKey, sorted, { ex: 86400 });
      console.log("✅ Cached results for:", cacheKey);
    } catch (e) {
      console.error("KV set failed:", e);
    }

    return NextResponse.json(sorted);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    console.error("❌ Outreach API Error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
