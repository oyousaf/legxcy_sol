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

export async function sendFromMailbox(
  to: string,
  subject: string,
  text: string,
  thread: string[] = [],
) {
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
    // Follow-ups reply to the earlier emails so they thread together.
    ...(thread.length && { inReplyTo: thread.at(-1), references: thread }),
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

export type SentRecord = {
  key: string;
  email: string;
  messageIds: string[];
  sentAt: string;
};
export type Reply = { at: string; optOut: boolean };

const OPT_OUT =
  /\b(no thanks|not interested|unsubscribe|remove me|stop (emailing|contacting)|don.?t (email|contact))\b/i;

type Part = { part?: string; type: string; childNodes?: Part[] };
function textPart(node: Part | undefined): string | undefined {
  if (!node) return;
  if (node.type === "text/plain") return node.part || "1";
  for (const child of node.childNodes || []) {
    const found = textPart(child);
    if (found) return found;
  }
}

// Finds replies to any email in each sent thread, keyed by SentRecord.key.
// A reply matches if it answers one of our message IDs, or comes from the
// recipient's address after we first emailed them.
export async function findReplies(sent: SentRecord[]) {
  const replied = new Map<string, Reply>();
  if (!sent.length) return replied;
  const since = new Date(Math.min(...sent.map((s) => Date.parse(s.sentAt))));
  const byEmail = new Map(sent.map((s) => [s.email.toLowerCase(), s]));
  const byId = new Map(
    sent.flatMap((s) => s.messageIds.map((id) => [id, s] as const)),
  );
  await withImap(async (client) => {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      if (!uids || !uids.length) return;
      const messages = await client.fetchAll(
        uids,
        { envelope: true, bodyStructure: true },
        { uid: true },
      );
      for (const msg of messages) {
        const env = msg.envelope;
        if (!env) continue;
        const at = env.date ? new Date(env.date) : new Date();
        const fromSent = byEmail.get(env.from?.[0]?.address?.toLowerCase() || "");
        const record =
          (env.inReplyTo && byId.get(env.inReplyTo)) ||
          (fromSent && at.getTime() >= Date.parse(fromSent.sentAt)
            ? fromSent
            : undefined);
        if (!record) continue;
        let optOut = OPT_OUT.test(env.subject || "");
        const part = textPart(msg.bodyStructure as Part | undefined);
        if (!optOut && part) {
          try {
            const { content } = await client.download(String(msg.uid), part, {
              uid: true,
              maxBytes: 20000,
            });
            let body = "";
            for await (const chunk of content) body += chunk.toString();
            // Only their new text: our quoted email contains "no thanks" too.
            const fresh = body.split(
              /\r?\n(?:>|On .+wrote:|From: |-{2,}\s*Original Message|--\s*\r?\n)/,
            )[0];
            optOut = OPT_OUT.test(fresh);
          } catch {}
        }
        const prev = replied.get(record.key);
        replied.set(record.key, {
          at: prev && prev.at < at.toISOString() ? prev.at : at.toISOString(),
          optOut: optOut || !!prev?.optOut,
        });
      }
    } finally {
      lock.release();
    }
  });
  return replied;
}
