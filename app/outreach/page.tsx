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
} from "react-icons/fi";
import {
  emptyLead,
  identity,
  type Lead,
  type LeadInput,
} from "@/lib/leads/model";
import { makeCsv, parseCsv } from "@/lib/leads/csv";
import Dialog from "./components/Dialog";
import "./outreach.css";
type Panel = "add" | "import" | "edit" | "compose" | null;
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
    [category, setCategory] = useState("all"),
    [discovered, setDiscovered] = useState<LeadInput[]>([]),
    [discoveryDone, setDiscoveryDone] = useState(false),
    [discoveryLabel, setDiscoveryLabel] = useState(""),
    [chosen, setChosen] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState(""),
    [requestId, setRequestId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = leads.find((l) => l.id === selectedId);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ leads: Lead[]; storage: string }>("/api/leads");
      setLeads(data.leads);
      setStorage(data.storage);
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
        .filter(
          (l) =>
            filter === "all" ||
            (filter === "contacted" && l.contacted) ||
            (filter === "new" && !l.contacted) ||
            (filter === "unknown" && l.websiteStatus === "unknown") ||
            (filter === "absent" && l.websiteStatus === "absent"),
        ),
    [leads, query, filter],
  );
  const savedIdentities = useMemo(() => new Set(leads.map(identity)), [leads]);
  function close() {
    if (busy === "save" || busy === "send") return;
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
        { id: selectedId, message, requestId },
      );
      if (data.lead) updateInList(data.lead);
      setNotice(
        data.warning || "Email accepted and business marked contacted.",
      );
      setPanel(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="workspace">
      <aside className="work-sidebar">
        <Link className="brand" href="/">
          <Image src="/logo.webp" width={30} height={30} alt="" />
          <span>legxcy</span>
          <span>studio</span>
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>Private</span>
        </div>
        <nav aria-label="Workspace">
          <button
            className={view === "leads" ? "active" : ""}
            onClick={() => {
              setView("leads");
              setError("");
            }}
          >
            <FiGrid /> Businesses <span>{leads.length}</span>
          </button>
          <button
            className={view === "discover" ? "active" : ""}
            onClick={() => {
              setView("discover");
              setError("");
            }}
          >
            <FiCompass /> Discover nearby
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
        <Link className="back-link" href="/">
          <FiArrowLeft /> Back to website
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
                    "Needs a closer look",
                    leads.filter((l) => l.websiteStatus === "unknown").length,
                    "Website unknown",
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
                      ["new", "Not contacted"],
                      ["contacted", "Contacted"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={filter === key ? "selected" : ""}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All businesses</option>
                    <option value="new">Not contacted</option>
                    <option value="contacted">Contacted</option>
                    <option value="unknown">Website unknown</option>
                    <option value="absent">Confirmed no website</option>
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
                              setFilter("all");
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
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                  >
                    <option>Ossett</option>
                    <option>Wakefield</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="category">Type of business</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">Shops, food & services</option>
                    <option value="shops">Shops</option>
                    <option value="food">Food & drink</option>
                    <option value="services">Services</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => void discover()}
                  disabled={!!busy}
                >
                  <FiSearch />{" "}
                  {busy === "discover" ? "Searching…" : "Discover businesses"}
                </button>
              </div>
              <p className="discovery-help">
                Up to 50 results within 2.5 km. Missing website details mean
                “unknown”—please verify before reaching out.
              </p>
              {discoveryDone ? (
                <>
                  <div className="discovery-summary">
                    <h2>
                      {discovered.length} businesses around {discoveryLabel}
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
                    {discovered.map((lead, i) => {
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
                  {!discovered.length && (
                    <div className="work-empty">
                      No named businesses found. Try another category.
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
                : panel === "import"
                  ? "Bring your list with you."
                  : "Start a conversation"
          }
          onClose={close}
        >
          {formError && (
            <div className="work-alert" role="alert">
              {formError}
            </div>
          )}
          {panel === "import" ? (
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
                To {selected?.name} · {selected?.email}
              </p>
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
              <p className="dialog-copy">
                The business is marked contacted after the email is accepted.
              </p>
              <div className="dialog-actions">
                <button className="btn" onClick={close} disabled={!!busy}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!!busy || !message.trim()}
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
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={!!busy || !selected.email}
                    onClick={() => {
                      setMessage(
                        `Hi,\n\nI came across ${selected.name} and wanted to introduce Legxcy Solutions. We design and develop websites for local businesses.\n\nWould you be open to a short conversation about your website?\n\nBest regards,\nLegxcy Solutions`,
                      );
                      setRequestId(crypto.randomUUID());
                      setFormError("");
                      setPanel("compose");
                    }}
                  >
                    <FiMail /> Compose email
                  </button>
                  {!selected.email && (
                    <p>Save an email address to compose outreach.</p>
                  )}
                </div>
              )}
              <div className="dialog-actions">
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
