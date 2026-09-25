"use client";
import Image from "next/image";
import SectionLink from "./SectionLink";

import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";
export default function Hero() {
  return (
    <section id="home" className="hero wrap">
      <div className="hero-top">
        <span className="eyebrow">Independent web design studio · UK</span>
        <span className="pill">Design with purpose. Built to last.</span>
      </div>
      <h1>
        A better presence.
        <br />
        <em>A lasting impression.</em>
      </h1>
      <div className="hero-bottom">
        <p>
          Bespoke web design, development and website redesign for UK businesses
          ready for their next chapter.
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
        href="https://legxcy.uk"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Legxcy project (opens in a new tab)"
      >
        <Image
          src="/projects/legxcy.webp"
          alt="Legxcy landing page"
          fill
          sizes="100vw"
          priority
        />
        <div className="feature-caption">
          <div>
            <p>Featured Project</p>
            <h2>Legxcy</h2>
          </div>
          <span className="round-arrow">
            <FiArrowUpRight />
          </span>
        </div>
      </a>
    </section>
  );
}
