import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Resend } from "resend";

const GOOGLE_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.GOOGLE_SERVER_API_KEY!;

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: {
        score?: number;
      };
    };
  };
}

type BusinessEntry = {
  name: string;
  url: string | null;
  phone: string | null;
  hasWebsite: boolean;
  profileLink: string | null;
  performanceScore: {
    mobile: number | "N/A";
    desktop: number | "N/A";
  };
  priorityScore: number;
};

type GooglePlaceResult = {
  place_id: string;
  name: string;
};

const getScore = (data: PageSpeedResponse): number | "N/A" =>
  data?.lighthouseResult?.categories?.performance?.score !== undefined
    ? Math.round(data.lighthouseResult.categories.performance.score * 100)
    : "N/A";

async function getPageSpeedScore(
  url: string
): Promise<{ mobile: number | "N/A"; desktop: number | "N/A" }> {
  try {
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&key=${API_KEY}`
      ),
      fetch(
        `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=desktop&key=${API_KEY}`
      ),
    ]);
    const [mobileData, desktopData] = await Promise.all([
      mobileRes.json(),
      desktopRes.json(),
    ]);
    return { mobile: getScore(mobileData), desktop: getScore(desktopData) };
  } catch {
    return { mobile: "N/A", desktop: "N/A" };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryParam = searchParams.get("query") || "businesses in Ossett";
    const refresh = searchParams.get("refresh") === "1";
    const cacheKey = `outreach:${queryParam}`;

    if (refresh) {
      await kv.del(cacheKey);
    }

    const cached = await kv.get<BusinessEntry[]>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const mapsRes = await fetch(
      `${GOOGLE_TEXT_SEARCH}?query=${encodeURIComponent(queryParam)}&key=${API_KEY}`
    );
    if (!mapsRes.ok)
      throw new Error(`Google Maps API failed: ${mapsRes.status}`);
    const mapsData = await mapsRes.json();
    if (mapsData.error_message) throw new Error(mapsData.error_message);

    const results: BusinessEntry[] = await Promise.all(
      (mapsData.results || [])
        .slice(0, 20)
        .map(async (place: GooglePlaceResult) => {
          let phone: string | null = null;
          let website: string | null = null;
          let performanceScore: BusinessEntry["performanceScore"] = {
            mobile: "N/A",
            desktop: "N/A",
          };

          try {
            const detailsRes = await fetch(
              `${GOOGLE_PLACE_DETAILS}?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${API_KEY}`
            );
            const details = await detailsRes.json();
            phone = details.result?.formatted_phone_number || null;
            website = details.result?.website || null;

            if (website && website.startsWith("http")) {
              performanceScore = await getPageSpeedScore(website);
            }
          } catch {
            // swallow and continue
          }

          const mobileScore = performanceScore.mobile;

          return {
            name: place.name,
            url: website,
            phone,
            hasWebsite: !!website,
            profileLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            performanceScore,
            priorityScore: !website
              ? 100
              : website && !website.startsWith("https")
                ? 80
                : typeof mobileScore === "number" && mobileScore < 50
                  ? 60
                  : 0,
          };
        })
    );

    const filtered = results.filter((entry) => {
      if (!entry.hasWebsite) return true;
      if (entry.url && !entry.url.startsWith("https")) return true;
      const score = entry.performanceScore.mobile;
      return typeof score === "number" && score < 50;
    });

    const sorted = filtered.sort((a, b) => b.priorityScore - a.priorityScore);
    await kv.set(cacheKey, sorted, { ex: 86400 });
    return NextResponse.json(sorted);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown outreach API error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** ---------- NEW: SEND PERSONALISED OUTREACH (POST) ---------- **/
const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL!;
const REPLY_TO = process.env.RESEND_TO_EMAIL || FROM_EMAIL;
const DAILY_CAP = 25;

interface OutreachPayload {
  to: string;
  name: string;
  business?: string;
  website?: string;
  message: string;
}

const sanitize = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OutreachPayload;
    if (!body?.to || !body?.name || !body?.message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // very light daily cap (global). Add auth/scoping to per-user if needed.
    const dayKey = `outreach:count:${new Date().toISOString().slice(0, 10)}`;
    const count = (await kv.incr(dayKey)) ?? 0;
    if (count === 1) await kv.expire(dayKey, 60 * 60 * 24);
    if (count > DAILY_CAP) {
      return NextResponse.json(
        { error: "Daily limit reached" },
        { status: 429 }
      );
    }

    const safeName = sanitize(body.name);
    const safeBiz = sanitize(body.business ?? "");
    const safeMsg = sanitize(body.message);
    const safeSite = sanitize(body.website ?? "");

    const html = `
<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;color:#0b1f17;line-height:1.6">
  <p>Hi ${safeName},</p>
  <p>${safeMsg}</p>
  ${
    safeBiz || safeSite
      ? `<p style="font-size:14px;color:#33433d">
           P.S. I had a quick look at ${safeBiz || "your site"}${
             safeSite
               ? ` — <a href="${safeSite}" target="_blank" rel="noreferrer">link</a>`
               : ""
           }.
         </p>`
      : ""
  }
  <p style="margin-top:24px">
    Best regards,<br/>
    Legxcy Solutions<br/>
    <a href="https://legxcysol.dev" target="_blank" rel="noreferrer">legxcysol.dev</a>
  </p>
  <img src="https://legxcysol.dev/logo.webp" width="96" height="96" alt="Legxcy Solutions logo" style="display:block;margin-top:12px;border:0"/>
</body></html>`.trim();

    const text = `Hi ${body.name},

${body.message}

Best regards,
Legxcy Solutions
https://legxcysol.dev`;

    await resend.emails.send({
      from: `Legxcy Solutions <${FROM_EMAIL}>`,
      to: body.to,
      subject: `Quick question for ${body.name}`,
      replyTo: REPLY_TO,
      html,
      text,
      headers: { "Auto-Submitted": "auto-generated" },
    });

    await kv.set(`outreach:sent:${body.to}`, {
      at: Date.now(),
      name: body.name,
      business: body.business ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
