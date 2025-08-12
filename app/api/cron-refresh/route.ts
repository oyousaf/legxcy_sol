import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface OutreachResult {
  id: string;
  name: string;
  url: string | null;
  phone?: string | null;
  hasWebsite: boolean;
  profileLink?: string | null;
  performanceScore: { mobile: number | "N/A"; desktop: number | "N/A" } | "N/A";
  priorityScore: number;
}

const QUERIES: string[] = [
  "businesses in Ossett",
  "opticians in Wakefield",
  "businesses in Wakefield",
  "electricians in Wakefield",
  "used cars in Wakefield",
];

export async function GET() {
  const baseUrl = process.env.CRON_BASE_URL || "https://legxcy-sol.vercel.app";

  const results: Record<string, number> = {};

  for (const q of QUERIES) {
    const url = `${baseUrl}/api/outreach?query=${encodeURIComponent(
      q
    )}&refresh=1`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data: OutreachResult[] = await res.json();
      results[q] = data.length;
      console.log(`✅ Refreshed "${q}" — ${data.length} results`);
    } catch (e) {
      console.error(`❌ Failed to refresh "${q}"`, e);
      results[q] = -1;
    }
  }

  return NextResponse.json({ ok: true, results });
}
