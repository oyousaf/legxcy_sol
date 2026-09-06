"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ScrollToTop from "./ScrollToTop";
import WhatsAppBubble from "./WhatsappBubble";
import LenisProvider from "@/lib/LenisProvider";
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const privatePage = pathname.startsWith("/outreach");
  useEffect(() => {
    if (pathname !== "/") return;
    const id =
      sessionStorage.getItem("scroll-section") || window.location.hash.slice(1);
    if (window.location.hash)
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    if (id) {
      sessionStorage.removeItem("scroll-section");
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView(),
      );
    }
  }, [pathname]);
  return (
    <MotionConfig reducedMotion="user">
      {privatePage ? (
        children
      ) : (
        <LenisProvider>
          <button
            className="skip-link"
            onClick={() => {
              document.getElementById("main-content")?.focus();
              document.getElementById("main-content")?.scrollIntoView();
            }}
          >
            Skip to content
          </button>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="site-main">
            {children}
          </main>
          <Footer />
          <ScrollToTop />
          <WhatsAppBubble />
        </LenisProvider>
      )}
    </MotionConfig>
  );
}
