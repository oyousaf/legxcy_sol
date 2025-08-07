import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Batch GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const namesParam = searchParams.get("names");

  if (!namesParam) return NextResponse.json({});

  const names = namesParam.split(",").map((n) => decodeURIComponent(n));
  const results: Record<string, boolean> = {};

  for (const name of names) {
    const key = `contacted:${name}`;
    results[name] = (await kv.get<boolean>(key)) ?? false;
  }

  return NextResponse.json(results);
}

// Batch POST
export async function POST(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await Promise.all(
      updates.map(async ({ name, contacted }) => {
        if (name) {
          await kv.set(`contacted:${name}`, contacted, { ex: 2592000 }); // 30 days
        }
      })
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error("❌ Failed to batch update contacted:", err);
    return NextResponse.json(
      { error: "Failed to update statuses" },
      { status: 500 }
    );
  }
}
