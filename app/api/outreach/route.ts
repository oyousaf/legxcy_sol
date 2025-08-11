import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;
const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL!;
const REPLY_TO = process.env.RESEND_TO_EMAIL || FROM_EMAIL;

const SEVEN_DAYS = 60 * 60 * 24 * 7;
const ONE_YEAR = 60 * 60 * 24 * 365;
const DAILY_CAP = 25;

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
interface OutreachPayload {
  to: string;
  name: string;
  business?: string;
  website?: string;
  message: string;
  subject?: string;
}

const getScore = (data: PageSpeedResponse): number | "N/A" =>
  data?.lighthouseResult?.categories?.performance?.score !== undefined
    ? Math.round(
        (data.lighthouseResult.categories.performance.score || 0) * 100
      )
    : "N/A";

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const norm = (s: string) => s.trim().toLowerCase();

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

async function fetchJson<T>(
  url: string,
  ms = 12000,
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

async function getPageSpeedScore(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const [cM, cD] = await Promise.all([
      kv.get<number | "N/A">(`ps:v1:mobile:${host}`),
      kv.get<number | "N/A">(`ps:v1:desktop:${host}`),
    ]);
    if (cM !== null && cD !== null)
      return { mobile: cM as any, desktop: cD as any };

    const [mobileData, desktopData] = await Promise.all([
      fetchJson<PageSpeedResponse>(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`,
        12000,
        "PageSpeed mobile"
      ),
      fetchJson<PageSpeedResponse>(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=desktop&key=${API_KEY}`,
        12000,
        "PageSpeed desktop"
      ),
    ]);

    const mobile = getScore(mobileData);
    const desktop = getScore(desktopData);

    await Promise.all([
      kv.set(`ps:v1:mobile:${host}`, mobile, { ex: SEVEN_DAYS }),
      kv.set(`ps:v1:desktop:${host}`, desktop, { ex: SEVEN_DAYS }),
    ]);

    return { mobile, desktop };
  } catch {
    return { mobile: "N/A", desktop: "N/A" };
  }
}

/* ----------------------------- GET ----------------------------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = (
      searchParams.get("query") || "businesses in Ossett"
    ).slice(0, 200);
    const refresh = searchParams.get("refresh") === "1";
    const cacheKey = `outreach:list:${queryParam}`;

    // per-IP daily limit
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0] || "anon";
    const day = new Date().toISOString().slice(0, 10);
    const getKey = `outreach:get:${ip}:${day}`;
    const getCount = (await kv.incr(getKey)) ?? 0;
    if (getCount === 1) await kv.expire(getKey, 60 * 60 * 24);
    if (getCount > 200) {
      return NextResponse.json(
        { error: "Too many requests today" },
        { status: 429 }
      );
    }

    if (refresh) await kv.del(cacheKey);

    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const mapsData = await fetchJson<any>(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`,
      12000,
      "Google Text Search"
    );
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const places: GooglePlaceResult[] = (mapsData.results || []).slice(0, 20);

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
              12000,
              "Google Place Details"
            );
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;
            await kv.set(detailsKey, { phone, website }, { ex: SEVEN_DAYS });
          } catch {}
        }

        const normalised = normaliseUrl(website);
        let performanceScore: BusinessEntry["performanceScore"] = {
          mobile: "N/A",
          desktop: "N/A",
        };
        if (normalised) performanceScore = await getPageSpeedScore(normalised);

        const mobileScore = performanceScore.mobile;

        return {
          name: place.name,
          url: normalised,
          phone,
          hasWebsite: !!normalised,
          profileLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          performanceScore,
          priorityScore: !normalised
            ? 100
            : !normalised.startsWith("https")
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

    await kv.set(cacheKey, sorted, { ex: SEVEN_DAYS });

    return NextResponse.json(sorted, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unknown outreach API error",
      },
      { status: 500 }
    );
  }
}

/* ----------------------------- POST ---------------------------- */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OutreachPayload;

    const to = body?.to?.trim();
    const name = body?.name?.trim();
    const message = body?.message?.trim();
    if (!to || !name || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // daily send limit
    const dayKey = `outreach:count:${new Date().toISOString().slice(0, 10)}`;
    const count = (await kv.incr(dayKey)) ?? 0;
    if (count === 1) await kv.expire(dayKey, 60 * 60 * 24);
    if (count > DAILY_CAP) {
      return NextResponse.json(
        { error: "Daily limit reached" },
        { status: 429 }
      );
    }

    const safeName = escapeHtml(name);
    const startsWithGreeting = /^\s*(hi|hello|dear)\b/i.test(message);

    const siteUrl = "https://legxcysol.dev";
    const logoUrl = "https://legxcysol.dev/logo.webp";
    const bannerUrl = "https://legxcysol.dev/banner.webp";
    const contentHtml = escapeHtml(message).replace(/\r?\n/g, "<br/>");

    // VALID table structure + clickable logo & banner
    const html = `
      <div style="background-color:#0f2f23;padding:15px;font-family:Inter,Arial,sans-serif;color:#ffffff;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:600px;margin:auto;background-color:#1b3a2c;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="text-align:center;padding:20px;">
              <a href="${siteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <img src="${logoUrl}" alt="Legxcy Solutions Logo"
                     style="max-width:120px;height:auto;margin-bottom:14px;border-radius:8px;border:0;display:inline-block;" />
              </a>
              <h2 style="color:#59ae6a;margin:20px 0 10px 0;font-weight:600;font-size:20px;">
                ${startsWithGreeting ? "" : `Hi ${safeName},`}
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;color:#e6e6e6;font-size:15px;line-height:1.6;">
              <p>${contentHtml}</p>
              <p style="margin-top:20px;">Best regards,<br/>Legxcy Solutions</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:0 20px 20px 20px;">
              <a href="${siteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
                <img src="${bannerUrl}" alt="Legxcy Solutions Banner"
                     style="max-width:100px;height:auto;border-radius:8px;border:0;display:block;margin:0 auto;" />
              </a>
            </td>
          </tr>
        </table>
      </div>
    `.trim();

    const text =
      `${startsWithGreeting ? "" : `Hi ${name},\n\n`}` +
      message +
      `\n\nBest regards,\nLegxcy Solutions`;

    await resend.emails.send({
      from: `Legxcy Solutions <${FROM_EMAIL}>`,
      to,
      subject: body.subject?.trim() || "Legxcy Solutions",
      replyTo: REPLY_TO,
      html,
      text,
      headers: {
        "Auto-Submitted": "auto-generated",
        ...(REPLY_TO ? { "List-Unsubscribe": `<mailto:${REPLY_TO}>` } : {}),
      },
    });

    // --- CRITICAL PART: write both legacy and v1 keys so old UI keeps working ---
    const writes: Promise<any>[] = [
      kv.set(
        `outreach:sent:${to}`,
        { at: Date.now(), name, business: body.business ?? null },
        { ex: SEVEN_DAYS }
      ),

      // legacy (likely what /api/contacted GET uses today)
      kv.set(`contacted:${name}`, true, { ex: ONE_YEAR }),
      body.business
        ? kv.set(`contacted:${body.business}`, true, { ex: ONE_YEAR })
        : Promise.resolve(),

      // normalized v1 keys (future-proof)
      kv.set(`contacted:v1:name:${norm(name)}`, true, { ex: ONE_YEAR }),
      body.business
        ? kv.set(`contacted:v1:name:${norm(body.business)}`, true, {
            ex: ONE_YEAR,
          })
        : Promise.resolve(),
      kv.set(`contacted:v1:email:${norm(to)}`, true, { ex: ONE_YEAR }),
    ];
    await Promise.all(writes);

    return NextResponse.json({ ok: true, contacted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
