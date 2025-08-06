"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type SiteData = {
  name: string;
  url: string | null;
  phone?: string | null;
  rating?: number | "N/A";
  hasWebsite: boolean;
  profileLink?: string | null;
};

export default function OutreachPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacted, setContacted] = useState<Record<string, boolean>>({});
  const updateQueue = useRef<{ name: string; contacted: boolean }[]>([]);
  const flushTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch outreach data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/outreach");
        const data = await res.json();
        if (!Array.isArray(data)) return setSites([]);
        setSites(data);
      } catch {
        setSites([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Batch fetch contacted status
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

  // Queue + batch flush logic
  const flushUpdates = async () => {
    if (updateQueue.current.length === 0) return;

    const updates = [...updateQueue.current];
    updateQueue.current = [];

    try {
      await fetch("/api/contacted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    } catch (err) {
      console.error("❌ Batch update failed:", err);
    }
  };

  const scheduleFlush = () => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushUpdates();
      flushTimer.current = null;
    }, 2000); // flush every 2s
  };

  const markAsContacted = (name: string, value: boolean) => {
    setContacted((prev) => ({ ...prev, [name]: value }));
    updateQueue.current.push({ name, contacted: value });
    scheduleFlush();
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-400">Scanning businesses…</p>
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

        <div className="mb-8 text-md text-white/90">
          🚫 <strong>{noWebsiteCount}</strong> with no website | ✅{" "}
          <strong>{contactedCount}</strong> contacted
        </div>

        {sites.length === 0 ? (
          <p className="text-xl text-gray-400 italic">
            No businesses found for this search.
          </p>
        ) : (
          <ul className="space-y-6">
            <AnimatePresence>
              {sites.map((site, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="p-6 rounded-xl bg-[--dark-mint] shadow-lg text-left"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold">{site.name}</h2>
                      <div className="text-gray-300 mt-2 space-y-1">
                        {site.phone && <p>📞 {site.phone}</p>}
                        {site.rating !== "N/A" && <p>⭐ {site.rating} / 5</p>}
                        {site.url && (
                          <p>
                            🌐{" "}
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-[--accent-green]"
                            >
                              Visit Website
                            </a>
                          </p>
                        )}
                        {!site.phone && site.rating === "N/A" && (
                          <p className="italic">No contact details available</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <AnimatePresence mode="wait" initial={false}>
                        {!contacted[site.name] ? (
                          <motion.button
                            key="mark"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.25 }}
                            onClick={() => markAsContacted(site.name, true)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                          >
                            📬 Mark Contacted
                          </motion.button>
                        ) : (
                          <motion.div
                            key="contacted"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.25 }}
                            className="flex gap-2"
                          >
                            <span className="px-3 py-1 bg-green-600 rounded text-sm">
                              ✅ Contacted
                            </span>
                            <button
                              onClick={() => markAsContacted(site.name, false)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                            >
                              Undo
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <motion.p
                    className="mt-4 flex flex-wrap gap-3 items-center"
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
                      🚫 View Profile
                    </a>
                  </motion.p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </main>
  );
}
