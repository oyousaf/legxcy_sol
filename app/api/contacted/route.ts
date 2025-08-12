import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

type ContactedStatus = Record<string, boolean>;

interface UpdateItem {
  name: string;
  contacted: boolean;
}

/* ───────── GET: Batch contacted statuses ───────── */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const namesParam = searchParams.get("names");

  if (!namesParam) return NextResponse.json({} satisfies ContactedStatus);

  const names = namesParam.split(",").map((n) => decodeURIComponent(n));
  const keys = names.map((name) => `contacted:${name}`);

  try {
    const values = await kv.mget<boolean[]>(...keys);
    const results: ContactedStatus = Object.fromEntries(
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

/* ───────── POST: Batch update ───────── */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { updates: UpdateItem[] };

    if (!Array.isArray(body.updates)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await Promise.all(
      body.updates.map(async ({ name, contacted }) => {
        if (typeof name === "string" && name.trim()) {
          await kv.set(`contacted:${name}`, contacted, { ex: 2592000 }); // 30 days
        }
      })
    );

    return NextResponse.json({ success: true, updated: body.updates.length });
  } catch (err) {
    console.error("❌ Failed to batch update contacted:", err);
    return NextResponse.json(
      { error: "Failed to update statuses" },
      { status: 500 }
    );
  }
}
