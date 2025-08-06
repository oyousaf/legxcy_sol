"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSyncAlt, FaRedo } from "react-icons/fa";

type SiteData = {
  name: string;
  url: string | null;
  phone?: string | null;
  hasWebsite: boolean;
  profileLink?: string | null;
  performanceScore: number | "N/A";
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

  async function fetchData(forceRefresh = false) {
    setLoading(true);
    try {
      const url = `/api/outreach?query=${encodeURIComponent(query)}${
        forceRefresh ? "&refresh=1" : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (!Array.isArray(data)) return setSites([]);
      setSites(data);
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [query]);

  useEffect(() => {
    async function loadContacted() {
      if (sites.length === 0) return;
      try {
        const names = sites.map((s) => encodeURIComponent(s.name)).join(",");
        const res = await fetch(`/api/contacted?names=${names}`);
        const json = await res.json();
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
      const scoreA = a.performanceScore === "N/A" ? -1 : a.performanceScore;
      const scoreB = b.performanceScore === "N/A" ? -1 : b.performanceScore;
      return scoreB - scoreA;
    }
    if (sortBy === "website") {
      return Number(a.hasWebsite) - Number(b.hasWebsite);
    }
    return 0;
  });

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <motion.p
          className="text-lg text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Scanning businesses…
        </motion.p>
      </main>
    );
  }

  const contactedCount = Object.values(contacted).filter(Boolean).length;
  const noWebsiteCount = sites.filter((s) => !s.hasWebsite).length;

  return (
    <main className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl text-center">
        <motion.h1
          className="text-4xl font-bold mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          🍉 Outreach Dashboard
        </motion.h1>

        <div className="mb-6 text-md text-white/90">
          🚫 <strong>{noWebsiteCount}</strong> with no website | ✅{" "}
          <strong>{contactedCount}</strong> contacted
        </div>

        {/* Search + Filters + Actions */}
        <motion.div
          className="bg-[--mossy-bg] p-5 rounded-xl shadow-lg flex flex-col md:flex-row items-center gap-4 mb-10 border border-[--accent-green]/30"
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
              className="flex-1 px-4 py-2 rounded-lg bg-[--dark-mint] text-white placeholder-gray-400 border border-[--accent-green]/30 focus:outline-none focus:ring-2 focus:ring-[--accent-green]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[--accent-green] hover:bg-green-500 text-sm font-semibold text-black shadow-md"
            >
              Search
            </button>
          </form>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[--dark-mint] text-white px-4 py-2 rounded-lg border border-[--accent-green]/30 focus:outline-none focus:ring-2 focus:ring-[--accent-green]"
          >
            <option value="priority">Sort by Priority</option>
            <option value="performance">Sort by Performance</option>
            <option value="website">Sort by Website Status</option>
          </select>

          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="bg-[--dark-mint] text-white px-4 py-2 rounded-lg border border-[--accent-green]/30 focus:outline-none focus:ring-2 focus:ring-[--accent-green]"
          >
            <option value="all">Show All</option>
            <option value="noWebsite">No Website Only</option>
            <option value="contacted">Contacted</option>
            <option value="notContacted">Not Contacted</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => fetchData(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[--accent-green] hover:bg-green-500 rounded-lg text-sm font-semibold text-black shadow-md"
            >
              <FaSyncAlt /> Refresh
            </button>
            <button
              onClick={() => {
                setSortBy("priority");
                setFilterBy("all");
              }}
              className="flex items-center gap-2 px-3 py-2 bg-[--dark-mint] hover:bg-[--mossy-bg] rounded-lg text-sm font-semibold text-white border border-[--accent-green]/30"
            >
              <FaRedo /> Reset
            </button>
          </div>
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
                  className="p-6 rounded-xl bg-[--dark-mint] shadow-lg text-left border border-[--accent-green]/20"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold">{site.name}</h2>
                      <div className="text-gray-300 mt-2 space-y-1">
                        {site.phone && <p>📞 {site.phone}</p>}
                        {site.url && (
                          <p>
                            🌐{" "}
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-[--accent-green] hover:text-green-400"
                            >
                              Visit Website
                            </a>
                          </p>
                        )}
                        {!site.phone && !site.url && (
                          <p className="italic">No contact details available</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-3 py-1 rounded-full font-bold ${getPerfBadgeColor(
                          site.performanceScore
                        )}`}
                      >
                        {site.performanceScore !== "N/A"
                          ? `${site.performanceScore}%`
                          : "No Score"}
                      </span>
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
                      View Google Profile
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
