"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSyncAlt, FaFacebook, FaGoogle } from "react-icons/fa";
import Modal from "./Modal";

/* ───────── Types ───────── */

type PerfNumber = number | "N/A";
type PerformanceScore = { mobile: PerfNumber; desktop: PerfNumber } | "N/A";

type SiteData = {
  id: string; // 🔑 unique (place_id)
  name: string;
  url: string | null;
  phone?: string | null;
  hasWebsite: boolean;
  profileLink?: string | null;
  performanceScore: PerformanceScore;
  priorityScore: number;
};

type FilterType = "all" | "noWebsite" | "contacted" | "notContacted";

type ComposeTo = {
  email: string;
  name: string;
  business?: string;
  website?: string;
} | null;

type ContactedMap = Record<string, boolean>;

interface AnalyticsWindow extends Window {
  gtag?: (
    cmd: "event",
    eventName: string,
    params?: Record<string, unknown>
  ) => void;
}

/* ───────── Utilities ───────── */

const badgeColour = (score: PerfNumber) => {
  if (score === "N/A") return "bg-gray-600";
  if (typeof score === "number" && score >= 90) return "bg-green-600";
  if (typeof score === "number" && score >= 50)
    return "bg-yellow-500 text-black";
  return "bg-red-600";
};

function ScoreBadge({ label, value }: { label: string; value: PerfNumber }) {
  return (
    <span
      className={`px-3 py-1 rounded-full font-bold text-xs ${badgeColour(value)}`}
      aria-label={`${label} performance ${value === "N/A" ? "not available" : `${value} percent`}`}
      title={`${label}: ${value === "N/A" ? "N/A" : `${value}%`}`}
    >
      {label} {value === "N/A" ? "N/A" : `${value}%`}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="p-6 rounded-xl border shadow-lg bg-[var(--dark-mint)] border-[var(--accent-green)] animate-pulse">
      <div className="h-6 w-1/3 bg-white/20 rounded mb-3" />
      <div className="h-4 w-1/4 bg-white/10 rounded mb-2" />
      <div className="h-4 w-1/5 bg-white/10 rounded" />
      <div className="mt-6 flex gap-2">
        <div className="h-6 w-20 bg-white/10 rounded-full" />
        <div className="h-6 w-20 bg-white/10 rounded-full" />
      </div>
    </div>
  );
}

/** Narrow, safe coercion of API JSON to SiteData[] */
function coerceSites(input: unknown): SiteData[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((d): SiteData | null => {
      if (!d || typeof d !== "object") return null;
      const obj = d as Record<string, unknown>;

      const id =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id
          : null;
      if (!id) return null;

      const name = typeof obj.name === "string" ? obj.name : "";
      const url =
        typeof obj.url === "string" ? obj.url : obj.url === null ? null : null;
      const phone =
        typeof obj.phone === "string"
          ? obj.phone
          : obj.phone === null
            ? null
            : null;
      const hasWebsite = Boolean(obj.hasWebsite);
      const profileLink =
        typeof obj.profileLink === "string"
          ? obj.profileLink
          : obj.profileLink === null
            ? null
            : undefined;

      let performanceScore: PerformanceScore = "N/A";
      const ps = obj.performanceScore as unknown;
      if (ps && typeof ps === "object") {
        const pso = ps as Record<string, unknown>;
        const mobile: PerfNumber =
          pso.mobile === "N/A"
            ? "N/A"
            : typeof pso.mobile === "number"
              ? pso.mobile
              : typeof pso.mobile === "string" &&
                !Number.isNaN(Number(pso.mobile))
                ? Number(pso.mobile)
                : "N/A";
        const desktop: PerfNumber =
          pso.desktop === "N/A"
            ? "N/A"
            : typeof pso.desktop === "number"
              ? pso.desktop
              : typeof pso.desktop === "string" &&
                !Number.isNaN(Number(pso.desktop))
                ? Number(pso.desktop)
                : "N/A";
        performanceScore = { mobile, desktop };
      }

      const priorityScore =
        typeof obj.priorityScore === "number"
          ? obj.priorityScore
          : typeof obj.priorityScore === "string" &&
            !Number.isNaN(Number(obj.priorityScore))
            ? Number(obj.priorityScore)
            : 0;

      return {
        id,
        name: String(name),
        url,
        phone,
        hasWebsite,
        profileLink,
        performanceScore,
        priorityScore,
      };
    })
    .filter(Boolean) as SiteData[];
}

/* ───────── Component ───────── */

export default function OutreachPage() {
  const initialQuery =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("query") ??
        "businesses in Ossett")
      : "businesses in Ossett";

  const [query, setQuery] = useState<string>(initialQuery);
  const [inputQuery, setInputQuery] = useState<string>(initialQuery);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contacted, setContacted] = useState<ContactedMap>({});
  const [filterBy, setFilterBy] = useState<FilterType>("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [composeOpen, setComposeOpen] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<ComposeTo>(null);
  const [composeMsg, setComposeMsg] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);

      fetchAbortRef.current?.abort();
      const ctrl = new AbortController();
      fetchAbortRef.current = ctrl;

      try {
        const url = `/api/outreach?query=${encodeURIComponent(query)}${
          forceRefresh ? "&refresh=1" : ""
        }`;

        const res = await fetch(url, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

        const json = (await res.json()) as unknown;
        const safe = coerceSites(json);
        setSites(safe);
        setLastUpdated(new Date().toLocaleString());
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSites([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("query", query);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`
      );
    }
    return () => fetchAbortRef.current?.abort();
  }, [fetchData, query]);

  const loadContacted = useCallback(async () => {
    if (!sites.length) return;
    try {
      const names = sites.map((s) => encodeURIComponent(s.name)).join(",");
      const res = await fetch(`/api/contacted?names=${names}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("contacted fetch failed");
      const json = (await res.json()) as ContactedMap;
      setContacted(json);
    } catch {
      setContacted({});
    }
  }, [sites]);

  useEffect(() => {
    loadContacted();
  }, [loadContacted]);

  /** Button path: optimistic → POST → reconcile */
  const markAsContacted = useCallback(
    async (name: string, value: boolean) => {
      setContacted((prev) => ({ ...prev, [name]: value }));
      try {
        const res = await fetch("/api/contacted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: [{ name, contacted: value }] }),
        });
        if (!res.ok) throw new Error("failed");
        await loadContacted();
      } catch {
        setContacted((prev) => ({ ...prev, [name]: !value }));
      }
    },
    [loadContacted]
  );

  const openCompose = useCallback((site: SiteData) => {
    setComposeTo({
      email: "",
      name: site.name,
      business: site.name,
      website: site.url ?? undefined,
    });

    setComposeMsg(
      `I came across your business and noticed you may not currently have a website — or the existing one might be due a modern refresh.\n\n` +
        `At Legxcy Solutions, we design and develop high-performance, bespoke websites tailored to each business’s identity and aspirations.\n\n` +
        `If you're open to a brief chat, I'd be delighted to explore how we can strengthen your online presence.`
    );

    setComposeOpen(true);
  }, []);

  /** Email path: optimistic → POST /api/outreach → reconcile */
  const sendOutreach = useCallback(async () => {
    if (!composeTo?.email) {
      alert("Please add a recipient email.");
      return;
    }

    // optimistic UI
    setContacted((prev) => ({ ...prev, [composeTo.name]: true }));

    try {
      setSending(true);
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.email.trim(),
          name: composeTo.name,
          business: composeTo.business,
          website: composeTo.website,
          message: composeMsg.trim(),
        }),
      });

      const j = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          j && typeof j === "object" && "error" in (j as Record<string, unknown>)
            ? String((j as Record<string, unknown>).error)
            : "Send failed";
        throw new Error(msg);
      }

      // optional analytics
      if (typeof window !== "undefined") {
        const w = window as AnalyticsWindow;
        const recipientDomain = composeTo.email.split("@").pop() ?? "";
        w.gtag?.("event", "outreach_email_sent", {
          recipient_domain: recipientDomain,
          business: composeTo.business || composeTo.name,
        });
      }

      await loadContacted();
      setComposeOpen(false);
    } catch (e) {
      setContacted((prev) => ({ ...prev, [composeTo.name]: false }));
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  }, [composeMsg, composeTo, loadContacted]);

  const filteredSites = useMemo(() => {
    return sites
      .filter((site) => {
        if (filterBy === "noWebsite") return !site.hasWebsite;
        if (filterBy === "contacted") return contacted[site.name];
        if (filterBy === "notContacted") return !contacted[site.name];
        return true;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [sites, filterBy, contacted]);

  const { contactedCount, noWebsiteCount } = useMemo(() => {
    return {
      contactedCount: Object.values(contacted).filter(Boolean).length,
      noWebsiteCount: sites.filter((s) => !s.hasWebsite).length,
    };
  }, [contacted, sites]);

  return (
    <main className="flex flex-col items-center justify-center px-6 py-12 min-h-screen bg-[var(--mossy-bg)]">
      {/* HEADER */}
      <div className="w-full max-w-5xl text-center">
        <motion.h1
          className="text-4xl font-bold mb-4 text-white"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🍉 Outreach Dashboard
        </motion.h1>
        {lastUpdated && (
          <motion.p
            className="text-sm text-gray-300 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Last updated: {lastUpdated}
          </motion.p>
        )}
        <div className="mb-6 text-md text-white/90">
          🚫 <strong>{noWebsiteCount}</strong> with no website | ✅{" "}
          <strong>{contactedCount}</strong> contacted
        </div>
      </div>

      {/* SEARCH / FILTER */}
      <motion.div
        className="p-5 rounded-xl shadow-lg flex flex-col md:flex-row md:flex-wrap justify-center items-stretch gap-3 md:gap-4 mb-10 border bg-[var(--mossy-bg)] border-[var(--accent-green)]/70"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(inputQuery.trim() || "businesses in Ossett");
          }}
          className="flex flex-col sm:flex-row w-full md:w-auto gap-2"
          aria-label="Search businesses"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Search businesses..."
            className="px-4 py-2 rounded-lg text-white text-center placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] w-full sm:w-64 bg-[var(--dark-mint)]/90 border border-[var(--accent-green)]/60"
            aria-label="Search query"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg font-semibold shadow-md text-white bg-[var(--accent-green)] hover:brightness-110 active:scale-95 transition"
          >
            🔍 Search
          </button>
        </form>

        <select
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value as FilterType)}
          className="px-4 py-2 rounded-lg text-white w-full sm:w-56 text-center bg-[var(--dark-mint)]/90 border border-[var(--accent-green)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)]"
        >
          <option value="all">Show All</option>
          <option value="noWebsite">No Website Only</option>
          <option value="contacted">Contacted</option>
          <option value="notContacted">Not Contacted</option>
        </select>

        <motion.button
          onClick={() => fetchData(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-md text-white bg-[var(--accent-green)] hover:brightness-110 active:scale-95 transition"
          whileTap={{ scale: 0.95 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.4 }}
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
        </motion.button>
      </motion.div>

      {/* LIST */}
      <div className="w-full max-w-3xl">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredSites.length === 0 ? (
            <motion.p
              key="no-results"
              className="text-xl text-gray-300 italic text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No businesses match your filters.
            </motion.p>
          ) : (
            <motion.ul
              layout
              className="grid grid-cols-1 gap-6 w-full"
              style={{ scrollbarGutter: "stable" }}
            >
              <AnimatePresence initial={false}>
                {filteredSites.map((site) => (
                  <motion.li
                    key={site.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: 0.05 }}
                    className="p-6 rounded-xl shadow-lg text-left border bg-[var(--dark-mint)] border-[var(--accent-green)]/70"
                  >
                    <div className="flex justify-between items-start flex-col md:flex-row gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold text-white">
                          {site.name}
                        </h2>
                        <div className="text-gray-300 mt-2 space-y-1">
                          {site.phone && <p>📞 {site.phone}</p>}
                          {site.url && (
                            <p>
                              🌐{" "}
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2 hover:opacity-90 text-[var(--accent-green)]"
                              >
                                Visit Website
                              </a>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">
                        {site.performanceScore !== "N/A" &&
                        typeof site.performanceScore === "object" ? (
                          <div className="flex gap-2">
                            <ScoreBadge
                              label="📱"
                              value={site.performanceScore.mobile}
                            />
                            <ScoreBadge
                              label="🖥️"
                              value={site.performanceScore.desktop}
                            />
                          </div>
                        ) : (
                          <span className="px-3 py-1 rounded-full font-bold bg-gray-600 text-xs">
                            No Score
                          </span>
                        )}

                        <span className="px-3 py-1 rounded-full font-bold bg-purple-600">
                          Priority: {site.priorityScore}
                        </span>

                        {!contacted[site.name] ? (
                          <div className="flex gap-2 mt-1">
                            <motion.button
                              onClick={() => openCompose(site)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
                            >
                              ✉️ Send Outreach
                            </motion.button>
                            <motion.button
                              onClick={() => markAsContacted(site.name, true)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                            >
                              📬 Mark Contacted
                            </motion.button>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-1">
                            <span className="px-3 py-1 bg-green-600 rounded text-sm">
                              ✅ Contacted
                            </span>
                            <button
                              onClick={() => markAsContacted(site.name, false)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3 flex-wrap">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          `${site.name} site:facebook.com`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 p-2 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700"
                        aria-label="Search Facebook"
                      >
                        <FaFacebook />
                      </a>
                      <a
                        href={site.profileLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 p-2 rounded-full font-bold bg-red-600 hover:bg-red-700"
                        aria-label="Open Google profile"
                      >
                        <FaGoogle />
                      </a>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* COMPOSE MODAL */}
      <Modal
        open={composeOpen}
        to={composeTo}
        message={composeMsg}
        sending={sending}
        setTo={setComposeTo}
        setMessage={setComposeMsg}
        onClose={() => setComposeOpen(false)}
        onSend={sendOutreach}
      />
    </main>
  );
}
