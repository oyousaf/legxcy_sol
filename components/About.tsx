"use client";

import { motion } from "framer-motion";

const highlightItems = [
  {
    title: "Fast Performance",
    desc: "Websites engineered for exceptional speed and responsiveness.",
  },
  {
    title: "Scalable Code",
    desc: "Future-proof architecture that evolves alongside your business.",
  },
  {
    title: "Mobile-First Design",
    desc: "Crafted for clarity and usability on all screen sizes.",
  },
  {
    title: "SEO-Ready",
    desc: "Optimised for discoverability and organic reach.",
  },
];

export default function About() {
  return (
    <section
      id="about"
      className="min-h-screen px-6 sm:px-12 py-24"
    >
      <div className="max-w-5xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-5xl font-bold mb-4"
        >
          About Us
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          viewport={{ once: true }}
          className="text-lg max-w-3xl mx-auto mb-12 text-[color:var(--foreground)]"
        >
          We develop sleek, high-performance websites tailored to your brand’s
          unique identity. Whether you’re launching a new venture or
          revitalising an existing presence, we deliver clean, scalable
          experiences that drive engagement.
        </motion.p>

        <div className="grid gap-8 sm:grid-cols-2">
          {highlightItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-md text-left"
            >
              <h3 className="text-xl font-semibold text-[color:var(--accent-green)] mb-2">
                {item.title}
              </h3>
              <p className="text-[color:var(--foreground)]">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
