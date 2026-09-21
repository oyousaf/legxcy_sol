"use client";
import Image from "next/image";
import { FiArrowUpRight } from "react-icons/fi";
const projects = [
  [
    "Hxmza",
    "A distinctive home for a car rental business.",
    "hxmza",
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
    "https://astra-ai-six.vercel.app",
  ],
  [
    "Ace Motor Sales",
    "A dealership website with listings and reviews.",
    "ams",
    "https://acemotorsales.uk",
  ],
  [
    "Not3s",
    "A simple space to capture everyday ideas.",
    "not3s",
    "https://not3s.vercel.app",
  ],
  [
    "Pollards",
    "Appointments, organised in one place.",
    "pollards",
    "https://pollards.vercel.app",
  ],
  [
    "Awisee",
    "A link building and digital PR agency site.",
    "awisee",
    "https://awisee.vercel.app",
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
