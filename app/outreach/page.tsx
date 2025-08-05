"use client";

import { useEffect, useState } from "react";

type SiteData = {
  name: string;
  url: string;
  phone?: string;
  email?: string;
  performanceScore: number | "N/A";
};

export default function OutreachPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);

  // Badge colour logic
  const getBadgeColor = (score: number | "N/A") => {
    if (score === "N/A") return "bg-gray-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 50) return "bg-yellow-600 text-black";
    return "bg-red-600";
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/outdated-sites");
        const data = await res.json();
        setSites(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-[--mossy-bg] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl font-bold mb-6">🍉 Outdated Sites</h1>
        <p className="mb-8 text-lg">
          Here’s a live feed of outdated UK business websites we’ve flagged.
        </p>

        {loading ? (
          <p className="text-xl">Scanning websites…</p>
        ) : (
          <ul className="space-y-6">
            {sites.map((site, i) => (
              <li
                key={i}
                className="p-6 rounded-xl bg-[--dark-mint] shadow-lg text-left"
              >
                <h2 className="text-2xl font-semibold">{site.name}</h2>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[--accent-green] break-all"
                >
                  {site.url}
                </a>

                {site.email && (
                  <p className="mt-2">
                    📧{" "}
                    <a
                      href={`mailto:${site.email}`}
                      className="underline text-[--accent-green]"
                    >
                      {site.email}
                    </a>
                  </p>
                )}

                {site.phone && <p className="mt-2">📞 {site.phone}</p>}

                <p className="mt-4">
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
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
