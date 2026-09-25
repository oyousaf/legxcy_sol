"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FiArrowUpRight,
  FiPlus,
  FiUpload,
  FiDownload,
  FiSearch,
  FiGrid,
  FiCompass,
  FiCheck,
  FiMail,
  FiActivity,
  FiArrowLeft,
  FiRefreshCw,
  FiZap,
  FiTrash2,
  FiChevronsLeft,
  FiChevronsRight,
  FiInbox,
  FiClock,
  FiSlash,
  FiSend,
  FiSettings,
  FiShield,
} from "react-icons/fi";
import {
  emptyLead,
  followUpDue,
  identity,
  FOLLOW_UP_DAYS,
  MAX_FOLLOW_UPS,
  nextFollowUp,
  verifiedCompany,
  type Lead,
  type LeadInput,
} from "@/lib/leads/model";
import { makeCsv, parseCsv } from "@/lib/leads/csv";
import { businessTypes, towns } from "@/lib/leads/categories";
import type { QueueSettings } from "@/lib/leads/store";
import Dialog from "./components/Dialog";
import "./outreach.css";
type Panel = "add" | "import" | "edit" | "compose" | "queue" | null;
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed. Please retry.");
  return data as T;
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const websiteLabel = {
  present: "Website listed",
  unknown: "Website unknown",
  absent: "Confirmed no website",
};
// PageSpeed mobile scores below this are worth pitching a rebuild.
const LOW_SCORE = 50;
const lowScore = (l: Lead) =>
  !!l.performance &&
  [l.performance.mobile, l.performance.desktop].some(
    (n) => n !== null && n < LOW_SCORE,
  );
const isOpportunity = (l: Lead) => l.websiteStatus !== "present" || lowScore(l);
const filters: Record<string, (l: Lead) => boolean> = {
  all: () => true,
  opportunity: isOpportunity,
  new: (l) => !l.contacted,
  contacted: (l) => l.contacted,
  awaiting: (l) => !!l.outreach && !l.repliedAt,
  followup: (l) => followUpDue(l),
  replied: (l) => !!l.repliedAt,
  nosite: (l) => l.websiteStatus !== "present",
  low: lowScore,
  unchecked: (l) => l.websiteStatus === "present" && !l.performance,
};
const OTHER_TOWN = "__other";
type DraftInfo = { angle: string; limitedCompany: boolean; siteError: string };
function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function companyLabel(l: Lead) {
  const c = l.companyCheck;
  if (!c) return "Not checked yet";
  if (c.status === "manual") return "Limited company (confirmed by you)";
  if (c.status === "limited") return `Limited company · ${c.name} (${c.number})`;
  if (c.status === "not-limited")
    return `Registered but not an active limited company · ${c.name}`;
  return "Not found on Companies House";
}
function scoreClass(n: number | null) {
  return n === null ? "" : n < LOW_SCORE ? "amber" : n >= 90 ? "green" : "";
}
export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]),
    [loading, setLoading] = useState(true),
    [storage, setStorage] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [view, setView] = useState<"leads" | "discover">("leads"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [panel, setPanel] = useState<Panel>(null),
    [draft, setDraft] = useState<LeadInput>({ ...emptyLead }),
    [selectedId, setSelectedId] = useState(""),
    [busy, setBusy] = useState("");
  const [csvRows, setCsvRows] = useState<LeadInput[]>([]),
    [csvName, setCsvName] = useState(""),
    [formError, setFormError] = useState("");
  const [town, setTown] = useState("Ossett"),
    [customTown, setCustomTown] = useState(false),
    [category, setCategory] = useState("all"),
    [discovered, setDiscovered] = useState<LeadInput[]>([]),
    [discoveryDone, setDiscoveryDone] = useState(false),
    [discoveryLabel, setDiscoveryLabel] = useState(""),
    [chosen, setChosen] = useState<Set<number>>(new Set()),
    [hideListed, setHideListed] = useState(true);
  const [message, setMessage] = useState(""),
    [subject, setSubject] = useState(""),
    [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null),
    [followUpNumber, setFollowUpNumber] = useState<number | null>(null),
    [requestId, setRequestId] = useState("");
  const [collapsed, setCollapsed] = useState(false),
    // "Now" for due dates, fixed per load so renders stay pure.
    [loadedAt, setLoadedAt] = useState(0);
  const [queueSettings, setQueueSettings] = useState<QueueSettings | null>(null),
    [companiesHouse, setCompaniesHouse] = useState(true),
    [preparing, setPreparing] = useState<{
      done: number;
      total: number;
      label: string;
    } | null>(null);
  useEffect(() => {
    // Restore per-browser layout preferences after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCollapsed(stored("outreach:collapsed") === "1");
    const f = stored("outreach:filter");
    if (f && f in filters) setFilter(f);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  function chooseFilter(f: string) {
    setFilter(f);
    store("outreach:filter", f);
  }
  function toggleSidebar() {
    setCollapsed((c) => {
      store("outreach:collapsed", c ? "0" : "1");
      return !c;
    });
  }
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = leads.find((l) => l.id === selectedId);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ leads: Lead[]; storage: string }>("/api/leads");
      setLeads(data.leads);
      setStorage(data.storage);
      setLoadedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Synchronize the working list with durable storage on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const openAdd = useCallback(() => {
    setDraft({ ...emptyLead });
    setFormError("");
    setPanel("add");
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        panel ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        setView("leads");
        searchRef.current?.focus();
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, openAdd]);
  const shown = useMemo(
    () =>
      leads
        .filter((l) =>
          `${l.name} ${l.address} ${l.email} ${l.notes}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .filter(filters[filter] ?? filters.all),
    [leads, query, filter],
  );
  const savedIdentities = useMemo(() => new Set(leads.map(identity)), [leads]);
  function close() {
    if (["save", "send", "draft", "delete"].includes(busy)) return;
    setPanel(null);
    setFormError("");
  }
  function edit(lead: Lead) {
    setSelectedId(lead.id);
    setDraft({ ...lead });
    setFormError("");
    setPanel("edit");
  }
  function updateInList(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
  }
  async function save() {
    setBusy("save");
    setFormError("");
    try {
      if (panel === "edit") {
        const data = await api<{ lead: Lead }>("/api/leads", "PATCH", {
          id: selectedId,
          lead: draft,
        });
        updateInList(data.lead);
        setNotice("Business updated.");
      } else {
        const result = await api<{ added: number; skipped: number }>(
          "/api/leads",
          "POST",
          { leads: panel === "import" ? csvRows : [draft] },
        );
        setNotice(
          `${result.added} businesses saved${result.skipped ? `; ${result.skipped} existing records kept unchanged` : ""}.`,
        );
        await load();
      }
      setPanel(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function toggleContacted(lead: Lead) {
    setBusy(lead.id);
    setError("");
    try {
      const data = await api<{ lead: Lead }>("/api/leads", "PATCH", {
        id: lead.id,
        contacted: !lead.contacted,
      });
      updateInList(data.lead);
      setNotice(
        data.lead.contacted
          ? "Marked contacted and saved."
          : "Marked not contacted and saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function discover() {
    setBusy("discover");
    setError("");
    setDiscovered([]);
    setDiscoveryDone(false);
    setChosen(new Set());
    try {
      const data = await api<{ leads: LeadInput[] }>("/api/discover", "POST", {
        town,
        category,
      });
      setDiscovered(data.leads);
      setDiscoveryLabel(town);
      setDiscoveryDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveChosen() {
    setBusy("discovery-save");
    setError("");
    try {
      const data = await api<{ added: number; skipped: number }>(
        "/api/leads",
        "POST",
        { leads: [...chosen].map((i) => discovered[i]) },
      );
      await load();
      setChosen(new Set());
      setNotice(
        `${data.added} businesses added. ${data.skipped ? `${data.skipped} duplicates skipped.` : ""}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function checkPerformance(lead: Lead) {
    setBusy("check");
    setFormError("");
    try {
      const data = await api<{ lead: Lead }>("/api/performance", "POST", {
        id: lead.id,
      });
      updateInList(data.lead);
      setNotice("Performance check saved.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function send() {
    setBusy("send");
    setFormError("");
    try {
      const data = await api<{ lead?: Lead; warning?: string }>(
        "/api/outreach",
        "POST",
        {
          id: selectedId,
          message,
          subject,
          requestId,
          followUp: followUpNumber !== null,
        },
      );
      if (data.lead) updateInList(data.lead);
      setNotice(
        data.warning ||
          (followUpNumber
            ? `Follow-up ${followUpNumber} sent in the same thread.`
            : "Email sent and business marked contacted."),
      );
      setPanel(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function compose(lead: Lead) {
    setSelectedId(lead.id);
    setFollowUpNumber(null);
    setSubject(`A website idea for ${lead.name}`);
    setMessage(
      `Hi,\n\nI came across ${lead.name} and wanted to introduce Legxcy Solutions. We design and develop websites for local businesses.\n\nWould you be open to a short conversation about your website?\n\nBest regards,\nLegxcy Solutions`,
    );
    setDraftInfo(null);
    setRequestId(crypto.randomUUID());
    setFormError("");
    setPanel("compose");
  }
  function composeFollowUp(lead: Lead) {
    const next = nextFollowUp(lead);
    if (!next || !lead.outreach) return;
    setSelectedId(lead.id);
    setSubject("Re: " + lead.outreach.subject);
    setMessage(
      next.number === MAX_FOLLOW_UPS
        ? "Hi,\n\nI won't keep filling your inbox, so this is my last note. If a faster, easier-to-find website is ever on your list, I'm happy to help.\n\nLegxcy Solutions"
        : "Hi,\n\nA quick follow-up on my note below. I'm happy to put together a free homepage mock-up so you can see what's possible, no strings attached.\n\nLegxcy Solutions",
    );
    setFollowUpNumber(next.number);
    setDraftInfo(null);
    setRequestId(crypto.randomUUID());
    setFormError("");
    setPanel("compose");
  }
  async function aiDraft(lead: Lead, followUp = false) {
    setBusy(followUp ? `draft:${lead.id}` : "draft");
    setFormError("");
    setError("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, followUp }),
        cache: "no-store",
      });
      const data = await res.json();
      // The draft route may have saved an email it found, even on failure.
      if (data.lead) updateInList(data.lead);
      if (!res.ok) throw Error(data.error || "Draft failed. Please retry.");
      setSelectedId(lead.id);
      setFollowUpNumber(followUp ? (nextFollowUp(lead)?.number ?? 1) : null);
      setSubject(
        followUp && lead.outreach
          ? "Re: " + lead.outreach.subject
          : data.subject,
      );
      setMessage(data.message);
      setDraftInfo({
        angle: data.angle,
        limitedCompany: data.limitedCompany,
        siteError: data.siteError,
      });
      if (data.foundEmail)
        setNotice(`Found and saved ${data.foundEmail} from their website.`);
      setRequestId(crypto.randomUUID());
      setPanel("compose");
    } catch (e) {
      // Follow-up drafts start from the list, where no dialog is open.
      if (followUp) setError((e as Error).message);
      else setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function checkReplies(silent = false) {
    if (!silent) setBusy("replies");
    setError("");
    store("outreach:repliesCheckedAt", String(Date.now()));
    try {
      const data = await api<{ checked: number; updated: Lead[] }>(
        "/api/replies",
        "POST",
        {},
      );
      data.updated.forEach(updateInList);
      if (data.updated.length || !silent)
        setNotice(
          data.updated.length
            ? `${data.updated.length} new ${data.updated.length === 1 ? "reply" : "replies"}: ${data.updated.map((l) => l.name + (l.optedOut ? " (asked not to be contacted)" : "")).join(", ")}.`
            : `No new replies from ${data.checked} emailed ${data.checked === 1 ? "business" : "businesses"}.`,
        );
    } catch (e) {
      if (!silent) setError((e as Error).message);
    } finally {
      if (!silent) setBusy("");
    }
  }
  // Check the inbox when the dashboard opens (at most every 15 minutes), so
  // anyone who replied drops out of the follow-up list before you see it.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (loading || autoChecked.current) return;
    autoChecked.current = true;
    const last = Number(stored("outreach:repliesCheckedAt") || 0);
    if (
      Date.now() - last > 15 * 60e3 &&
      leads.some((l) => l.outreach && !l.repliedAt)
    )
      // Syncing with the mailbox, like the initial load above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void checkReplies(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  async function setOptedOut(lead: Lead, optedOut: boolean) {
    setBusy("optout");
    setFormError("");
    try {
      const data = await api<{ lead: Lead }>("/api/leads", "PATCH", {
        id: lead.id,
        optedOut,
      });
      updateInList(data.lead);
      setNotice(
        optedOut
          ? `${lead.name} marked do not contact.`
          : `${lead.name} can be contacted again.`,
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const dueFollowUps = loadedAt
    ? leads.filter((l) => followUpDue(l, loadedAt))
    : [];

  // Ready-to-send queue: the server picks verified limited companies, then
  // each is scored (if it has a site) and drafted here, one at a time, so no
  // single request runs past the hosting time limit.
  const ready = leads.filter((l) => l.queuedDraft);
  async function loadQueueSettings() {
    try {
      const data = await api<{ settings: QueueSettings; companiesHouse: boolean }>(
        "/api/queue",
      );
      setQueueSettings(data.settings);
      setCompaniesHouse(data.companiesHouse);
      return data;
    } catch {
      return null;
    }
  }
  async function prepareQueue() {
    if (preparing) return;
    setError("");
    store("outreach:queuePreparedOn", new Date().toDateString());
    setPreparing({ done: 0, total: 0, label: "Finding verified limited companies…" });
    const skipped: string[] = [];
    let drafted = 0;
    try {
      const pick = await api<{ ids: string[]; searched: string[]; warning?: string }>(
        "/api/queue",
        "POST",
        {},
      );
      const fresh = await api<{ leads: Lead[] }>("/api/leads");
      setLeads(fresh.leads);
      const byId = new Map(fresh.leads.map((l) => [l.id, l]));
      for (const [i, id] of pick.ids.entries()) {
        let lead = byId.get(id);
        if (!lead) continue;
        setPreparing({ done: i, total: pick.ids.length, label: `Drafting for ${lead.name}…` });
        if (lead.website && !lead.performance) {
          try {
            lead = (await api<{ lead: Lead }>("/api/performance", "POST", { id })).lead;
            updateInList(lead);
          } catch {}
          const p = lead.performance;
          if (p && [p.mobile, p.desktop].every((n) => n === null || n >= LOW_SCORE)) {
            skipped.push(`${lead.name} (site already fast)`);
            continue;
          }
        }
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, queue: true }),
          cache: "no-store",
        });
        const data = await res.json();
        if (data.lead) updateInList(data.lead);
        if (res.ok) drafted++;
        else skipped.push(`${lead.name} (${data.error || "draft failed"})`);
      }
      const where = pick.searched.length ? ` Searched ${pick.searched.join(" and ")}.` : "";
      setNotice(
        (pick.ids.length
          ? `${drafted} ${drafted === 1 ? "email" : "emails"} ready to review.`
          : "No new verified limited companies to queue right now.") +
          where +
          (skipped.length ? ` Skipped: ${skipped.join("; ")}.` : "") +
          (pick.warning ? ` ${pick.warning}` : ""),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreparing(null);
    }
  }
  async function sendQueued(lead: Lead) {
    if (!lead.queuedDraft) return;
    setBusy(`send:${lead.id}`);
    setError("");
    try {
      const data = await api<{ lead?: Lead; warning?: string }>("/api/outreach", "POST", {
        id: lead.id,
        subject: lead.queuedDraft.subject,
        message: lead.queuedDraft.message,
        requestId: crypto.randomUUID(),
      });
      if (data.lead) updateInList(data.lead);
      setNotice(data.warning || `Sent to ${lead.name}.`);
      return true;
    } catch (e) {
      setError(`${lead.name}: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy("");
    }
  }
  async function sendAllQueued() {
    if (!window.confirm(`Send all ${ready.length} emails now?`)) return;
    let sent = 0;
    for (const lead of ready) if (await sendQueued(lead)) sent++;
    setNotice(`${sent} of ${ready.length} emails sent.`);
  }
  function reviewQueued(lead: Lead) {
    if (!lead.queuedDraft) return;
    setSelectedId(lead.id);
    setFollowUpNumber(null);
    setSubject(lead.queuedDraft.subject);
    setMessage(lead.queuedDraft.message);
    setDraftInfo({ angle: lead.queuedDraft.angle, limitedCompany: true, siteError: "" });
    setRequestId(crypto.randomUUID());
    setFormError("");
    setPanel("compose");
  }
  async function patchLead(lead: Lead, patch: Record<string, boolean>, done: string) {
    setBusy("patch");
    setError("");
    setFormError("");
    try {
      const data = await api<{ lead: Lead }>("/api/leads", "PATCH", { id: lead.id, ...patch });
      updateInList(data.lead);
      setNotice(done);
    } catch (e) {
      (panel ? setFormError : setError)((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveQueueSettingsForm(form: HTMLFormElement) {
    const f = new FormData(form);
    const towns = String(f.get("towns") || "")
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    setBusy("save");
    setFormError("");
    try {
      const data = await api<{ settings: QueueSettings }>("/api/queue", "PUT", {
        towns,
        dailyCount: Number(f.get("dailyCount")),
        category: f.get("category"),
      });
      setQueueSettings(data.settings);
      setNotice("Queue settings saved.");
      setPanel(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  // Prepare the day's queue the first time the dashboard opens each day.
  const queueStarted = useRef(false);
  useEffect(() => {
    if (loading || queueStarted.current) return;
    queueStarted.current = true;
    void loadQueueSettings().then((data) => {
      if (
        data?.companiesHouse &&
        stored("outreach:queuePreparedOn") !== new Date().toDateString()
      )
        void prepareQueue();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  async function deleteBusiness(lead: Lead) {
    if (!window.confirm(`Delete ${lead.name}? This can't be undone.`)) return;
    setBusy("delete");
    setFormError("");
    try {
      await api(`/api/leads?id=${lead.id}`, "DELETE");
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setNotice(`${lead.name} deleted.`);
      setPanel(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const shownDiscovered = discovered
    .map((lead, i) => ({ lead, i }))
    .filter(({ lead }) => !hideListed || !lead.website);
  return (
    <div className={`workspace${collapsed ? " collapsed" : ""}`}>
      <aside className="work-sidebar">
        <div className="sidebar-top">
          <Link className="brand" href="/" aria-label="Legxcy Studio home">
            <Image src="/logo.webp" width={30} height={30} alt="" />
            <span className="brand-text">
              <span>legxcy</span> <span>studio</span>
            </span>
          </Link>
          <button
            className="icon-btn collapse-btn"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
          </button>
        </div>
        <div className="workspace-label">
          WORKSPACE <span>Private</span>
        </div>
        <nav aria-label="Workspace">
          <button
            className={view === "leads" ? "active" : ""}
            aria-label="Businesses"
            title={collapsed ? "Businesses" : undefined}
            onClick={() => {
              setView("leads");
              setError("");
            }}
          >
            <FiGrid /> <span className="nav-label">Businesses</span>
            <span className="nav-count">{leads.length}</span>
          </button>
          <button
            className={view === "discover" ? "active" : ""}
            aria-label="Discover nearby"
            title={collapsed ? "Discover nearby" : undefined}
            onClick={() => {
              setView("discover");
              setError("");
            }}
          >
            <FiCompass /> <span className="nav-label">Discover nearby</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> You’re in control
          <p>
            Search when you need to.
            <br />
            No scheduled API calls.
          </p>
        </div>
        <Link className="back-link" href="/" title="Back to website">
          <FiArrowLeft /> <span className="nav-label">Back to website</span>
        </Link>
      </aside>
      <main className="work-main">
        <header className="work-topbar">
          <span>
            Studio <span className="crumb">/</span> Outreach
          </span>
          <span className="storage-pill">
            {storage === "local"
              ? "Saved on this computer"
              : storage === "cloud"
                ? "Cloud storage"
                : "Connecting to storage"}
          </span>
        </header>
        <div className="work-content">
          <div className="work-title">
            <div>
              <p className="eyebrow">Build better connections</p>
              <h1>
                {view === "leads"
                  ? "Your next conversation."
                  : "Good businesses, nearby."}
              </h1>
              <p>
                {view === "leads"
                  ? "Keep your prospects, notes and follow-ups in one considered space."
                  : "Explore local businesses. Review the details, then save the ones that fit."}
              </p>
            </div>
            <div className="work-actions">
              <button
                className="btn"
                onClick={() => {
                  setCsvRows([]);
                  setCsvName("");
                  setFormError("");
                  setPanel("import");
                }}
              >
                <FiUpload /> Import CSV
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <FiPlus /> Add business
              </button>
            </div>
          </div>
          {error && (
            <div className="work-alert" role="alert">
              {error}
              <button className="text-button" onClick={() => void load()}>
                Reload saved businesses
              </button>
            </div>
          )}
          {notice && (
            <div className="work-notice" role="status">
              <FiCheck />
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {view === "leads" ? (
            <>
              <section className="queue" aria-label="Ready to send">
                <div className="queue-head">
                  <div>
                    <h2>
                      <FiSend /> Ready to send <span>{ready.length}</span>
                    </h2>
                    <p>
                      {companiesHouse
                        ? `Verified limited companies with no website or a slow one, drafted by AI. Up to ${queueSettings?.dailyCount ?? 5} a day, searching ${queueSettings?.towns.join(", ") ?? "your towns"} in turn.`
                        : "Add COMPANIES_HOUSE_API_KEY to start the queue. Only businesses confirmed as limited companies are queued, to keep within UK PECR rules."}
                    </p>
                  </div>
                  <div className="queue-actions">
                    <button
                      className="btn btn-small"
                      disabled={!!preparing || !queueSettings}
                      onClick={() => {
                        setFormError("");
                        setPanel("queue");
                      }}
                    >
                      <FiSettings /> Settings
                    </button>
                    <button
                      className="btn btn-small"
                      disabled={!!preparing || !!busy || !companiesHouse}
                      onClick={() => void prepareQueue()}
                    >
                      <FiRefreshCw /> Prepare more
                    </button>
                    {ready.length > 1 && (
                      <button
                        className="btn btn-small btn-primary"
                        disabled={!!preparing || !!busy}
                        onClick={() => void sendAllQueued()}
                      >
                        <FiSend /> Send all
                      </button>
                    )}
                  </div>
                </div>
                {preparing && (
                  <p className="queue-progress" role="status">
                    <span className="status-dot" />
                    {preparing.label}
                    {preparing.total > 0 &&
                      ` (${preparing.done + 1} of ${preparing.total})`}
                  </p>
                )}
                {ready.map((lead) => (
                  <div className="queue-row" key={lead.id}>
                    <div className="queue-info">
                      <strong>{lead.name}</strong>
                      <small>
                        {lead.email} · {lead.queuedDraft!.angle}
                      </small>
                      <p>
                        <b>{lead.queuedDraft!.subject}</b> —{" "}
                        {lead.queuedDraft!.message
                          .replace(/^hi[^\n]*\n+/i, "")
                          .slice(0, 140)}
                        …
                      </p>
                    </div>
                    <div className="followup-actions">
                      <button
                        className="btn btn-small btn-primary"
                        disabled={!!busy || !!preparing}
                        onClick={() => void sendQueued(lead)}
                      >
                        <FiMail />
                        {busy === `send:${lead.id}` ? "Sending…" : "Send"}
                      </button>
                      <button
                        className="btn btn-small"
                        disabled={!!busy}
                        onClick={() => reviewQueued(lead)}
                      >
                        Review
                      </button>
                      <button
                        className="btn btn-small"
                        disabled={!!busy}
                        onClick={() =>
                          void patchLead(
                            lead,
                            { queueSkipped: true },
                            `${lead.name} skipped. It won't be queued again.`,
                          )
                        }
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ))}
              </section>
              {dueFollowUps.length > 0 && (
                <section className="followups" aria-label="Follow-ups due">
                  <div className="followups-head">
                    <h2>
                      <FiClock /> Follow-ups due{" "}
                      <span>{dueFollowUps.length}</span>
                    </h2>
                    <p>
                      No reply after {FOLLOW_UP_DAYS} days. Each follow-up is
                      sent in the same email thread, and anyone who replies
                      drops off this list.
                    </p>
                  </div>
                  {dueFollowUps.map((lead) => {
                    const next = nextFollowUp(lead)!;
                    const last =
                      lead.followUps?.at(-1)?.sentAt ?? lead.outreach!.sentAt;
                    const days = Math.floor(
                      (loadedAt - Date.parse(last)) / 864e5,
                    );
                    return (
                      <div className="followup-row" key={lead.id}>
                        <button
                          className="business-name"
                          onClick={() => edit(lead)}
                        >
                          <span className="business-avatar">
                            {lead.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <strong>{lead.name}</strong>
                            <small>
                              Follow-up {next.number} of {MAX_FOLLOW_UPS} ·
                              last emailed {days} days ago
                            </small>
                          </span>
                        </button>
                        <div className="followup-actions">
                          <button
                            className="btn btn-small btn-primary"
                            disabled={!!busy}
                            onClick={() => void aiDraft(lead, true)}
                          >
                            <FiZap />
                            {busy === `draft:${lead.id}`
                              ? "Drafting…"
                              : "AI follow-up"}
                          </button>
                          <button
                            className="btn btn-small"
                            disabled={!!busy}
                            onClick={() => composeFollowUp(lead)}
                          >
                            <FiMail /> Write
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
              <div className="metric-grid">
                {[
                  ["In your workspace", leads.length, "Businesses saved"],
                  [
                    "Ready to reach out",
                    leads.filter((l) => !l.contacted).length,
                    "Not contacted yet",
                  ],
                  [
                    "Conversations started",
                    leads.filter((l) => l.contacted).length,
                    "Marked contacted",
                  ],
                  [
                    "Opportunities",
                    leads.filter(isOpportunity).length,
                    `No website or score under ${LOW_SCORE}`,
                  ],
                ].map(([label, note, sub], i) => (
                  <div className={`metric metric-${i}`} key={label}>
                    <span>{label}</span>
                    <strong>{loading ? "—" : note}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <section className="lead-list" aria-label="Saved businesses">
                <div className="list-toolbar">
                  <div className="filter-tabs">
                    {[
                      ["all", "All businesses"],
                      ["opportunity", "Opportunities"],
                      ["new", "Not contacted"],
                      ["contacted", "Contacted"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={filter === key ? "selected" : ""}
                        onClick={() => chooseFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-actions">
                    <button
                      className="text-button"
                      disabled={!!busy || !leads.some((l) => l.outreach)}
                      onClick={() => void checkReplies()}
                    >
                      <FiInbox />
                      {busy === "replies" ? "Checking…" : "Check replies"}
                    </button>
                    <button
                      className="text-button"
                      disabled={!leads.length}
                      onClick={() =>
                        download("legxcy-businesses.csv", makeCsv(leads))
                      }
                    >
                      <FiDownload /> Export
                    </button>
                  </div>
                </div>
                <div className="list-search">
                  <label className="search-field">
                    <FiSearch />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search names, locations or notes…"
                      aria-label="Search saved businesses"
                    />
                    <kbd>/</kbd>
                  </label>
                  <select
                    aria-label="Website and contact filter"
                    value={filter}
                    onChange={(e) => chooseFilter(e.target.value)}
                  >
                    <option value="all">All businesses</option>
                    <option value="opportunity">
                      Opportunities (no site or low score)
                    </option>
                    <option value="nosite">No website</option>
                    <option value="low">Score under {LOW_SCORE}</option>
                    <option value="unchecked">Website not scored yet</option>
                    <option value="new">Not contacted</option>
                    <option value="contacted">Contacted</option>
                    <option value="awaiting">Emailed, awaiting reply</option>
                    <option value="followup">Follow-up due</option>
                    <option value="replied">Replied</option>
                  </select>
                  <button
                    className="icon-btn"
                    aria-label="Reload businesses"
                    disabled={loading}
                    onClick={() => void load()}
                  >
                    <FiRefreshCw />
                  </button>
                </div>
                {loading ? (
                  <div className="work-empty" role="status">
                    Loading your workspace…
                  </div>
                ) : !shown.length ? (
                  <div className="work-empty">
                    <div className="empty-icon">
                      <FiGrid />
                    </div>
                    <h2>
                      {leads.length
                        ? "No matches just yet."
                        : "Start with one good business."}
                    </h2>
                    <p>
                      {leads.length
                        ? "Try another search or change the filters."
                        : "Add a business you know, import a list, or discover nearby prospects."}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={
                        leads.length
                          ? () => {
                              setQuery("");
                              chooseFilter("all");
                            }
                          : openAdd
                      }
                    >
                      {leads.length
                        ? "Clear filters"
                        : "Add your first business"}{" "}
                      <FiPlus />
                    </button>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Business</th>
                          <th>Website</th>
                          <th>Contact</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((lead) => (
                          <tr key={lead.id}>
                            <td>
                              <button
                                className="business-name"
                                onClick={() => edit(lead)}
                              >
                                <span className="business-avatar">
                                  {lead.name.slice(0, 2).toUpperCase()}
                                </span>
                                <span>
                                  <strong>{lead.name}</strong>
                                  <small>
                                    {lead.address || "Location not added"}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              {lead.website ? (
                                <a
                                  className="site-link"
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {new URL(lead.website).hostname.replace(
                                    /^www\./,
                                    "",
                                  )}{" "}
                                  <FiArrowUpRight />
                                </a>
                              ) : null}
                              {lead.website && lead.performance ? (
                                <span
                                  className={`badge score-badge ${scoreClass(lead.performance.mobile)}`}
                                  title={`Desktop ${lead.performance.desktop ?? "N/A"}`}
                                >
                                  Mobile {lead.performance.mobile ?? "N/A"}
                                </span>
                              ) : lead.website ? (
                                <small className="source-label">
                                  Not scored
                                </small>
                              ) : (
                                <span
                                  className={`badge ${lead.websiteStatus === "absent" ? "amber" : ""}`}
                                >
                                  {websiteLabel[lead.websiteStatus]}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="contact-cell">
                                {lead.email || lead.phone || "Not added"}
                              </span>
                              <small className="source-label">
                                {lead.source === "geoapify"
                                  ? "Geoapify"
                                  : lead.source === "csv"
                                    ? "CSV import"
                                    : "Manually added"}
                              </small>
                            </td>
                            <td>
                              {lead.repliedAt && (
                                <span
                                  className="badge green replied-badge"
                                  title={new Date(
                                    lead.repliedAt,
                                  ).toLocaleString()}
                                >
                                  <FiInbox /> Replied
                                </span>
                              )}
                              {lead.optedOut ? (
                                <span className="badge amber replied-badge">
                                  <FiSlash /> Do not contact
                                </span>
                              ) : followUpDue(lead) ? (
                                <span className="badge amber replied-badge">
                                  <FiClock /> Follow-up due
                                </span>
                              ) : lead.followUps?.length && !lead.repliedAt ? (
                                <span className="badge replied-badge">
                                  {lead.followUps.length} follow-up
                                  {lead.followUps.length > 1 ? "s" : ""} sent
                                </span>
                              ) : null}
                              <button
                                className={`badge status-button ${lead.contacted ? "green" : ""}`}
                                disabled={!!busy}
                                onClick={() => void toggleContacted(lead)}
                                aria-label={`${lead.name}: ${lead.contacted ? "mark not contacted" : "mark contacted"}`}
                              >
                                {lead.contacted ? (
                                  <FiCheck />
                                ) : (
                                  <span className="tiny-dot" />
                                )}
                                {busy === lead.id
                                  ? "Saving…"
                                  : lead.contacted
                                    ? "Contacted"
                                    : "Not contacted"}
                              </button>
                            </td>
                            <td>
                              <button
                                className="icon-btn"
                                aria-label={`Open ${lead.name}`}
                                onClick={() => edit(lead)}
                              >
                                <FiArrowUpRight />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="list-footer">
                  <span>
                    {shown.length} of {leads.length} businesses
                  </span>
                  <span>
                    Shortcuts: <kbd>/</kbd> Search <kbd>N</kbd> Add
                  </span>
                </div>
              </section>
            </>
          ) : (
            <section className="discovery">
              <div className="discovery-controls">
                <div>
                  <label htmlFor="town">Around</label>
                  <select
                    id="town"
                    value={customTown ? OTHER_TOWN : town}
                    onChange={(e) => {
                      const other = e.target.value === OTHER_TOWN;
                      setCustomTown(other);
                      setTown(other ? "" : e.target.value);
                    }}
                  >
                    {towns.map(({ group, places }) => (
                      <optgroup key={group} label={group}>
                        {places.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={OTHER_TOWN}>Another town…</option>
                  </select>
                  {customTown && (
                    <input
                      className="town-input"
                      aria-label="Town or city"
                      autoFocus
                      value={town}
                      maxLength={60}
                      placeholder="Type any UK town or city"
                      onChange={(e) => setTown(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busy && town.trim())
                          void discover();
                      }}
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="category">Type of business</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {businessTypes.map(({ group, types }) => (
                      <optgroup key={group} label={group}>
                        {Object.entries(types).map(([key, t]) => (
                          <option key={key} value={key}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => void discover()}
                  disabled={!!busy || !town.trim()}
                >
                  <FiSearch />{" "}
                  {busy === "discover" ? "Searching…" : "Discover businesses"}
                </button>
              </div>
              <p className="discovery-help">
                Searches 2.5 km around the town centre. Missing website details mean
                “unknown”—please verify before reaching out. Save a business
                and run a performance check to find slow sites.
              </p>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={hideListed}
                  onChange={(e) => setHideListed(e.target.checked)}
                />
                Only show businesses without a listed website
              </label>
              {discoveryDone ? (
                <>
                  <div className="discovery-summary">
                    <h2>
                      {shownDiscovered.length} businesses around{" "}
                      {discoveryLabel}
                      {hideListed &&
                        shownDiscovered.length < discovered.length && (
                          <small>
                            {" "}
                            ({discovered.length - shownDiscovered.length} with
                            a website hidden)
                          </small>
                        )}
                    </h2>
                    <button
                      className="btn"
                      disabled={!chosen.size || !!busy || loading}
                      onClick={() => void saveChosen()}
                    >
                      {busy === "discovery-save"
                        ? "Saving…"
                        : `Save selected (${chosen.size})`}
                    </button>
                  </div>
                  <div className="discovery-grid">
                    {shownDiscovered.map(({ lead, i }) => {
                      const saved = savedIdentities.has(identity(lead));
                      return (
                        <label
                          className={`discovery-card ${chosen.has(i) ? "chosen" : ""}`}
                          key={lead.sourceId || i}
                        >
                          <div className="discovery-card-top">
                            <span className="business-avatar">
                              {lead.name.slice(0, 2).toUpperCase()}
                            </span>
                            {saved ? (
                              <span className="badge green">Saved</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={chosen.has(i)}
                                onChange={() =>
                                  setChosen((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(i)) next.delete(i);
                                    else next.add(i);
                                    return next;
                                  })
                                }
                                aria-label={`Select ${lead.name}`}
                              />
                            )}
                          </div>
                          <h3>{lead.name}</h3>
                          <p>{lead.address}</p>
                          <span
                            className={`badge ${lead.website ? "green" : ""}`}
                          >
                            {websiteLabel[lead.websiteStatus]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {!shownDiscovered.length && (
                    <div className="work-empty">
                      {discovered.length
                        ? "Every business found lists a website. Untick the filter to see them."
                        : "No named businesses found. Try another category."}
                    </div>
                  )}
                </>
              ) : (
                <div className="work-empty">
                  <div className="empty-icon">
                    <FiCompass />
                  </div>
                  <h2>A little local knowledge.</h2>
                  <p>
                    Choose an area and a category to explore. Searches only run
                    when you ask.
                  </p>
                </div>
              )}
              <p className="attribution">
                Powered by{" "}
                <a
                  href="https://www.geoapify.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Geoapify
                </a>{" "}
                · ©{" "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenStreetMap contributors
                </a>
              </p>
            </section>
          )}
          {leads.some((l) => l.source === "geoapify") && view === "leads" && (
            <p className="attribution">
              Discovery data: <a href="https://www.geoapify.com/">Geoapify</a> ·{" "}
              <a href="https://www.openstreetmap.org/copyright">
                © OpenStreetMap contributors
              </a>
            </p>
          )}
          <footer className="work-footer">
            <span>Legxcy Solutions / Outreach workspace</span>
            <span>
              {storage === "local"
                ? "Local records stay on this computer. Export a backup regularly."
                : "Changes are confirmed after saving."}
            </span>
          </footer>
        </div>
      </main>
      {panel && (
        <Dialog
          title={
            panel === "add"
              ? "Add a business"
              : panel === "edit"
                ? "Business details"
                : panel === "queue"
                  ? "Ready to send settings"
                  : panel === "import"
                  ? "Bring your list with you."
                  : followUpNumber
                    ? `Follow-up ${followUpNumber} of ${MAX_FOLLOW_UPS}`
                    : "Start a conversation"
          }
          onClose={close}
        >
          {formError && (
            <div className="work-alert" role="alert">
              {formError}
            </div>
          )}
          {panel === "queue" && queueSettings ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveQueueSettingsForm(e.currentTarget);
              }}
            >
              <p className="dialog-copy">
                Each day the queue drafts emails for saved businesses first.
                When those run out, it searches the next town below and carries
                on from there the following day. Nobody is queued twice.
              </p>
              <label className="field">
                Towns to work through, in order (one per line)
                <textarea
                  name="towns"
                  rows={8}
                  defaultValue={queueSettings.towns.join("\n")}
                />
              </label>
              <p className="dialog-copy queue-next">
                Next town to search:{" "}
                <strong>
                  {queueSettings.towns[queueSettings.nextTown] ?? queueSettings.towns[0]}
                </strong>
              </p>
              <div className="field-grid">
                <label className="field">
                  Emails to prepare a day
                  <input
                    name="dailyCount"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={queueSettings.dailyCount}
                  />
                </label>
                <label className="field">
                  Type of business
                  <select name="category" defaultValue={queueSettings.category}>
                    {businessTypes.map(({ group, types }) => (
                      <optgroup key={group} label={group}>
                        {Object.entries(types).map(([key, t]) => (
                          <option key={key} value={key}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn" onClick={close}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!!busy}
                >
                  {busy === "save" ? "Saving…" : "Save settings"} <FiCheck />
                </button>
              </div>
            </form>
          ) : panel === "import" ? (
            <>
              <p className="dialog-copy">
                Upload a CSV, review it, then save. Existing businesses keep
                their notes and contact status.
              </p>
              <button
                className="text-button"
                onClick={() => download("business-template.csv", makeCsv([]))}
              >
                <FiDownload /> Download CSV template
              </button>
              <label className="upload-zone">
                <FiUpload />
                <strong>{csvName || "Choose a CSV file"}</strong>
                <span>UTF-8 · up to 1 MB · 500 businesses</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    setCsvRows([]);
                    setFormError("");
                    if (!f) return;
                    setCsvName(f.name);
                    try {
                      if (f.size > 1_000_000)
                        throw Error("Choose a file smaller than 1 MB.");
                      setCsvRows(parseCsv(await f.text()));
                    } catch (err) {
                      setFormError((err as Error).message);
                    }
                  }}
                />
              </label>
              {csvRows.length > 0 && (
                <>
                  <p className="dialog-copy">
                    {csvRows.length} valid businesses ready to import. Preview:
                  </p>
                  <div className="import-preview">
                    {csvRows.slice(0, 5).map((row, i) => (
                      <div key={i}>
                        <strong>{row.name}</strong>
                        <span>{websiteLabel[row.websiteStatus]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="dialog-actions">
                <button className="btn" onClick={close}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!csvRows.length || !!busy}
                  onClick={() => void save()}
                >
                  {busy === "save"
                    ? "Saving…"
                    : `Import ${csvRows.length || ""} businesses`}
                </button>
              </div>
            </>
          ) : panel === "compose" ? (
            <>
              <p className="dialog-copy">
                To {selected?.name} ·{" "}
                {selected?.email || "no email address saved yet"}
              </p>
              {draftInfo && (
                <div className="draft-info">
                  <FiZap />
                  <div>
                    <strong>AI draft. Check it before sending.</strong>
                    <p>{draftInfo.angle}</p>
                    {draftInfo.siteError && (
                      <p>
                        Their website couldn’t be read ({draftInfo.siteError}),
                        so the draft is more general.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {selected?.optedOut && (
                <div className="work-alert" role="alert">
                  {selected.name} asked not to be contacted again, so sending
                  is blocked.
                </div>
              )}
              {followUpNumber === null &&
                !draftInfo?.limitedCompany &&
                !(selected && verifiedCompany(selected)) && (
                <p className="pecr-note">
                  Couldn’t confirm this is a limited company. If it’s a sole
                  trader or partnership, UK PECR rules require their consent
                  before a marketing email, so phone or visit instead.
                </p>
              )}
              <label className="field">
                Subject
                <input
                  value={subject}
                  maxLength={150}
                  readOnly={followUpNumber !== null}
                  title={
                    followUpNumber !== null
                      ? "Follow-ups reply in the original thread"
                      : undefined
                  }
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                />
              </label>
              <label className="field">
                Message
                <textarea
                  rows={10}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                />
              </label>
              {followUpNumber !== null && selected?.outreach && (
                <details className="thread-history">
                  <summary>
                    Earlier emails in this thread (
                    {1 + (selected.followUps?.length ?? 0)})
                  </summary>
                  {[
                    {
                      sentAt: selected.outreach.sentAt,
                      text: selected.outreach.text,
                    },
                    ...(selected.followUps ?? []),
                  ].map((m, i) => (
                    <div key={i}>
                      <small>
                        {i === 0 ? "First email" : `Follow-up ${i}`} ·{" "}
                        {new Date(m.sentAt).toLocaleDateString()}
                      </small>
                      <p>{m.text || "(text not recorded)"}</p>
                    </div>
                  ))}
                </details>
              )}
              <p className="dialog-copy">
                Sent from your own mailbox, with a copy in your Sent folder. A
                signature and “reply no thanks to opt out” line are added
                automatically
                {followUpNumber !== null
                  ? ", and it threads under your first email."
                  : ", and the business is marked contacted once sent."}
              </p>
              <div className="dialog-actions">
                <button className="btn" onClick={close} disabled={!!busy}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    !!busy ||
                    !message.trim() ||
                    !selected?.email ||
                    !!selected?.optedOut
                  }
                  onClick={() => void send()}
                >
                  <FiMail />
                  {busy === "send" ? "Sending…" : "Send email"}
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="field-grid">
                {(
                  [
                    ["name", "Business name"],
                    ["address", "Location / address"],
                    ["email", "Email address"],
                    ["phone", "Phone number"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <input
                      autoFocus={key === "name"}
                      type={key === "email" ? "email" : "text"}
                      required={key === "name"}
                      maxLength={
                        key === "name"
                          ? 200
                          : key === "address"
                            ? 500
                            : key === "email"
                              ? 254
                              : 80
                      }
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="field">
                Website
                <input
                  value={draft.website}
                  placeholder="https://example.co.uk"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      website: e.target.value,
                      websiteStatus: e.target.value ? "present" : "unknown",
                    })
                  }
                />
              </label>
              {!draft.website && (
                <label className="field">
                  Website status
                  <select
                    value={draft.websiteStatus}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        websiteStatus: e.target
                          .value as LeadInput["websiteStatus"],
                      })
                    }
                  >
                    <option value="unknown">
                      Website unknown — not checked
                    </option>
                    <option value="absent">
                      Confirmed no website — checked manually
                    </option>
                  </select>
                </label>
              )}
              <label className="field">
                Notes
                <textarea
                  rows={3}
                  maxLength={5000}
                  placeholder="What would make this a good fit?"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
              {panel === "add" && (
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={draft.contacted}
                    onChange={(e) =>
                      setDraft({ ...draft, contacted: e.target.checked })
                    }
                  />{" "}
                  Already contacted
                </label>
              )}
              {panel === "edit" && selected && (
                <div className="business-tools">
                  <div>
                    <FiActivity />
                    <strong>Website performance</strong>
                    <span>
                      {selected.performance
                        ? `Mobile ${selected.performance.mobile ?? "N/A"} / Desktop ${selected.performance.desktop ?? "N/A"}`
                        : "Not checked"}
                    </span>
                  </div>
                  {selected.performance && (
                    <p>
                      Checked{" "}
                      {new Date(
                        selected.performance.checkedAt,
                      ).toLocaleString()}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={!!busy || !selected.website}
                    onClick={() => void checkPerformance(selected)}
                  >
                    {busy === "check" ? "Checking…" : "Run performance check"}
                  </button>
                  <p>
                    Checks use the saved website and only run when requested.
                  </p>
                  <div className="tool-buttons">
                    <button
                      type="button"
                      className="btn btn-small btn-primary"
                      disabled={!!busy}
                      onClick={() => void aiDraft(selected)}
                    >
                      <FiZap />
                      {busy === "draft" ? "Reading their site…" : "AI draft"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!!busy || !selected.email}
                      onClick={() => compose(selected)}
                    >
                      <FiMail /> Write manually
                    </button>
                  </div>
                  <p>
                    AI draft reads their homepage and performance scores, then
                    writes a personal first email for you to edit.
                    {!selected.email &&
                      " If no email is saved, it looks for one on their website."}
                    {selected.website &&
                      !selected.performance &&
                      " Run a performance check first for a sharper draft."}
                  </p>
                  {selected.outreach && (
                    <p className="thread-status">
                      Emailed{" "}
                      {new Date(selected.outreach.sentAt).toLocaleDateString()}
                      {selected.followUps?.length
                        ? ` · ${selected.followUps.length} follow-up${selected.followUps.length > 1 ? "s" : ""} sent`
                        : ""}
                      {selected.repliedAt
                        ? ` · replied ${new Date(selected.repliedAt).toLocaleDateString()}`
                        : (() => {
                            const next = nextFollowUp(selected);
                            return next
                              ? ` · follow-up ${next.number} due ${next.dueAt.toLocaleDateString()}`
                              : "";
                          })()}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    disabled={!!busy}
                    onClick={() => void setOptedOut(selected, !selected.optedOut)}
                  >
                    <FiSlash />
                    {selected.optedOut
                      ? "Allow contacting again"
                      : "Mark do not contact"}
                  </button>
                  <div className="company-check">
                    <FiShield />
                    <strong>Company status</strong>
                    <span className={verifiedCompany(selected) ? "" : "muted"}>
                      {companyLabel(selected)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!!busy}
                    onClick={() =>
                      void patchLead(
                        selected,
                        {
                          verifiedLimited:
                            selected.companyCheck?.status !== "manual",
                        },
                        selected.companyCheck?.status === "manual"
                          ? `${selected.name} will be checked with Companies House again.`
                          : `${selected.name} confirmed as a limited company.`,
                      )
                    }
                  >
                    <FiShield />
                    {selected.companyCheck?.status === "manual"
                      ? "Undo manual confirmation"
                      : "I've confirmed it's a limited company"}
                  </button>
                  <p>
                    Only limited companies can be emailed without consent.
                    Trading names often differ from the registered name, so
                    look them up on{" "}
                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(selected.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Companies House
                    </a>{" "}
                    if the automatic check didn’t find them.
                  </p>
                </div>
              )}
              <div className="dialog-actions">
                {panel === "edit" && selected && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!!busy}
                    onClick={() => void deleteBusiness(selected)}
                  >
                    <FiTrash2 />
                    {busy === "delete" ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button type="button" className="btn" onClick={close}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!!busy}
                >
                  {busy === "save" ? "Saving…" : "Save business"} <FiCheck />
                </button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </div>
  );
}
