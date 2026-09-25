import { NextResponse } from "next/server";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
import { nextFollowUp } from "@/lib/leads/model";
import { mailboxConfigured, sendFromMailbox } from "@/lib/mailbox";
// UK PECR: every marketing email must identify the sender and offer a free opt-out.
const FOOTER =
  '\n\n--\nLegxcy Solutions · legxcysol.dev\nNot interested? Reply "no thanks" and I won\'t contact you again.';
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string, message: string, subject: string, requestId: string;
  let followUp: boolean;
  try {
    const body = await req.json();
    id = body.id;
    message = body.message;
    requestId = body.requestId;
    subject = body.subject ?? "";
    followUp = body.followUp === true;
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
  if (!mailboxConfigured())
    return NextResponse.json(
      {
        error:
          "Email sending is not configured. Add OUTREACH_SMTP_USER and OUTREACH_SMTP_PASS.",
      },
      { status: 503 },
    );
  let lead;
  try {
    lead = (await getLeads()).find((l) => l.id === id);
  } catch {
    return NextResponse.json(
      { error: "Saved businesses are unavailable. Check the database connection." },
      { status: 503 },
    );
  }
  if (!lead?.email)
    return NextResponse.json(
      { error: "Add an email address to this business first." },
      { status: 400 },
    );
  // SMTP has no idempotency keys, so a retried click must not send twice.
  if (
    lead.outreach?.requestId === requestId ||
    lead.followUps?.some((f) => f.requestId === requestId)
  )
    return NextResponse.json({ lead, sent: true });
  if (lead.optedOut)
    return NextResponse.json(
      { error: `${lead.name} asked not to be contacted again.` },
      { status: 409 },
    );
  if (followUp && !nextFollowUp(lead))
    return NextResponse.json(
      {
        error: lead.repliedAt
          ? `${lead.name} has already replied, so no follow-up is needed.`
          : "This business has no follow-up left to send.",
      },
      { status: 409 },
    );

  const original = followUp ? lead.outreach! : undefined;
  const thread = original
    ? [original.messageId, ...(lead.followUps ?? []).map((f) => f.messageId)]
    : [];
  const finalSubject = original
    ? "Re: " + original.subject.replace(/^re:\s*/i, "")
    : subject.trim() || "A website idea for " + lead.name;
  const text = message.trim();
  let sent;
  try {
    sent = await sendFromMailbox(lead.email, finalSubject, text + FOOTER, thread);
  } catch {
    return NextResponse.json(
      {
        error:
          "The mailbox rejected the email. Check the SMTP login and the recipient address, then retry.",
      },
      { status: 502 },
    );
  }
  const note = sent.savedToSent
    ? undefined
    : "Sent, but a copy couldn't be saved to your Sent folder.";
  const sentAt = new Date().toISOString();
  try {
    const updated = await updateLead(
      id,
      original
        ? {
            followUps: [
              ...(lead.followUps ?? []),
              { messageId: sent.messageId, sentAt, requestId, text },
            ],
          }
        : {
            contacted: true,
            queuedDraft: null,
            outreach: {
              messageId: sent.messageId,
              subject: finalSubject,
              sentAt,
              requestId,
              text,
            },
          },
    );
    return NextResponse.json({ lead: updated, sent: true, warning: note });
  } catch {
    return NextResponse.json({
      sent: true,
      warning:
        "Email sent, but it could not be recorded. Note it down and do not resend.",
    });
  }
}
