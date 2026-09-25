import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";

// Outreach sends from a real mailbox (Hostinger by default) so messages look
// person-to-person, land in the Sent folder, and replies can be detected.
function config() {
  const user = process.env.OUTREACH_SMTP_USER;
  const pass = process.env.OUTREACH_SMTP_PASS;
  if (!user || !pass) return null;
  return {
    user,
    pass,
    fromName: process.env.OUTREACH_FROM_NAME || "Legxcy Solutions",
    smtpHost: process.env.OUTREACH_SMTP_HOST || "smtp.hostinger.com",
    imapHost: process.env.OUTREACH_IMAP_HOST || "imap.hostinger.com",
  };
}

export const mailboxConfigured = () => config() !== null;

async function withImap<T>(action: (client: ImapFlow) => Promise<T>) {
  const c = config();
  if (!c) throw Error("Mailbox not configured");
  const client = new ImapFlow({
    host: c.imapHost,
    port: 993,
    secure: true,
    auth: { user: c.user, pass: c.pass },
    logger: false,
  });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function sendFromMailbox(to: string, subject: string, text: string) {
  const c = config();
  if (!c) throw Error("Mailbox not configured");
  const domain = c.user.split("@")[1];
  const messageId = `<${randomUUID()}@${domain}>`;
  const raw = await new MailComposer({
    from: { name: c.fromName, address: c.user },
    to,
    subject,
    text,
    messageId,
    date: new Date(),
  })
    .compile()
    .build();
  const transport = nodemailer.createTransport({
    host: c.smtpHost,
    port: 465,
    secure: true,
    auth: { user: c.user, pass: c.pass },
  });
  await transport.sendMail({ envelope: { from: c.user, to }, raw });
  // Hostinger's SMTP doesn't file a copy, so put one in Sent ourselves.
  let savedToSent = true;
  try {
    await withImap(async (client) => {
      const sent = (await client.list()).find((m) => m.specialUse === "\\Sent");
      await client.append(sent?.path || "INBOX.Sent", raw, ["\\Seen"]);
    });
  } catch {
    savedToSent = false;
  }
  return { messageId, savedToSent };
}

export type SentRecord = { email: string; messageId: string; sentAt: string };

// Returns the message IDs (of our sent emails) that have a reply in the inbox.
export async function findReplies(sent: SentRecord[]) {
  if (!sent.length) return new Map<string, string>();
  const since = new Date(Math.min(...sent.map((s) => Date.parse(s.sentAt))));
  const byEmail = new Map(sent.map((s) => [s.email.toLowerCase(), s]));
  const byId = new Set(sent.map((s) => s.messageId));
  const replied = new Map<string, string>();
  await withImap(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      if (!uids || !uids.length) return;
      for (const msg of await client.fetchAll(uids, { envelope: true }, { uid: true })) {
        const env = msg.envelope;
        if (!env) continue;
        const at = env.date ? new Date(env.date) : new Date();
        const fromSent = byEmail.get(env.from?.[0]?.address?.toLowerCase() || "");
        const match =
          env.inReplyTo && byId.has(env.inReplyTo)
            ? env.inReplyTo
            : fromSent && at.getTime() >= Date.parse(fromSent.sentAt)
              ? fromSent.messageId
              : "";
        if (match && !replied.has(match)) replied.set(match, at.toISOString());
      }
    } finally {
      lock.release();
    }
  });
  return replied;
}
