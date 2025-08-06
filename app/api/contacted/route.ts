import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Batch GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const namesParam = searchParams.get("names");

  if (!namesParam) {
    return NextResponse.json({});
  }

  const names = namesParam.split(",").map((n) => decodeURIComponent(n));
  const results: Record<string, boolean> = {};

  for (const name of names) {
    const key = `contacted:${name}`;
    results[name] = (await kv.get<boolean>(key)) ?? false;
  }

  return NextResponse.json(results);
}

// Single update POST
export async function POST(req: Request) {
  try {
    const { name, contacted } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    await kv.set(`contacted:${name}`, contacted, { ex: 2592000 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to update contacted:", err);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
