import type { NextRequest } from "next/server";
import { requireOutreachAuth } from "./lib/outreachAuth";
export function proxy(request: NextRequest) {
  return requireOutreachAuth(request);
}
export const config = { matcher: ["/outreach/:path*"] };
