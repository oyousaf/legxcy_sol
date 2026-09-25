import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { geoapifyLeads } from "@/lib/leads/geoapify";
import type { LeadInput } from "@/lib/leads/model";
import { categoryMap as categories } from "@/lib/leads/categories";
// Narrow business types make more, smaller searches, so allow a few more.
const limiter = new RateLimiterMemory({ points: 30, duration: 3600 });
const cache = new Map<string, { at: number; leads: LeadInput[] }>();
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
  let category: string;
  try {
    const body = await req.json();
    town = typeof body.town === "string" ? body.town.trim() : "";
    category = body.category || "all";
    if (
      !/^\p{L}[\p{L} .'-]{1,59}$/u.test(town) ||
      !Object.hasOwn(categories, category)
    )
      throw Error();
  } catch {
    return NextResponse.json(
      { error: "Enter a UK town or city and choose a business category." },
      { status: 400 },
    );
  }
  const key = `${town.toLowerCase()}:${category}`;
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
          text: town,
          filter: "countrycode:gb",
          type: "city",
          limit: "1",
          apiKey,
        }),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!geo.ok) throw Error();
    const gj = await geo.json();
    const p = gj.features?.[0]?.properties;
    if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat))
      return NextResponse.json(
        { error: `Couldn't find "${town}" in the UK. Check the spelling.` },
        { status: 404 },
      );
    // Geoapify drops results when some categories are combined in one
    // request, so query each separately (a few at a time) and merge.
    const search = async (cat: string) => {
      const res = await fetch(
        "https://api.geoapify.com/v2/places?" +
          new URLSearchParams({
            categories: cat,
            filter: `circle:${p.lon},${p.lat},2500`,
            limit: "100",
            apiKey,
          }),
        { signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) throw Error();
      const json = await res.json();
      if (!Array.isArray(json.features)) throw Error();
      return json.features;
    };
    const cats = categories[category].split(",");
    const features = [];
    for (let i = 0; i < cats.length; i += 4)
      features.push(...(await Promise.all(cats.slice(i, i + 4).map(search))).flat());
    const seen = new Set<string>();
    const leads = geoapifyLeads(features).filter((l) => {
      const id = l.sourceId || `${l.name}|${l.address}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
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
