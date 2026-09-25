import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
import { findReplies, mailboxConfigured } from "@/lib/mailbox";
export const maxDuration = 60;
const limiter = new RateLimiterMemory({ points: 60, duration: 3600 });
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  if (!mailboxConfigured())
    return NextResponse.json(
      { error: "Add OUTREACH_SMTP_USER and OUTREACH_SMTP_PASS to check replies." },
      { status: 503 },
    );
  try {
    await limiter.consume("replies");
  } catch {
    return NextResponse.json(
      { error: "Reply check limit reached. Try again later." },
      { status: 429 },
    );
  }
  let leads;
  try {
    leads = await getLeads();
  } catch {
    return NextResponse.json(
      { error: "Saved businesses are unavailable. Check the database connection." },
      { status: 503 },
    );
  }
  const waiting = leads.filter((l) => l.outreach && !l.repliedAt);
  let replies;
  try {
    replies = await findReplies(
      waiting.map((l) => ({
        key: l.id,
        email: l.email,
        messageIds: [
          l.outreach!.messageId,
          ...(l.followUps ?? []).map((f) => f.messageId),
        ],
        sentAt: l.outreach!.sentAt,
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "Couldn't read the inbox. Check the mailbox login (IMAP)." },
      { status: 502 },
    );
  }
  const updated = [];
  try {
    for (const lead of waiting) {
      const reply = replies.get(lead.id);
      if (reply)
        updated.push(
          await updateLead(lead.id, {
            repliedAt: reply.at,
            ...(reply.optOut && { optedOut: true }),
          }),
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Replies were found but couldn't be saved. Retry shortly.", updated },
      { status: 503 },
    );
  }
  return NextResponse.json({ checked: waiting.length, updated });
}
