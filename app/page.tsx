import { site, homeStructuredData } from "@/lib/site";
import type { Metadata } from "next";
import About from "@/components/About";
import Contact from "@/components/Contact";
import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Services from "@/components/Services";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: { absolute: `${site.title} | ${site.name}` },
  description: site.description,
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData).replace(/</g, "\\u003c") }}
      />
      <Toaster richColors position="top-center" />
      <Hero />
      <About />
      <Services />
      <Projects />
      <Contact />
    </>
  );
}
