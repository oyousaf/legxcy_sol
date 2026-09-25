import { NextResponse } from "next/server";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import {
  addLeads,
  getLeads,
  getQueueSettings,
  saveQueueSettings,
  updateLead,
  type QueueSettings,
} from "@/lib/leads/store";
import { verifiedCompany, type Lead } from "@/lib/leads/model";
import { categoryMap } from "@/lib/leads/categories";
import { discoverTown } from "@/lib/leads/discover";
import { checkCompany, companiesHouseConfigured } from "@/lib/leads/companiesHouse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_CHECKS = 30;
const MAX_TOWNS = 2;
const TOWN = /^\p{L}[\p{L} .'-]{1,59}$/u;

const storageError = () =>
  NextResponse.json(
    { error: "Saved businesses are unavailable. Check the database connection." },
    { status: 503 },
  );

// Worth pitching: no website, a slow site, or a site we haven't scored yet
// (the dashboard scores it before drafting and drops it if it's fast).
function opportunity(l: Lead) {
  if (l.websiteStatus !== "present") return 0;
  if (!l.performance) return 2;
  const scores = [l.performance.mobile, l.performance.desktop];
  return scores.some((n) => n !== null && n < 50) ? 1 : -1;
}
const candidate = (l: Lead) =>
  !l.contacted &&
  !l.outreach &&
  !l.optedOut &&
  !l.queueSkipped &&
  !l.queuedDraft &&
  (!!l.email || !!l.website) &&
  opportunity(l) >= 0 &&
  l.companyCheck?.status !== "not-limited" &&
  l.companyCheck?.status !== "not-found";

export async function GET(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  try {
    return NextResponse.json({
      settings: await getQueueSettings(),
      companiesHouse: companiesHouseConfigured(),
    });
  } catch {
    return storageError();
  }
}

export async function PUT(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let next: QueueSettings;
  try {
    const body = await req.json();
    const current = await getQueueSettings();
    const towns: string[] = body.towns;
    if (
      !Array.isArray(towns) ||
      !towns.length ||
      towns.length > 40 ||
      !towns.every((t) => typeof t === "string" && TOWN.test(t.trim())) ||
      !Number.isInteger(body.dailyCount) ||
      body.dailyCount < 1 ||
      body.dailyCount > 20 ||
      !Object.hasOwn(categoryMap, body.category)
    )
      throw Error();
    next = {
      towns: towns.map((t) => t.trim()),
      dailyCount: body.dailyCount,
      category: body.category,
      nextTown: current.nextTown % towns.length,
    };
  } catch {
    return NextResponse.json(
      { error: "Choose at least one town, a business type and 1–20 emails a day." },
      { status: 400 },
    );
  }
  try {
    await saveQueueSettings(next);
    return NextResponse.json({ settings: next });
  } catch {
    return storageError();
  }
}

// Picks the next businesses to draft: saved ones first, then new searches
// through the town rotation. Only verified limited companies qualify.
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  if (!companiesHouseConfigured())
    return NextResponse.json(
      { error: "Add COMPANIES_HOUSE_API_KEY so only limited companies are queued." },
      { status: 503 },
    );
  let leads: Lead[], settings: QueueSettings;
  try {
    [leads, settings] = await Promise.all([getLeads(), getQueueSettings()]);
  } catch {
    return storageError();
  }
  const need = settings.dailyCount - leads.filter((l) => l.queuedDraft).length;
  if (need <= 0) return NextResponse.json({ ids: [], searched: [], checked: 0 });

  const picked: Lead[] = [];
  const searched: string[] = [];
  let checked = 0;
  let checkFailed = false;
  const pick = async (pool: Lead[]) => {
    const ordered = pool
      .filter(candidate)
      .sort((a, b) => opportunity(a) - opportunity(b) || a.createdAt.localeCompare(b.createdAt));
    for (const lead of ordered) {
      if (picked.length >= need) return;
      if (!lead.companyCheck) {
        if (checked >= MAX_CHECKS || checkFailed) continue;
        checked++;
        try {
          const companyCheck = await checkCompany(lead);
          Object.assign(lead, await updateLead(lead.id, { companyCheck }));
        } catch {
          checkFailed = true;
          continue;
        }
      }
      if (verifiedCompany(lead)) picked.push(lead);
    }
  };

  await pick(leads);
  const apiKey = process.env.GEOAPIFY_API_KEY;
  while (
    picked.length < need &&
    searched.length < Math.min(MAX_TOWNS, settings.towns.length) &&
    checked < MAX_CHECKS &&
    !checkFailed &&
    apiKey
  ) {
    const town = settings.towns[settings.nextTown % settings.towns.length];
    settings.nextTown = (settings.nextTown + 1) % settings.towns.length;
    searched.push(town);
    try {
      const { leads: found } = await discoverTown(town, settings.category, apiKey);
      // Keep businesses we could email: a listed address, or a website to find one on.
      const usable = found.filter((l) => l.email || l.website);
      if (usable.length) await addLeads(usable);
      leads = await getLeads();
      await pick(leads.filter((l) => !picked.some((p) => p.id === l.id)));
    } catch {
      // A failed town search just moves the rotation on.
    }
  }
  if (searched.length) await saveQueueSettings(settings).catch(() => {});

  return NextResponse.json({
    ids: picked.map((l) => l.id),
    searched,
    checked,
    warning: checkFailed
      ? "Companies House didn't respond, so some businesses weren't checked. Try again shortly."
      : undefined,
  });
}
