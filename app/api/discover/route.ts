import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { geoapifyLeads } from "@/lib/leads/geoapify";
import type { LeadInput } from "@/lib/leads/model";
const limiter = new RateLimiterMemory({ points: 10, duration: 3600 });
const cache = new Map<string, { at: number; leads: LeadInput[] }>();
const categories = {
  all: "commercial,catering,service",
  shops: "commercial",
  food: "catering",
  services: "service",
};
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "Add GEOAPIFY_API_KEY to enable local business discovery." },
      { status: 503 },
    );
  let town: string;
  let category: keyof typeof categories;
  try {
    const body = await req.json();
    town = body.town;
    category = body.category || "all";
    if (
      !["Ossett", "Wakefield"].includes(town) ||
      !Object.hasOwn(categories, category)
    )
      throw Error();
  } catch {
    return NextResponse.json(
      { error: "Choose Ossett or Wakefield and a business category." },
      { status: 400 },
    );
  }
  const key = `${town}:${category}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 3600000)
    return NextResponse.json({ leads: cached.leads, cached: true });
  try {
    await limiter.consume("discovery");
  } catch {
    return NextResponse.json(
      {
        error:
          "Discovery limit reached. Try again in an hour; saved businesses remain available.",
      },
      { status: 429 },
    );
  }
  try {
    const geo = await fetch(
      "https://api.geoapify.com/v1/geocode/search?" +
        new URLSearchParams({
          text: `${town}, West Yorkshire, United Kingdom`,
          type: "city",
          limit: "1",
          apiKey,
        }),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!geo.ok) throw Error();
    const gj = await geo.json();
    const p = gj.features?.[0]?.properties;
    if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat)) throw Error();
    const places = await fetch(
      "https://api.geoapify.com/v2/places?" +
        new URLSearchParams({
          categories: categories[category],
          filter: `circle:${p.lon},${p.lat},2500`,
          limit: "50",
          apiKey,
        }),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!places.ok) throw Error();
    const json = await places.json();
    if (!Array.isArray(json.features)) throw Error();
    const leads = geoapifyLeads(json.features);
    cache.set(key, { at: Date.now(), leads });
    return NextResponse.json(
      { leads, cached: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Geoapify could not complete the search. Check the API key and quota, then retry.",
      },
      { status: 503 },
    );
  }
}
