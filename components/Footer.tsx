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
      className="w-full text-neutral-100 border-t border-neutral-300 px-6 py-4 mt-12"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center justify-center gap-4">
        <span className="text-neutral-400">
          &copy; {new Date().getFullYear()} Legxcy Solutions. All rights
          reserved.
        </span>
        <span>A legxcy of innovation, one pixel at a time.</span>
      </div>
    </motion.footer>
  );
};

export default Footer;
