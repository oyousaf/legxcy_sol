import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { categoryMap as categories } from "@/lib/leads/categories";
import { discoverTown, TownNotFound } from "@/lib/leads/discover";
// Narrow business types make more, smaller searches, so allow a few more.
const limiter = new RateLimiterMemory({ points: 30, duration: 3600 });
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
    const result = await discoverTown(town, category, apiKey);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return e instanceof TownNotFound
      ? NextResponse.json(
          { error: `Couldn't find "${town}" in the UK. Check the spelling.` },
          { status: 404 },
        )
      : NextResponse.json(
          {
            error:
              "Geoapify could not complete the search. Check the API key and quota, then retry.",
          },
          { status: 503 },
        );
  }
}
