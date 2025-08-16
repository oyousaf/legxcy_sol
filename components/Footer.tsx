"use client";

import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { trackWhatsAppClick } from "@/lib/gtag";

export default function Footer() {
  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackWhatsAppClick();
    window.open("https://wa.me/447597866002", "_blank");
  };

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative w-full px-6 py-10 text-[var(--foreground)] overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--dark-mint)]/95 via-[var(--dark-mint)]/85 to-[var(--mossy-bg)]/95 -z-10" />

      {/* Footer content */}
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center justify-center gap-3 relative z-10">
        <p className="text-sm text-neutral-200">
          &copy; {new Date().getFullYear()} Legxcy Solutions. All rights
          reserved.
        </p>
        <p className="text-base font-medium">
          A legxcy of innovation, one pixel at a time.
        </p>

        {/* WhatsApp link (tracked) */}
        <a
          href="https://wa.me/447597866002"
          aria-label="Message us on WhatsApp"
          onClick={handleWhatsAppClick}
          className="flex items-center gap-2 mt-4 text-green-400 hover:text-green-500 transition"
        >
          <FaWhatsapp size={20} />
          <span>Chat with us on WhatsApp</span>
        </a>
      </div>
    </motion.footer>
  );
}
