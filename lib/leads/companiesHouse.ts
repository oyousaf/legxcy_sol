import type { CompanyCheck, Lead } from "./model";

// UK PECR treats limited companies, LLPs and PLCs as "corporate subscribers":
// they can be emailed about services without prior consent (with an opt-out).
// Sole traders and ordinary partnerships can't. This looks each business up
// on the free Companies House API to tell the two apart.
const CORPORATE_TYPES = new Set([
  "ltd",
  "plc",
  "llp",
  "private-unlimited",
  "private-limited-guarant-nsc",
  "private-limited-guarant-nsc-limited-exemption",
  "private-limited-shares-section-30-exemption",
]);

export const companiesHouseConfigured = () => !!process.env.COMPANIES_HOUSE_API_KEY;

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/\b(the|ltd|limited|llp|plc|uk|co|company)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// "Unit 3, Station Road, Ossett, WF5 8AB, United Kingdom" -> ["wf5", "ossett", ...]
function places(address: string) {
  const parts = address.toLowerCase().split(",").map((p) => p.trim());
  const postcode = address.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/);
  return [
    ...(postcode ? [postcode[1].toLowerCase()] : []),
    ...parts.filter((p) => /^[a-z][a-z .'-]{2,}$/.test(p) && p !== "united kingdom"),
  ];
}

type Item = {
  title?: string;
  company_number?: string;
  company_status?: string;
  company_type?: string;
  address_snippet?: string;
};

export async function checkCompany(lead: Pick<Lead, "name" | "address">): Promise<CompanyCheck> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw Error("COMPANIES_HOUSE_API_KEY missing");
  const res = await fetch(
    "https://api.company-information.service.gov.uk/search/companies?" +
      new URLSearchParams({ q: lead.name, items_per_page: "20" }),
    {
      headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64") },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) throw Error(`Companies House ${res.status}`);
  const items: Item[] = (await res.json()).items ?? [];
  const want = normalise(lead.name);
  const where = places(lead.address);
  const checkedAt = new Date().toISOString();
  // Same name (ignoring "Ltd" etc.) and registered somewhere matching their
  // address. Trading names that differ from the registered name won't match;
  // those can be confirmed by hand in the dashboard.
  const match = items.find((i) => {
    if (!want || normalise(i.title || "") !== want) return false;
    const snippet = (i.address_snippet || "").toLowerCase();
    return where.length === 0 || where.some((w) => snippet.includes(w));
  });
  if (!match) return { status: "not-found", checkedAt };
  const corporate =
    match.company_status === "active" && CORPORATE_TYPES.has(match.company_type || "");
  return {
    status: corporate ? "limited" : "not-limited",
    number: match.company_number,
    name: match.title,
    checkedAt,
  };
}
