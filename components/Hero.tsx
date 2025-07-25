"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  const handleSmoothScroll = () => {
    const target = document.querySelector("#contact");
    const lenis = (window as any).lenis;

    if (target && lenis) {
      lenis.scrollTo(target);
    }
  };

  return (
    <section
      id="home"
      className="relative w-full h-screen flex items-center justify-center text-white"
    >
      <Image
        src="/banner.webp"
        alt="Banner"
        fill
        priority
        style={{ objectFit: "cover" }}
        className="absolute z-0 brightness-[0.35]"
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 p-6 sm:p-12 backdrop-blur-md bg-white/10 border border-white/10 rounded-xl max-w-2xl mx-4 text-center"
      >
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Legxcy Solutions Logo"
            width={80}
            height={80}
          />
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-4xl md:text-6xl font-bold text-white"
        >
          Where Vision Meets Innovation
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-4 text-lg text-gray-200"
        >
          Bespoke websites engineered for performance and clarity — responsive
          by design, and built to elevate your digital presence.
        </motion.p>

        <motion.button
          onClick={handleSmoothScroll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-block mt-6 px-6 py-3 bg-[color:var(--accent-green)] cursor-pointer text-white rounded-md font-semibold shadow-md transition"
        >
          Request a Free Audit
        </motion.button>
      </motion.div>
    </section>
  );
}
