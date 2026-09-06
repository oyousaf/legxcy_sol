import { NextResponse } from "next/server";
import { requireOutreachAuth } from "@/lib/outreachAuth";
export async function GET(req: Request) {
  const denied = requireOutreachAuth(req, true);
  if (denied) return denied;
  return NextResponse.json(
    {
      error:
        "Scheduled refresh is disabled. Use Discover in the dashboard to search manually.",
    },
    { status: 410 },
  );
}
