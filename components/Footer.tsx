"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative w-full px-6 py-10 text-[color:var(--foreground)] overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--dark-mint)]/95 via-[color:var(--dark-mint)]/85 to-[color:var(--mossy-bg)]/95 -z-10" />

      {/* Footer content */}
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center justify-center gap-3 relative z-10">
        <p className="text-sm text-neutral-200">
          &copy; {new Date().getFullYear()} Legxcy Solutions. All rights
          reserved.
        </p>
        <p className="text-base font-medium">
          A legxcy of innovation, one pixel at a time.
        </p>
      </div>
    </motion.footer>
  );
}
