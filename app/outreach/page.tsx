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

  const getBadgeColor = (score: number | "N/A") => {
    if (score === "N/A") return "bg-gray-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 50) return "bg-yellow-600 text-black";
    return "bg-red-600";
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/outreach");
        const data = await res.json();

        // 🚫 Sort so businesses without a website come first
        const sorted = data.sort((a: SiteData, b: SiteData) => {
          if (a.hasWebsite === b.hasWebsite) return 0;
          return a.hasWebsite ? 1 : -1;
        });

        setSites(sorted);
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
          Here’s a live feed of UK businesses we’ve flagged for potential
          upgrades.
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
                  <p className="text-gray-400 italic">No website listed</p>
                )}

                {site.email && (
                  <p className="mt-2">
                    📧{" "}
                    <a
                      href={`mailto:${site.email}?subject=Your Website Could Use a Refresh&body=Hi ${site.name},%0D%0A%0D%0AI noticed your business could benefit from a modern website. At Legxcy Solutions we build sleek, high-performing websites that boost visibility and conversions.%0D%0A%0D%0AWould you like me to share some ideas tailored to your business?%0D%0A%0D%0ABest regards,%0D%0A[Your Name]`}
                      className="underline text-[--accent-green]"
                    >
                      {site.email}
                    </a>
                  </p>
                )}

                {site.phone && <p className="mt-2">📞 {site.phone}</p>}

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
                        site.email
                          ? `mailto:${site.email}?subject=Let's Build You a Website&body=Hi ${site.name},%0D%0A%0D%0AI noticed your business doesn’t have a website yet. At Legxcy Solutions, we create sleek, professional sites to help businesses thrive online.%0D%0A%0D%0AInterested in a free consultation?%0D%0A%0D%0ABest regards,%0D%0A[Your Name]`
                          : site.profileLink || "#"
                      }
                      target={site.email ? "_self" : "_blank"}
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
