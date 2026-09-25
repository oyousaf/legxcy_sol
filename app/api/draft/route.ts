import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { getLeads, updateLead } from "@/lib/leads/store";
import { contactEmails, siteSnapshot, type SiteSnapshot } from "@/lib/leads/siteSnapshot";
import {
  MAX_FOLLOW_UPS,
  nextFollowUp,
  verifiedCompany,
  type Lead,
} from "@/lib/leads/model";

export const maxDuration = 60;
const limiter = new RateLimiterMemory({ points: 30, duration: 3600 });

const SYSTEM = `You write first-contact emails for Legxcy Solutions, a small web design and development studio based in West Yorkshire that builds fast, bespoke websites for UK businesses (legxcysol.dev).

The reader is a busy local business owner who has never heard of us. The email should read like a short note from a real person nearby, not marketing copy.

Write in British English, plain text, under 110 words in the body. Open with one specific, true observation about their business or website taken only from the facts provided, and say briefly why it costs them customers. If they have no website, the observation is about what customers searching for them currently find (or don't). Offer one concrete, low-effort next step, such as a free 10-minute call or a quick mock-up of their homepage. Sign off as "Legxcy Solutions".

Format the body like a real email: "Hi," (or "Hi <name>," if a person is named) on its own line, then two or three short paragraphs separated by blank lines, then the sign-off on its own line.

Never invent details: no made-up statistics, reviews, visits, or claims about their site that the facts don't support. If the facts are thin, keep the observation modest. Avoid flattery clichés ("I hope this finds you well", "I was impressed by"), exclamation marks, and pushy urgency. Do not add an unsubscribe line; one is appended automatically.

The subject line is under 60 characters, specific to them, in sentence case with the business name capitalised as given, and not clickbait.`;

const FOLLOW_UP_SYSTEM = `You write short follow-up emails for Legxcy Solutions, a small web design and development studio based in West Yorkshire (legxcysol.dev). It is sent as a reply in the same thread as our earlier email, which the business owner hasn't answered.

Write in British English, plain text, under 70 words in the body. Don't repeat the first email or apologise for following up, and avoid "just bumping this", "circling back" and guilt-tripping. Add one new, genuinely useful angle taken only from the facts provided: a different small problem, a quick practical tip they could use even without us, or an easier next step. If this is the last follow-up, say so kindly and close the loop, leaving the door open. Never invent details.

Format: "Hi," on its own line, one or two short paragraphs, then "Legxcy Solutions" on its own line. Do not add an unsubscribe line; one is appended automatically.

For the subject, repeat the original subject (it is replaced with "Re: <original>" anyway).`;

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    message: { type: "string" },
    angle: {
      type: "string",
      description: "One short sentence naming the observation the email leads with.",
    },
  },
  required: ["subject", "message", "angle"],
  additionalProperties: false,
};

function facts(lead: Lead, site: SiteSnapshot | null, siteError: string) {
  const year = new Date().getFullYear();
  const lines = [
    `Today's date: ${new Date().toDateString()}`,
    `Business: ${lead.name}`,
    lead.address && `Location: ${lead.address}`,
    lead.notes && `My notes on them: ${lead.notes}`,
  ];
  if (!lead.website)
    lines.push(
      lead.websiteStatus === "absent"
        ? "Website: none - I checked manually and they have no website."
        : "Website: none listed in the directory data (not confirmed).",
    );
  else {
    lines.push(`Website: ${lead.website}`);
    if (lead.performance)
      lines.push(
        `Google PageSpeed performance score (0-100, 90+ is good): mobile ${lead.performance.mobile ?? "unavailable"}, desktop ${lead.performance.desktop ?? "unavailable"}`,
      );
    if (site) {
      lines.push(
        `Served over HTTPS: ${site.https ? "yes" : "no"}`,
        `Mobile viewport tag: ${site.mobileViewport ? "present" : "missing (likely not mobile-friendly)"}`,
        `Latest copyright year in footer: ${site.copyrightYear === null ? "not found" : year - site.copyrightYear >= 2 ? `${site.copyrightYear} (${year - site.copyrightYear} years out of date, suggests the site is neglected)` : `${site.copyrightYear} (current, not a problem)`}`,
        `Page title: ${site.title || "(empty)"}`,
        `Meta description: ${site.description || "(missing)"}`,
        `Homepage text excerpt:\n"""\n${site.text}\n"""`,
      );
    } else lines.push(`Homepage could not be loaded: ${siteError}`);
  }
  return lines.filter(Boolean).join("\n");
}

function pickEmail(emails: string[], website: string) {
  let host = "";
  try {
    host = new URL(website).hostname.replace(/^www\./, "");
  } catch {}
  return emails.find((e) => host && e.endsWith("@" + host)) || emails[0] || "";
}

type Draft = { subject: string; message: string; angle: string };
type DraftResult = { draft: Draft } | { error: string; status: number };

function parseDraft(text: string, provider: string): DraftResult {
  try {
    const d = JSON.parse(text);
    if ([d.subject, d.message, d.angle].every((v) => typeof v === "string" && v.trim()))
      return { draft: d };
  } catch {}
  return { error: `${provider} returned an unreadable draft. Please retry.`, status: 502 };
}

async function draftWithClaude(system: string, prompt: string): Promise<DraftResult> {
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    return {
      status: e instanceof Anthropic.RateLimitError ? 429 : 502,
      error:
        e instanceof Anthropic.AuthenticationError
          ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
          : e instanceof Anthropic.RateLimitError
            ? "Claude is rate limited right now. Try again in a minute."
            : "Claude could not write a draft. Please retry.",
    };
  }
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens")
    return { error: "Claude did not return a usable draft. Write this one by hand.", status: 502 };
  const text = response.content.find((b) => b.type === "text");
  return parseDraft(text?.type === "text" ? text.text : "", "Claude");
}

// Google AI Studio's free tier. GOOGLE_SERVER_API_KEY works too once the
// Gemini API is enabled on its Google Cloud project.
const geminiKey = () =>
  process.env.GEMINI_API_KEY || process.env.GOOGLE_SERVER_API_KEY || "";

// Free-tier models are often at quota or overloaded, so fall through the list
// from best to most available.
const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
];

async function draftWithGemini(system: string, prompt: string): Promise<DraftResult> {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_MODELS;
  let result: DraftResult = { error: "Gemini could not write a draft.", status: 502 };
  for (const model of models) {
    result = await geminiOnce(model, system, prompt);
    if (!("error" in result) || ![429, 503, 404].includes(result.status)) return result;
  }
  return result;
}

async function geminiOnce(model: string, system: string, prompt: string): Promise<DraftResult> {
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                subject: { type: "STRING" },
                message: { type: "STRING" },
                angle: { type: "STRING" },
              },
              required: ["subject", "message", "angle"],
            },
          },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch {
    // Timeouts count as "busy" so the next model gets a turn.
    return { error: "Gemini could not be reached. Please retry.", status: 503 };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason: string = body?.error?.message || "";
    return {
      status: [429, 503, 404].includes(res.status) ? res.status : 502,
      error:
        res.status === 429
          ? "Gemini's free limit is used up for now. Try again later."
          : res.status === 503
            ? "Gemini is busy right now. Try again in a minute."
          : res.status === 403 && /has not been used|disabled/i.test(reason)
            ? "The Gemini API isn't enabled for this Google key. Create a free key at aistudio.google.com and set GEMINI_API_KEY."
            : res.status === 400 || res.status === 403
              ? `Google rejected the Gemini request: ${reason.slice(0, 160) || "check GEMINI_API_KEY"}`
              : res.status === 404
                ? `Gemini model "${model}" wasn't found. Set GEMINI_MODEL to a current model.`
                : "Gemini could not write a draft. Please retry.",
    };
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY")
    return { error: "Gemini did not return a usable draft. Write this one by hand.", status: 502 };
  const text = (candidate.content?.parts || [])
    .map((p: { text?: string }) => p.text || "")
    .join("");
  return parseDraft(text, "Gemini");
}

export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string;
  let followUp: boolean;
  let queue: boolean;
  try {
    const body = await req.json();
    id = body.id;
    followUp = body.followUp === true;
    // Queue mode saves the draft on the business for the Ready to send list.
    queue = body.queue === true && !followUp;
    if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id)) throw Error();
  } catch {
    return NextResponse.json({ error: "Choose a saved business." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY && !geminiKey())
    return NextResponse.json(
      { error: "Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to enable AI drafts." },
      { status: 503 },
    );
  try {
    await limiter.consume("draft");
  } catch {
    return NextResponse.json(
      { error: "AI draft limit reached (30 an hour). Try again shortly." },
      { status: 429 },
    );
  }

  let lead: Lead | undefined;
  try {
    lead = (await getLeads()).find((l) => l.id === id);
  } catch {
    return NextResponse.json(
      { error: "Saved businesses are unavailable. Check the database connection." },
      { status: 503 },
    );
  }
  if (!lead) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  let site: SiteSnapshot | null = null;
  let siteError = "";
  if (lead.website) {
    try {
      site = await siteSnapshot(lead.website);
    } catch (e) {
      siteError = e instanceof Error ? e.message : "unknown error";
    }
  }

  // Fill a missing email from their own website before drafting.
  let foundEmail = "";
  if (!lead.email && site) {
    const emails = site.emails.length
      ? site.emails
      : site.contactUrl
        ? await contactEmails(site.contactUrl)
        : [];
    foundEmail = pickEmail(emails, lead.website);
    if (foundEmail) {
      try {
        lead = await updateLead(lead.id, { email: foundEmail });
      } catch {
        foundEmail = "";
      }
    }
  }

  if (queue && !lead.email) {
    // Nowhere to send it, so don't spend an AI call or offer it again.
    try {
      lead = await updateLead(lead.id, { queueSkipped: true });
    } catch {}
    return NextResponse.json(
      { error: `No email address found for ${lead.name}.`, lead, skipped: true },
      { status: 422 },
    );
  }
  const next = followUp ? nextFollowUp(lead) : null;
  if (followUp && (!next || !lead.outreach))
    return NextResponse.json(
      { error: "This business has no follow-up left to send.", lead },
      { status: 409 },
    );
  const system = next ? FOLLOW_UP_SYSTEM : SYSTEM;
  const prompt = next
    ? [
        `Write follow-up ${next.number} of ${MAX_FOLLOW_UPS}${next.number === MAX_FOLLOW_UPS ? " (the last one)" : ""}. They haven't replied.`,
        `Our first email, sent ${new Date(lead.outreach!.sentAt).toDateString()}:\n"""\n${lead.outreach!.text || "(text not recorded)"}\n"""`,
        ...(lead.followUps ?? []).map(
          (f, i) => `Follow-up ${i + 1}, sent ${new Date(f.sentAt).toDateString()}:\n"""\n${f.text}\n"""`,
        ),
        `Facts about the business:\n${facts(lead, site, siteError)}`,
      ].join("\n\n")
    : `Write the first email to this business using only these facts.\n\n${facts(lead, site, siteError)}`;
  const result = process.env.ANTHROPIC_API_KEY
    ? await draftWithClaude(system, prompt)
    : await draftWithGemini(system, prompt);
  if ("error" in result)
    return NextResponse.json({ error: result.error, lead }, { status: result.status });
  const draft = result.draft;
  if (queue) {
    try {
      lead = await updateLead(lead.id, {
        queuedDraft: { ...draft, createdAt: new Date().toISOString() },
      });
    } catch {
      return NextResponse.json(
        { error: "The draft couldn't be saved. Check the database connection." },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    ...draft,
    lead,
    foundEmail,
    limitedCompany: verifiedCompany(lead) || (site?.limitedCompany ?? false),
    siteError,
  });
}
