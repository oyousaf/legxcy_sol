"use client";

import React from "react";
import { motion } from "framer-motion";

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full border-t border-white/10 bg-[color:var(--mossy-bg)] text-[color:var(--foreground)] px-6 py-8 mt-12"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center justify-center gap-3">
        <p className="text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} Legxcy Solutions. All rights
          reserved.
        </p>
        <p className="text-base font-medium">
          A legxcy of innovation, one pixel at a time.
        </p>
      </div>
    </motion.footer>
  );
};

export default Footer;
