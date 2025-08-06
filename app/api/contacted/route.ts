import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// POST → mark as contacted
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    await kv.set(`outreach:contacted:${name}`, true);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ KV POST error:", err);
    return NextResponse.json({ error: "KV update failed" }, { status: 500 });
  }
}

// GET → check if contacted
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const contacted = await kv.get<boolean>(`outreach:contacted:${name}`);
    return NextResponse.json({ contacted: contacted ?? false });
  } catch (err: unknown) {
    console.error("❌ KV GET error:", err);
    return NextResponse.json({ error: "KV fetch failed" }, { status: 500 });
  }
}
