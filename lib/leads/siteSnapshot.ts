import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type SiteSnapshot = {
  url: string;
  https: boolean;
  title: string;
  description: string;
  mobileViewport: boolean;
  copyrightYear: number | null;
  limitedCompany: boolean;
  emails: string[];
  text: string;
  contactUrl: string;
};

const MAX_BYTES = 600_000;

function privateAddress(ip: string) {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

// Only fetch public hosts: the URL comes from saved lead data, not from us.
async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw Error("Unsupported URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(privateAddress))
    throw Error("Private address");
}

async function fetchHtml(start: string) {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LegxcyOutreach/1.0; +https://legxcysol.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !res.body) throw Error(`HTTP ${res.status}`);
    if (!/html/i.test(res.headers.get("content-type") || "html"))
      throw Error("Not HTML");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { url, html: Buffer.concat(chunks).toString("utf8") };
  }
  throw Error("Too many redirects");
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&copy;/g, "©");

function pageText(html: string) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function findEmails(html: string, text: string) {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi))
    found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g))
    found.add(m[0].toLowerCase());
  return [...found].filter(
    (e) =>
      /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) &&
      !/\.(png|jpe?g|gif|webp|svg)$/.test(e) &&
      !/(example|sentry|wixpress|domain)\./.test(e),
  );
}

export async function siteSnapshot(website: string): Promise<SiteSnapshot> {
  const { url, html } = await fetchHtml(website);
  const text = pageText(html);
  const attr = (re: RegExp) => decode(html.match(re)?.[1]?.trim() || "");
  const years = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)]
    .map((m) => Number(m[1]))
    .filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  const contactHref = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].find(
    ([, href, label]) => /contact/i.test(href) || /contact/i.test(label),
  )?.[1];
  let contactUrl = "";
  try {
    const c = contactHref ? new URL(contactHref, url) : null;
    if (c && c.hostname === url.hostname && c.href !== url.href) contactUrl = c.href;
  } catch {}
  return {
    url: url.href,
    https: url.protocol === "https:",
    title: attr(/<title[^>]*>([\s\S]*?)<\/title>/i),
    description: attr(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i),
    mobileViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    copyrightYear: years.length ? Math.max(...years) : null,
    limitedCompany: /\b(ltd|limited|llp)\b|company (?:registration )?(?:number|no)/i.test(text),
    emails: findEmails(html, text),
    text: text.slice(0, 5000),
    contactUrl,
  };
}

// The contact page is where most small businesses publish an email address.
export async function contactEmails(contactUrl: string) {
  try {
    const { html } = await fetchHtml(contactUrl);
    return findEmails(html, pageText(html));
  } catch {
    return [];
  }
}
