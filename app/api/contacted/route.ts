import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ contacted: false });

  const contacted = (await kv.get<boolean>(`contacted:${name}`)) ?? false;
  return NextResponse.json({ contacted });
}

export async function POST(req: Request) {
  try {
    const { name, contacted } = await req.json();
    if (!name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    await kv.set(`contacted:${name}`, contacted, { ex: 2592000 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
