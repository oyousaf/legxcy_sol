import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
const limiter = new RateLimiterMemory({ points: 10, duration: 3600 });
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string;
  try {
    const body = await req.json();
    id = body.id;
    if (typeof id !== "string") throw Error();
  } catch {
    return NextResponse.json(
      { error: "Choose a saved business." },
      { status: 400 },
    );
  }
  try {
    await limiter.consume("performance");
  } catch {
    return NextResponse.json(
      { error: "Performance check limit reached. Try again in an hour." },
      { status: 429 },
    );
  }
  try {
    const lead = (await getLeads()).find((l) => l.id === id);
    if (!lead)
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 },
      );
    if (!lead.website)
      return NextResponse.json(
        { error: "Add a website before checking performance." },
        { status: 400 },
      );
    const url = new URL(lead.website);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".") ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)
    )
      return NextResponse.json(
        { error: "Use a public business website." },
        { status: 400 },
      );
    const score = async (strategy: string) => {
      try {
        const params = new URLSearchParams({
          url: lead.website,
          strategy,
          category: "performance",
        });
        if (process.env.GOOGLE_SERVER_API_KEY)
          params.set("key", process.env.GOOGLE_SERVER_API_KEY);
        const res = await fetch(
          "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" +
            params,
          { signal: AbortSignal.timeout(25000) },
        );
        if (!res.ok) return null;
        const data = await res.json();
        const n = data.lighthouseResult?.categories?.performance?.score;
        return typeof n === "number" ? Math.round(n * 100) : null;
      } catch {
        return null;
      }
    };
    const [mobile, desktop] = await Promise.all([
      score("mobile"),
      score("desktop"),
    ]);
    if (mobile === null && desktop === null)
      return NextResponse.json(
        {
          error:
            "PageSpeed could not test this site. Existing scores were kept. Try again later.",
        },
        { status: 503 },
      );
    const updated = await updateLead(id, {
      performance: { mobile, desktop, checkedAt: new Date().toISOString() },
    });
    return NextResponse.json({ lead: updated });
  } catch {
    return NextResponse.json(
      {
        error:
          "The check could not be saved. Check your database connection and retry.",
      },
      { status: 503 },
    );
  }
}
