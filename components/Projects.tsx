"use client";

import { motion } from "framer-motion";

const projects = [
  {
    name: "Hxmza",
    desc: "A stylish, mobile-first car rental platform with a clean UI and seamless booking flow.",
    video: "/projects/hxmza.mkv",
    link: "https://hxmza.uk",
  },
  {
    name: "Legxcy",
    desc: "A full-stack eCommerce platform designed for scalability, clarity, and conversion.",
    video: "/projects/legxcy.mkv",
    link: "https://legxcy.uk",
  },
  {
    name: "Astra-AI",
    desc: "An intelligent web app to help you track and manage your job applications effectively.",
    video: "/projects/astra.mkv",
    link: "https://astra-ai-six.vercel.app",
  },
  {
    name: "AMS",
    desc: "A modern, professional car dealership website with live listings and verified reviews.",
    video: "/projects/ams.mkv",
    link: "https://acemotorsales.uk",
  },
  {
    name: "Not3s",
    desc: "A simple sticky notes app",
    video: "/projects/not3s.mp4",
    link: "https://not3s.vercel.app",
  },
  {
    name: "Pollards",
    desc: "A full stack appointment management system",
    video: "/projects/pollards.mp4",
    link: "https://",
  },
];

export default function Projects() {
  return (
    <section
      id="projects"
      className="min-h-screen px-6 sm:px-12 py-24"
      style={{ backgroundColor: "var(--mossy-bg)", color: "var(--foreground)" }}
    >
      <div className="max-w-6xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-5xl font-bold mb-4"
        >
          Projects
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          viewport={{ once: true }}
          className="text-lg text-[color:var(--foreground)] mb-12 max-w-2xl mx-auto"
        >
          A selection of bespoke projects we’ve recently developed — from
          elegant single page sites to full-stack business platforms.
        </motion.p>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              viewport={{ once: true }}
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden shadow-lg text-left hover:scale-[1.02] transition-transform"
            >
              <div className="w-full h-48 relative overflow-hidden">
                <motion.video
                  src={project.video}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  loop
                  preload="metadata"
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                  initial={{ opacity: 0.9, scale: 1 }}
                  whileHover={{ opacity: 1, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {project.name}
                </h3>
                <p className="text-[color:var(--foreground)] mb-4">
                  {project.desc}
                </p>
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[color:var(--accent-green)] hover:underline"
                  >
                    View Project →
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
