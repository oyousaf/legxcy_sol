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
  lighthouseResult?: { categories?: { performance?: { score?: number } } };
}

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: { mobile: number | "N/A"; desktop: number | "N/A" };
  priorityScore: number;
};

type GooglePlaceResult = { place_id: string; name: string };

const getScore = (data: PageSpeedResponse): number | "N/A" =>
  data?.lighthouseResult?.categories?.performance?.score !== undefined
    ? Math.round(
        (data.lighthouseResult.categories.performance.score || 0) * 100
      )
    : "N/A";

// ---------- helpers ----------
function normaliseUrl(raw?: string | null) {
  if (!raw) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return null;
  }
}

function hostKey(u: string) {
  const h = new URL(u).hostname.toLowerCase().replace(/\.$/, "");
  return h.replace(/^www\./, "");
}

async function fetchJson<T>(
  url: string,
  ms = 15000,
  label?: string
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${label || url} failed: ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function run(): Promise<void> {
    const idx = i++;
    if (idx >= items.length) return;
    results[idx] = await worker(items[idx], idx);
    return run();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

async function getPageSpeedScore(
  url: string
): Promise<{ mobile: number | "N/A"; desktop: number | "N/A" }> {
  try {
    const host = hostKey(url);
    const [cM, cD] = await Promise.all([
      kv.get<number | "N/A">(`ps:v1:mobile:${host}`),
      kv.get<number | "N/A">(`ps:v1:desktop:${host}`),
    ]);
    if (cM !== null && cD !== null)
      return { mobile: cM as any, desktop: cD as any };

    const [mobileData, desktopData] = await Promise.all([
      fetchJson<PageSpeedResponse>(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`,
        15000,
        "PageSpeed mobile"
      ),
      fetchJson<PageSpeedResponse>(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=desktop&key=${API_KEY}`,
        15000,
        "PageSpeed desktop"
      ),
    ]);

    const mobile = getScore(mobileData);
    const desktop = getScore(desktopData);

    await Promise.all([
      kv.set(`ps:v1:mobile:${host}`, mobile, { ex: 60 * 60 * 24 * 7 }),
      kv.set(`ps:v1:desktop:${host}`, desktop, { ex: 60 * 60 * 24 * 7 }),
    ]);

    return { mobile, desktop };
  } catch {
    return { mobile: "N/A", desktop: "N/A" };
  }
}

// ---------- GET ----------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = (
      searchParams.get("query") || "businesses in Ossett"
    ).slice(0, 200);
    const refresh = searchParams.get("refresh") === "1";
    const cacheKey = `outreach:list:${queryParam}`;

    // serve cached list if not forcing refresh
    if (!refresh) {
      const cached = await kv.get<BusinessEntry[]>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    // Text Search once
    const mapsData = await fetchJson<any>(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`,
      15000,
      "Google Text Search"
    );
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const places: GooglePlaceResult[] = (mapsData.results || []).slice(0, 20);

    // On refresh: clear list + details + PageSpeed (using canonical host)
    if (refresh) {
      await kv.del(cacheKey);
      await mapWithConcurrency(places, 5, async (place) => {
        const detailsKey = `place:v1:${place.place_id}`;
        await kv.del(detailsKey);

        try {
          const d = await fetchJson<any>(
            `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=website&key=${API_KEY}`,
            9000,
            "Google Place Details (refresh)"
          );
          const normUrl = normaliseUrl(d?.result?.website || null);
          if (normUrl) {
            const host = hostKey(normUrl);
            await Promise.allSettled([
              kv.del(`ps:v1:mobile:${host}`),
              kv.del(`ps:v1:desktop:${host}`),
            ]);
          }
        } catch {
          /* ignore */
        }
      });
    }

    // Build results (rehydrate details + PageSpeed as needed)
    const results: BusinessEntry[] = await mapWithConcurrency(
      places,
      4,
      async (place) => {
        const detailsKey = `place:v1:${place.place_id}`;
        let phone: string | null = null;
        let website: string | null = null;

        const cachedDetails = await kv.get<{
          phone: string | null;
          website: string | null;
        }>(detailsKey);
        if (cachedDetails) {
          phone = cachedDetails.phone;
          website = cachedDetails.website;
        } else {
          try {
            const details = await fetchJson<any>(
              `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${API_KEY}`,
              15000,
              "Google Place Details"
            );
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;
            await kv.set(
              detailsKey,
              { phone, website },
              { ex: 60 * 60 * 24 * 7 }
            );
          } catch {
            /* ignore */
          }
        }

        const normUrl = normaliseUrl(website);
        let performanceScore: BusinessEntry["performanceScore"] = {
          mobile: "N/A",
          desktop: "N/A",
        };
        if (normUrl) performanceScore = await getPageSpeedScore(normUrl);

        const mobileScore = performanceScore.mobile;

        return {
          name: place.name,
          url: normUrl,
          phone,
          hasWebsite: !!normUrl,
          profileLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          performanceScore,
          priorityScore: !normUrl
            ? 100
            : !normUrl.startsWith("https")
              ? 80
              : typeof mobileScore === "number" && mobileScore < 50
                ? 60
                : 0,
        };
      }
    );

    const filtered = results.filter((entry) => {
      if (!entry.hasWebsite) return true;
      if (entry.url && !entry.url.startsWith("https")) return true;
      const score = entry.performanceScore.mobile;
      return typeof score === "number" && score < 50;
    });

    const sorted = filtered.sort((a, b) => b.priorityScore - a.priorityScore);
    await kv.set(cacheKey, sorted, { ex: 60 * 60 * 24 }); // 24h

    return NextResponse.json(sorted);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
