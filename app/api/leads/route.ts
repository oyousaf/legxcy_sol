import { NextResponse } from "next/server";
import { requireOutreachAuth } from "@/lib/outreachAuth";
import { addLeads, getLeads, storageMode, updateLead } from "@/lib/leads/store";
import { validateLead } from "@/lib/leads/model";
export const dynamic = "force-dynamic";
const storageError = () =>
  NextResponse.json(
    {
      error:
        "Saved businesses are unavailable. Check the cloud database URL and token. Your changes have not been confirmed; retry once the connection is restored.",
    },
    { status: 503 },
  );
export async function GET(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  try {
    return NextResponse.json(
      { leads: await getLeads(), storage: storageMode() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return storageError();
  }
}
export async function POST(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let inputs;
  try {
    const body = await req.json();
    if (
      !Array.isArray(body.leads) ||
      !body.leads.length ||
      body.leads.length > 500
    )
      throw Error("Provide between 1 and 500 businesses.");
    inputs = body.leads.map(validateLead);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await addLeads(inputs));
  } catch {
    return storageError();
  }
}
export async function PATCH(req: Request) {
  const denied = requireOutreachAuth(req);
  if (denied) return denied;
  let id: string;
  let patch;
  try {
    const body = await req.json();
    id = body.id;
    if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id))
      throw Error("Invalid business ID.");
    if (Object.keys(body).length === 2 && typeof body.contacted === "boolean")
      patch = { contacted: body.contacted };
    else {
      const { contacted: ignored, ...fields } = validateLead(body.lead);
      void ignored;
      patch = fields;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ lead: await updateLead(id, patch) });
  } catch (e) {
    return e instanceof Error && e.message === "Business not found."
      ? NextResponse.json({ error: e.message }, { status: 404 })
      : storageError();
  }
}
