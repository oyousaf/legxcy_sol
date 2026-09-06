"use client";
import SectionLink from "./SectionLink";

import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";
export default function Hero() {
  return (
    <section id="home" className="hero wrap">
      <div className="hero-top">
        <span className="eyebrow">Independent digital studio · UK</span>
        <span className="pill">Design with purpose. Built to last.</span>
      </div>
      <h1>
        A better presence.
        <br />
        <em>A lasting impression.</em>
      </h1>
      <div className="hero-bottom">
        <p>
          Distinctive websites and thoughtful digital tools for businesses ready
          for their next chapter.
        </p>
        <div className="hero-actions">
          <SectionLink id="projects" className="btn btn-primary">
            Explore our work <FiArrowDownRight />
          </SectionLink>
          <SectionLink id="contact" className="btn">
            Start a conversation <FiArrowUpRight />
          </SectionLink>
        </div>
      </div>
      <a
        className="feature-project"
        href="https://acemotorsales.uk"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Ace Motor Sales project (opens in a new tab)"
      >
        <video
          src="/projects/ams.webm"
          muted
          playsInline
          loop
          preload="metadata"
          onMouseEnter={(e) => {
            void e.currentTarget.play().catch(() => {});
          }}
          onMouseLeave={(e) => e.currentTarget.pause()}
        />
        <div className="feature-caption">
          <div>
            <p>Featured work / Automotive</p>
            <h2>Ace Motor Sales</h2>
          </div>
          <span className="round-arrow">
            <FiArrowUpRight />
          </span>
        </div>
      </a>
    </section>
  );
}
