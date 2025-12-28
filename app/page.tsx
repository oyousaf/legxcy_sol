import type { Metadata } from "next";
import About from "@/components/About";
import Contact from "@/components/Contact";
import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Services from "@/components/Services";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Modern Web Design & Digital Solutions",
  description:
    "Bespoke websites and digital solutions designed to elevate brands, improve performance, and support business growth.",
};

export default function Home() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <Hero />
      <About />
      <Services />
      <Projects />
      <Contact />
    </>
  );
}
