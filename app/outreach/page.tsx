"use client";

import { useEffect, useState } from "react";

type SiteData = {
  name: string;
  url: string | null;
  phone?: string | null;
  email?: string | null;
  performanceScore: number | "N/A";
  hasWebsite: boolean;
  profileLink?: string | null;
};

export default function OutreachPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacted, setContacted] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/outreach");
        const data = await res.json();

        if (!Array.isArray(data)) {
          console.warn("⚠️ Outreach API did not return an array:", data);
          setSites([]);
          return;
        }

        const sorted = data.sort((a, b) => (a.hasWebsite ? 1 : -1));
        setSites(sorted);
      } catch (err) {
        console.error("❌ Outreach fetch error:", err);
        setSites([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function loadContacted() {
      const statusMap: Record<string, boolean> = {};
      await Promise.all(
        sites.map(async (site) => {
          const res = await fetch(
            `/api/contacted?name=${encodeURIComponent(site.name)}`
          );
          const json = await res.json();
          statusMap[site.name] = json.contacted ?? false;
        })
      );
      setContacted(statusMap);
    }

    if (sites.length > 0) loadContacted();
  }, [sites]);

  const markAsContacted = async (name: string) => {
    await fetch("/api/contacted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setContacted((prev) => ({ ...prev, [name]: true }));
  };

  const getBadgeColor = (score: number | "N/A") => {
    if (score === "N/A") return "bg-gray-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 50) return "bg-yellow-600 text-black";
    return "bg-red-600";
  };

  const contactedCount = Object.values(contacted).filter(Boolean).length;
  const noWebsiteCount = sites.filter((s) => !s.hasWebsite).length;

  return (
    <main className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl text-center">
        <h1 className="text-4xl font-bold mb-6">🍉 Outreach Dashboard</h1>

        <div className="mb-8 text-md text-white/90">
          🚫 <strong>{noWebsiteCount}</strong> with no website | ✅{" "}
          <strong>{contactedCount}</strong> contacted
        </div>

        {loading ? (
          <p className="text-xl">Scanning websites…</p>
        ) : sites.length === 0 ? (
          <p className="text-xl text-gray-400 italic">
            No businesses found for this search.
          </p>
        ) : (
          <ul className="space-y-6">
            {sites.map((site, i) => (
              <li
                key={i}
                className="p-6 rounded-xl bg-[--dark-mint] shadow-lg text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                      {site.name}
                      {site.profileLink && (
                        <a
                          href={site.profileLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-300 underline"
                        >
                          View on Maps
                        </a>
                      )}
                    </h2>

                    {site.hasWebsite && site.url ? (
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-[--accent-green] break-all"
                      >
                        {site.url}
                      </a>
                    ) : (
                      <div className="text-gray-300 mt-2">
                        <p className="italic">No website listed</p>
                        {site.phone && <p>📞 {site.phone}</p>}
                        {site.email && (
                          <p>
                            📧{" "}
                            <a
                              href={`mailto:${site.email}`}
                              className="underline text-[--accent-green]"
                            >
                              {site.email}
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {hydrated &&
                      (!contacted[site.name] ? (
                        <button
                          onClick={() => markAsContacted(site.name)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          📬 Mark Contacted
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-green-600 rounded text-sm">
                          ✅ Contacted
                        </span>
                      ))}
                  </div>
                </div>

                <p className="mt-4">
                  {site.hasWebsite ? (
                    <>
                      Performance Score:{" "}
                      <span
                        className={`inline-block px-3 py-1 rounded-full font-bold ${getBadgeColor(
                          site.performanceScore
                        )}`}
                      >
                        {site.performanceScore !== "N/A"
                          ? `${site.performanceScore}%`
                          : "Not available"}
                      </span>
                    </>
                  ) : (
                    <a
                      href={
                        site.profileLink ||
                        (site.email ? `mailto:${site.email}` : "#")
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1 rounded-full font-bold bg-red-600 hover:bg-red-700"
                    >
                      🚫 No Website
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
