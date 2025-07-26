"use client";

import { motion } from "framer-motion";
import { FaMobileAlt, FaRocket, FaCode, FaSearch } from "react-icons/fa";

const services = [
  {
    icon: <FaMobileAlt size={28} />,
    title: "Responsive Design",
    desc: "Seamlessly adaptive layouts optimised for all devices and screen sizes.",
  },
  {
    icon: <FaRocket size={28} />,
    title: "Performance Optimisation",
    desc: "Lightning-fast websites engineered for speed, efficiency, and user experience.",
  },
  {
    icon: <FaCode size={28} />,
    title: "Custom Development",
    desc: "Bespoke solutions tailored to your brand, goals, and user needs.",
  },
  {
    icon: <FaSearch size={28} />,
    title: "SEO Integration",
    desc: "Technical SEO implementations to enhance visibility and organic reach.",
  },
];

export default function Services() {
  return (
    <section
      id="services"
      className="min-h-screen px-6 sm:px-12 py-24"
    >
      <div className="max-w-6xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-5xl font-bold mb-4"
        >
          Our Services
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          viewport={{ once: true }}
          className="text-lg max-w-2xl mx-auto mb-12 text-[color:var(--foreground)]"
        >
          Comprehensive web development services that combine aesthetic
          excellence with robust, scalable engineering — designed to generate
          tangible business outcomes.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl text-left shadow-lg hover:scale-[1.02] transition-transform"
            >
              <div className="text-[color:var(--accent-green)] mb-3">
                {service.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
              <p className="text-[color:var(--foreground)]">{service.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
