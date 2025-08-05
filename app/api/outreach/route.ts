import { NextResponse } from "next/server";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;

type GooglePlace = {
  name: string;
  website?: string;
  formatted_phone_number?: string;
};

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  email: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: number | "N/A";
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "restaurants in Ossett";

    const mapsRes = await fetch(
      `${GOOGLE_API}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );

    if (!mapsRes.ok) {
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    }

    const mapsData: { results?: GooglePlace[]; error_message?: string } =
      await mapsRes.json();

    if (mapsData.error_message) {
      throw new Error(`Google Maps API error: ${mapsData.error_message}`);
    }

    const results: BusinessEntry[] = (mapsData.results || []).map((place) => ({
      name: place.name,
      url: place.website || null,
      phone: place.formatted_phone_number || null,
      email: null,
      hasWebsite: !!place.website,
      profileLink: null,
      performanceScore: "N/A" as const,
    }));

    return NextResponse.json(results.slice(0, 10));
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown Google Maps API error";
    console.error("❌ Google Maps API Error:", errorMsg);
    return NextResponse.json(
      { error: "Google Maps API failed", details: errorMsg },
      { status: 500 }
    );
  }
}
