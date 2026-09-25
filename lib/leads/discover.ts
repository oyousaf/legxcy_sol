import { geoapifyLeads } from "./geoapify";
import { categoryMap } from "./categories";
import type { LeadInput } from "./model";

export class TownNotFound extends Error {}

const cache = new Map<string, { at: number; leads: LeadInput[] }>();

/** Businesses within 2.5 km of a UK town centre, de-duplicated. */
export async function discoverTown(
  town: string,
  category: string,
  apiKey: string,
): Promise<{ leads: LeadInput[]; cached: boolean }> {
  const key = `${town.toLowerCase()}:${category}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 3600000)
    return { leads: cached.leads, cached: true };
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
  if (!geo.ok) throw Error("Geocoding failed");
  const gj = await geo.json();
  const p = gj.features?.[0]?.properties;
  if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat))
    throw new TownNotFound(town);
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
    if (!res.ok) throw Error("Places search failed");
    const json = await res.json();
    if (!Array.isArray(json.features)) throw Error("Places search failed");
    return json.features;
  };
  const cats = categoryMap[category].split(",");
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
  return { leads, cached: false };
}
