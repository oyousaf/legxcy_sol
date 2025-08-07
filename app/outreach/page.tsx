// app/outreach/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSyncAlt } from "react-icons/fa";

/** Type for business site data */
type SiteData = {
  name: string;
  url: string | null;
  phone?: string | null;
  hasWebsite: boolean;
  profileLink?: string | null;
  performanceScore:
    | {
        mobile: number | "N/A";
        desktop: number | "N/A";
      }
    | "N/A";
  priorityScore: number;
};

export default function OutreachPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacted, setContacted] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<"priority" | "performance" | "website">(
    "priority"
  );
  const [filterBy, setFilterBy] = useState<
    "all" | "noWebsite" | "contacted" | "notContacted"
  >("all");
  const [query, setQuery] = useState("businesses in Ossett");
  const [inputQuery, setInputQuery] = useState(query);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      try {
        const url = `/api/outreach?query=${encodeURIComponent(query)}$${
          forceRefresh ? "&refresh=1" : ""
        }`;
        const res = await fetch(url);
        const data: SiteData[] = await res.json();
        if (!Array.isArray(data)) return setSites([]);
        setSites(data);
        setLastUpdated(new Date().toLocaleString());
      } catch {
        setSites([]);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    async function loadContacted() {
      if (sites.length === 0) return;
      try {
        const names = sites.map((s) => encodeURIComponent(s.name)).join(",");
        const res = await fetch(`/api/contacted?names=${names}`);
        const json: Record<string, boolean> = await res.json();
        setContacted(json);
      } catch {
        setContacted({});
      }
    }
    loadContacted();
  }, [sites]);

  const markAsContacted = async (name: string, value: boolean) => {
    setContacted((prev) => ({ ...prev, [name]: value }));
    try {
      await fetch("/api/contacted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ name, contacted: value }] }),
      });
    } catch {
      setContacted((prev) => ({ ...prev, [name]: !value }));
    }
  };

  const getPerfBadgeColor = (score: number | "N/A") => {
    if (score === "N/A") return "bg-gray-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 50) return "bg-yellow-600 text-black";
    return "bg-red-600";
  };

  const filteredSites = sites.filter((site) => {
    if (filterBy === "noWebsite") return !site.hasWebsite;
    if (filterBy === "contacted") return contacted[site.name];
    if (filterBy === "notContacted") return !contacted[site.name];
    return true;
  });

  const sortedSites = [...filteredSites].sort((a, b) => {
    if (sortBy === "priority") return b.priorityScore - a.priorityScore;
    if (sortBy === "performance") {
      const scoreA =
        a.performanceScore !== "N/A" &&
        typeof a.performanceScore.mobile === "number"
          ? a.performanceScore.mobile
          : -1;
      const scoreB =
        b.performanceScore !== "N/A" &&
        typeof b.performanceScore.mobile === "number"
          ? b.performanceScore.mobile
          : -1;

      return scoreB - scoreA;
    }
    if (sortBy === "website") {
      return Number(a.hasWebsite) - Number(b.hasWebsite);
    }
    return 0;
  });

  const contactedCount = Object.values(contacted).filter(Boolean).length;
  const noWebsiteCount = sites.filter((s) => !s.hasWebsite).length;

  return (
    <main className="flex flex-col items-center justify-center px-6 py-12 bg-[var(--mossy-bg)] min-h-screen">
      <div className="w-full max-w-5xl text-center">
        <motion.h1
          className="text-4xl font-bold mb-4 text-white"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          🍉 Outreach Dashboard
        </motion.h1>

        {lastUpdated && (
          <motion.p
            key={lastUpdated}
            className="text-sm text-gray-400 mb-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            Last updated: {lastUpdated}
          </motion.p>
        )}

        <div className="mb-6 text-md text-white/90">
          🚫 <strong>{noWebsiteCount}</strong> with no website | ✅{" "}
          <strong>{contactedCount}</strong> contacted
        </div>

        {/* search, filters, refresh button */}
        <motion.div
          className="p-5 rounded-xl shadow-lg flex flex-col md:flex-row md:flex-wrap justify-center items-center gap-4 mb-10 border"
          style={{
            backgroundColor: "var(--mossy-bg)",
            borderColor: "var(--accent-green)",
          }}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(inputQuery);
            }}
            className="flex w-full md:w-auto gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search businesses..."
              className="flex-1 px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--dark-mint)",
                borderColor: "var(--accent-green)",
                borderWidth: "1px",
              }}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg font-semibold shadow-md"
              style={{ backgroundColor: "var(--accent-green)" }}
            >
              Search
            </button>
          </form>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "priority" | "performance" | "website"
              )
            }
            className="px-4 py-2 rounded-lg text-white w-full md:w-auto"
            style={{
              backgroundColor: "var(--dark-mint)",
              borderColor: "var(--accent-green)",
              borderWidth: "1px",
            }}
          >
            <option value="priority">Sort by Priority</option>
            <option value="performance">Sort by Performance</option>
            <option value="website">Sort by Website Status</option>
          </select>

          <select
            value={filterBy}
            onChange={(e) =>
              setFilterBy(
                e.target.value as
                  | "all"
                  | "noWebsite"
                  | "contacted"
                  | "notContacted"
              )
            }
            className="px-4 py-2 rounded-lg text-white w-full md:w-auto"
            style={{
              backgroundColor: "var(--dark-mint)",
              borderColor: "var(--accent-green)",
              borderWidth: "1px",
            }}
          >
            <option value="all">Show All</option>
            <option value="noWebsite">No Website Only</option>
            <option value="contacted">Contacted</option>
            <option value="notContacted">Not Contacted</option>
          </select>

          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-md w-full md:w-auto"
            style={{ backgroundColor: "var(--accent-green)" }}
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </motion.div>

        {sortedSites.length === 0 ? (
          <p className="text-xl text-gray-400 italic">
            No businesses match your filters.
          </p>
        ) : (
          <ul className="space-y-6">
            <AnimatePresence>
              {sortedSites.map((site, i) => (
                <motion.li
                  key={site.name}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="p-6 rounded-xl shadow-lg text-left border"
                  style={{
                    backgroundColor: "var(--dark-mint)",
                    borderColor: "var(--accent-green)",
                  }}
                >
                  <div className="flex justify-between items-start flex-col md:flex-row">
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
                              className="underline"
                              style={{ color: "var(--accent-green)" }}
                            >
                              Visit Website
                            </a>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2 mt-4 md:mt-0">
                      {site.performanceScore !== "N/A" ? (
                        <div className="flex gap-2">
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-xs ${getPerfBadgeColor(
                              site.performanceScore.mobile
                            )}`}
                          >
                            📱 {site.performanceScore.mobile}%
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-xs ${getPerfBadgeColor(
                              site.performanceScore.desktop
                            )}`}
                          >
                            🖥️ {site.performanceScore.desktop}%
                          </span>
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
                        <motion.button
                          onClick={() => markAsContacted(site.name, true)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm mt-2"
                        >
                          📬 Mark Contacted
                        </motion.button>
                      ) : (
                        <div className="flex gap-2 mt-2">
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

                  <motion.div
                    className="mt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <a
                      href={site.profileLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1 rounded-full font-bold bg-red-600 hover:bg-red-700"
                    >
                      View Profile
                    </a>
                  </motion.div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </main>
  );
}
