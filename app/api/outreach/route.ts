import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
export async function GET(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  return NextResponse.json(
    {
      error:
        "Google discovery is disabled. Use Geoapify discovery or import businesses.",
    },
    { status: 410 },
  );
}
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string, message: string, requestId: string;
  try {
    const body = await req.json();
    id = body.id;
    message = body.message;
    requestId = body.requestId;
    if (
      typeof id !== "string" ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 10000 ||
      typeof requestId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(requestId)
    )
      throw Error();
  } catch {
    return NextResponse.json(
      { error: "Choose a saved business and enter a message." },
      { status: 400 },
    );
  }
  const apiKey = process.env.RESEND_API_KEY,
    from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from)
    return NextResponse.json(
      { error: "Email sending is not configured." },
      { status: 503 },
    );
  try {
    const lead = (await getLeads()).find((l) => l.id === id);
    if (!lead?.email)
      return NextResponse.json(
        { error: "Add an email address to this business first." },
        { status: 400 },
      );
    const resend = new Resend(apiKey);
    const delivery = await resend.emails.send(
      {
        from: `Legxcy Solutions <${from}>`,
        to: lead.email,
        replyTo: process.env.RESEND_TO_EMAIL || from,
        subject: "A website idea for " + lead.name,
        text: message.trim(),
      },
      { idempotencyKey: `outreach/${id}/${requestId}` },
    );
    if (delivery.error)
      return NextResponse.json(
        { error: "Email was not accepted. Please retry." },
        { status: 502 },
      );
    try {
      const updated = await updateLead(id, { contacted: true });
      return NextResponse.json({ lead: updated, sent: true });
    } catch {
      return NextResponse.json({
        sent: true,
        warning:
          "Email accepted, but the contact status could not be saved. Mark this business contacted once your database is available. Do not resend.",
      });
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to complete the send. Check the connection before retrying.",
      },
      { status: 503 },
    );
  }
}
