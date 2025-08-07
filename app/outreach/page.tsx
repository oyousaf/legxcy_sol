"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSyncAlt, FaFacebook } from "react-icons/fa";

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
  const initialQuery =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("query") ??
        "businesses in Ossett")
      : "businesses in Ossett";

  const [query, setQuery] = useState(initialQuery);
  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacted, setContacted] = useState<Record<string, boolean>>({});
  const [filterBy, setFilterBy] = useState<
    "all" | "noWebsite" | "contacted" | "notContacted"
  >("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      try {
        const url = `/api/outreach?query=${encodeURIComponent(query)}${forceRefresh ? "&refresh=1" : ""}`;
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("query", query);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, [fetchData, query]);

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

  const filteredSites = sites
    .filter((site) => {
      if (filterBy === "noWebsite") return !site.hasWebsite;
      if (filterBy === "contacted") return contacted[site.name];
      if (filterBy === "notContacted") return !contacted[site.name];
      return true;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

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

        <motion.div
          className="p-5 rounded-xl shadow-lg flex flex-col md:flex-row md:flex-wrap justify-center items-stretch gap-3 md:gap-4 mb-10 border"
          style={{
            backgroundColor: "var(--mossy-bg)",
            borderColor: "var(--accent-green)",
          }}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(inputQuery);
            }}
            className="flex flex-col sm:flex-row w-full md:w-auto gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search businesses..."
              className="px-4 py-2 rounded-lg text-white text-center placeholder-gray-200 focus:outline-none focus:ring-2 w-full sm:w-64"
              style={{
                backgroundColor: "var(--dark-mint)",
                borderColor: "var(--accent-green)",
                borderWidth: "1px",
              }}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg font-semibold shadow-md w-full sm:w-auto text-white"
              style={{
                backgroundColor: "var(--accent-green)",
                transition: "background-color 0.2s ease-in-out",
              }}
            >
              🔍 Search
            </button>
          </form>

          {/* Filter */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="px-4 py-2 rounded-lg text-white w-full sm:w-56 text-center"
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
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-md text-white w-full sm:w-auto"
            style={{ backgroundColor: "var(--accent-green)" }}
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </motion.div>

        {/* List */}
        {filteredSites.length === 0 ? (
          <p className="text-xl text-gray-400 italic">
            No businesses match your filters.
          </p>
        ) : (
          <motion.ul
            layout
            className="space-y-6"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ minHeight: "900px" }}
          >
            <AnimatePresence initial={false}>
              {filteredSites.map((site, i) => (
                <motion.li
                  key={site.name}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, delay: i * 0.03 }}
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
                      {site.performanceScore !== "N/A" &&
                      typeof site.performanceScore === "object" ? (
                        <div className="flex gap-2">
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-xs ${getPerfBadgeColor(site.performanceScore.mobile)}`}
                          >
                            📱 {site.performanceScore.mobile}%
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-xs ${getPerfBadgeColor(site.performanceScore.desktop)}`}
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
                    className="mt-4 flex gap-3 flex-wrap"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <a
                      href={site.profileLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold bg-red-600 hover:bg-red-700"
                    >
                      View Profile
                    </a>

                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${site.name} ${query} site:facebook.com`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700"
                    >
                      <FaFacebook />
                    </a>
                  </motion.div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </main>
  );
}
