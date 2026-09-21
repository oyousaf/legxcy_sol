"use client";
import SectionLink from "./SectionLink";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowUpRight, FiMenu, FiX } from "react-icons/fi";
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    window.addEventListener("keydown", close);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", close);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, []);
  return (
    <header className="nav-shell">
      <nav className="wrap nav-inner" aria-label="Main navigation">
        <Link
          href="/"
          className="brand"
          onClick={(e) => {
            if (pathname !== "/") return;
            e.preventDefault();
            const reduced = window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches;
            if (window.__lenis) window.__lenis.scrollTo(0, { immediate: reduced });
            else window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
          }}
        >
          <Image src="/logo.webp" alt="" width={32} height={32} priority />
          <span>legxcy</span>
          <span>solutions</span>
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
        <div id="main-navigation" className={`nav-links ${open ? "open" : ""}`}>
          {[
            ["Work", "projects"],
            ["Studio", "about"],
            ["Services", "services"],
          ].map(([label, id]) => (
            <SectionLink key={id} id={id} onNavigate={() => setOpen(false)}>
              {label}
            </SectionLink>
          ))}
          <SectionLink
            id="contact"
            className="btn btn-primary"
            onNavigate={() => setOpen(false)}
          >
            Let’s talk <FiArrowUpRight />
          </SectionLink>
        </div>
      </nav>
    </header>
  );
}
