"use client";

import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef } from "react";
import { FaMobileAlt, FaRocket, FaCode, FaSearch } from "react-icons/fa";

// Services data
const services = [
  {
    icon: <FaMobileAlt size={32} />,
    title: "Responsive Design",
    desc: "Layouts that adapt seamlessly for a flawless experience on any device.",
  },
  {
    icon: <FaRocket size={32} />,
    title: "Performance Optimisation",
    desc: "Lightning‑fast sites engineered for efficiency and user delight.",
  },
  {
    icon: <FaCode size={32} />,
    title: "Custom Development",
    desc: "Bespoke solutions tailored to your goals with clean, scalable code.",
  },
  {
    icon: <FaSearch size={32} />,
    title: "SEO Integration",
    desc: "Technical SEO strategies that elevate visibility and conversions.",
  },
];

// Card animation
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" },
  }),
};

export default function Services() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -25]);

  return (
    <section
      ref={ref}
      id="services"
      className="relative min-h-screen px-6 sm:px-12 py-24 overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--mossy-bg)]/95 via-[color:var(--mossy-bg)]/85 to-[color:var(--dark-mint)]/95 -z-10" />

      {/* Floating parallax icons */}
      <motion.div
        style={{ y: y1 }}
        className="absolute top-20 right-12 text-[color:var(--accent-green)] opacity-20 text-7xl pointer-events-none"
      >
        <FaRocket />
      </motion.div>
      <motion.div
        style={{ y: y2 }}
        className="absolute bottom-16 left-10 text-[color:var(--accent-green)] opacity-20 text-6xl pointer-events-none"
      >
        <FaCode />
      </motion.div>

      {/* Section content */}
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-[color:var(--accent-green)] to-teal-200 bg-clip-text text-transparent"
        >
          Our Services
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          viewport={{ once: true }}
          className="text-lg sm:text-xl max-w-2xl mx-auto mb-16 text-[color:var(--foreground)] leading-relaxed"
        >
          Transforming visions into high‑impact digital solutions — designed to
          inspire, perform, and scale with your business.
        </motion.p>

        {/* Service cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((s, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{
                y: -5,
                boxShadow: "0px 14px 28px rgba(0,0,0,0.25)",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-[color:var(--accent-green)] p-7 rounded-2xl shadow-xl transition-all duration-300 group"
            >
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <motion.div
                  whileHover={{ rotate: -3, y: -2 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="text-[color:var(--accent-green)]"
                >
                  {s.icon}
                </motion.div>
              </div>

              {/* Service details */}
              <h3 className="text-xl font-semibold text-white mb-3">
                {s.title}
              </h3>
              <p className="text-[color:var(--foreground)] text-sm sm:text-base">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
