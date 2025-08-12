import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Resend } from "resend";

/* ───────── Constants ───────── */
const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const REPLY_TO = process.env.RESEND_TO_EMAIL || FROM_EMAIL;

const SEVEN_DAYS = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

/* ───────── Types ───────── */
interface GoogleTextSearchResponse {
  results: { place_id: string; name: string }[];
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  result?: {
    formatted_phone_number?: string;
    website?: string;
  };
  error_message?: string;
}

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
    };
  };
}

type PerfNum = number | "N/A";

interface BusinessEntry {
  id: string;
  name: string;
  url: string | null;
  phone: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: { mobile: PerfNum; desktop: PerfNum };
  priorityScore: number;
}

interface OutreachPayload {
  to: string;
  name: string;
  business?: string;
  website?: string;
  message: string;
  subject?: string;
}

interface CachedDetails {
  phone: string | null;
  website: string | null;
}

/* ───────── Helpers ───────── */
const getScore = (data: PageSpeedResponse): PerfNum =>
  data?.lighthouseResult?.categories?.performance?.score !== undefined
    ? Math.round(
        (data.lighthouseResult.categories.performance!.score || 0) * 100
      )
    : "N/A";

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

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
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

async function fetchJsonWithRetry<T>(
  factory: () => Promise<T>,
  retries = 2
): Promise<T> {
  let attempt = 0;
  const waits = [0, 500, 1500];
  while (true) {
    try {
      return await factory();
    } catch (e) {
      if (attempt >= retries) throw e;
      await delay(waits[Math.min(attempt + 1, waits.length - 1)]);
      attempt++;
    }
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
): Promise<{ mobile: PerfNum; desktop: PerfNum }> {
  try {
    const host = hostKey(url);
    const [cM, cD] = await Promise.all([
      kv.get<PerfNum>(`ps:v1:mobile:${host}`),
      kv.get<PerfNum>(`ps:v1:desktop:${host}`),
    ]);

    if (cM !== null && cD !== null) {
      return { mobile: cM, desktop: cD };
    }

    const [mobileData, desktopData] = await Promise.all([
      fetchJsonWithRetry(() =>
        fetchJson<PageSpeedResponse>(
          `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`,
          15000,
          "PageSpeed mobile"
        )
      ),
      fetchJsonWithRetry(() =>
        fetchJson<PageSpeedResponse>(
          `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=desktop&key=${API_KEY}`,
          15000,
          "PageSpeed desktop"
        )
      ),
    ]);

    const mobile = getScore(mobileData);
    const desktop = getScore(desktopData);

    const writes: Promise<unknown>[] = [];
    if (typeof mobile === "number")
      writes.push(
        kv.set<PerfNum>(`ps:v1:mobile:${host}`, mobile, { ex: SEVEN_DAYS })
      );
    if (typeof desktop === "number")
      writes.push(
        kv.set<PerfNum>(`ps:v1:desktop:${host}`, desktop, { ex: SEVEN_DAYS })
      );
    if (writes.length) await Promise.all(writes);

    return { mobile, desktop };
  } catch {
    return { mobile: "N/A", desktop: "N/A" };
  }
}

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

/* ───────── GET ───────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = (
      searchParams.get("query") || "businesses in Ossett"
    ).slice(0, 200);
    const refresh = searchParams.get("refresh") === "1";
    const cacheKey = `outreach:list:${queryParam}`;

    if (!refresh) {
      const cached = await kv.get<BusinessEntry[]>(cacheKey);
      if (cached) {
        devLog(`⚡ KV cache hit for "${queryParam}" (${cached.length} items)`);
        return NextResponse.json(cached, {
          headers: {
            "Cache-Control": "public, max-age=300",
            "Content-Type": "application/json",
          },
        });
      }
    } else {
      devLog(`♻️ Refresh requested for "${queryParam}" (purging caches)`);
    }

    const mapsData = await fetchJson<GoogleTextSearchResponse>(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`,
      15000,
      "Google Text Search"
    );
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const places = mapsData.results.slice(0, 20);

    if (refresh) {
      await kv.del(cacheKey);
      await mapWithConcurrency(places, 5, async (place) => {
        const detailsKey = `place:v1:${place.place_id}`;
        await kv.del(detailsKey);
        try {
          const d = await fetchJson<GooglePlaceDetailsResponse>(
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
            devLog(`🧹 Cleared PageSpeed cache for "${host}"`);
          }
        } catch {
          /* ignore */
        }
      });
    }

    const results: BusinessEntry[] = await mapWithConcurrency(
      places,
      4,
      async (place) => {
        const detailsKey = `place:v1:${place.place_id}`;
        let phone: string | null = null;
        let website: string | null = null;

        const cachedDetails = await kv.get<CachedDetails>(detailsKey);
        if (cachedDetails) {
          phone = cachedDetails.phone;
          website = cachedDetails.website;
          devLog(`⚡ Details cache hit for "${place.name}"`);
        } else {
          try {
            const details = await fetchJson<GooglePlaceDetailsResponse>(
              `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${API_KEY}`,
              15000,
              "Google Place Details"
            );
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;
            await kv.set<CachedDetails>(
              detailsKey,
              { phone, website },
              { ex: SEVEN_DAYS }
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
          id: place.place_id,
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
    await kv.set<BusinessEntry[]>(cacheKey, sorted, { ex: ONE_DAY });
    devLog(`✅ Wrote list "${queryParam}" (${sorted.length}) ttl=${ONE_DAY}s`);

    return NextResponse.json(sorted, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
