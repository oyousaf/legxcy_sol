import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function equal(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireOutreachAuth(req: Request, cronOnly = false) {
  const auth = req.headers.get("authorization") || "";
  const cron = process.env.CRON_SECRET;
  if (req.method === "GET" && cron && equal(auth, `Bearer ${cron}`))
    return null;
  const user = process.env.OUTREACH_USERNAME;
  const password = process.env.OUTREACH_PASSWORD;
  if (
    !cronOnly &&
    user &&
    password &&
    equal(
      auth,
      `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    )
  )
    return null;
  return NextResponse.json(
    { error: "Authentication required" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Outreach", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    },
  );
}
