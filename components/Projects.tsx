"use client";
import Image from "next/image";
import { FiArrowUpRight } from "react-icons/fi";
const projects = [
  [
    "ECAMS",
    "An eco-led site for a cleaning and maintenance company.",
    "ecams",
    "https://ecams.legxcysol.dev",
  ],
  [
    "huni",
    "A honey hair and body care brand with live pollinator data.",
    "huni",
    "https://huni.legxcysol.dev",
  ],
  [
    "Kanestone",
    "A cinematic showroom for a British luxury car supplier.",
    "kanestone",
    "https://kanestone.legxcysol.dev",
  ],
  [
    "Ellipsis",
    "Machine-learning pollution data for councils and classrooms.",
    "ellipsis",
    "https://ellipsis.legxcysol.dev",
  ],
  [
    "Hecky Travel",
    "Flights, holidays and Hajj & Umrah packages.",
    "htravel",
    "https://heckytravel.uk",
  ],
  [
    "Awisee",
    "A link building and digital PR agency site.",
    "awisee",
    "https://awisee.legxcysol.dev",
  ],
  [
    "Beds4U",
    "A fully fledged e-commerce storefront for a British bed manufacturer.",
    "hxmza",
    "https://saeed.hxmza.uk",
  ],
  [
    "Hxmza",
    "A distinctive home for a car rental business.",
    "hxmza-hub",
    "https://hxmza.uk",
  ],
  [
    "Legxcy",
    "An eCommerce experience built around the brand.",
    "legxcy",
    "https://legxcy.uk",
  ],
  [
    "Astra AI",
    "A clearer way to manage job applications.",
    "astra",
    "https://astra-ai.legxcysol.dev",
  ],
  [
    "Ace Motor Sales",
    "A dealership website with listings and reviews.",
    "ams",
    "https://acemotorsales.uk",
  ],
  [
    "Unlock Your Potential",
    "A charity championing social mobility through mentorship.",
    "uyp",
    "https://uyp.legxcysol.dev",
  ],
  [
    "Not3s",
    "A simple space to capture everyday ideas.",
    "not3s",
    "https://notes.legxcysol.dev",
  ],
  [
    "Pollards",
    "Appointments, organised in one place.",
    "pollards",
    "https://pollards.legxcysol.dev",
  ],
];
export default function Projects() {
  return (
    <section id="projects" className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">03 / Selected work</span>
            <h2>
              Different ambitions.
              <br />
              The same care.
            </h2>
          </div>
          <p>
            A selection of websites and applications, each shaped around a
            different challenge.
          </p>
        </div>
        <div className="project-grid">
          {projects.map(([name, desc, file, url]) => (
            <article key={file}>
              <a
                className="project-media"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${name} (opens in a new tab)`}
              >
                <Image
                  src={`/projects/${file}.webp`}
                  alt={`${name} landing page`}
                  fill
                  sizes="(max-width: 800px) 100vw, 50vw"
                />
                <span className="round-arrow">
                  <FiArrowUpRight />
                </span>
              </a>
              <div className="project-info">
                <h3>{name}</h3>
                <p>{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
