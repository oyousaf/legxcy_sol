import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Batch GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const namesParam = searchParams.get("names");

  if (!namesParam) return NextResponse.json({});

  const names = namesParam.split(",").map((n) => decodeURIComponent(n));
  const keys = names.map((name) => `contacted:${name}`);

  try {
    // ✅ Single request for all keys
    const values = await kv.mget<boolean[]>(...keys);

    const results = Object.fromEntries(
      names.map((name, i) => [name, values[i] ?? false])
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("❌ Failed to read contacted statuses:", err);
    return NextResponse.json(
      { error: "Failed to read statuses" },
      { status: 500 }
    );
  }
}

// Batch POST
export async function POST(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // ✅ Parallel updates
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
