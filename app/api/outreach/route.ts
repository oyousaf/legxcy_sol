import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
// UK PECR: every marketing email must identify the sender and offer a free opt-out.
const FOOTER =
  '\n\n--\nLegxcy Solutions · legxcysol.dev\nNot interested? Reply "no thanks" and I won\'t contact you again.';
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string, message: string, subject: string, requestId: string;
  try {
    const body = await req.json();
    id = body.id;
    message = body.message;
    requestId = body.requestId;
    subject = body.subject ?? "";
    if (
      typeof id !== "string" ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 10000 ||
      typeof subject !== "string" ||
      subject.length > 150 ||
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
        subject: subject.trim() || "A website idea for " + lead.name,
        text: message.trim() + FOOTER,
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
