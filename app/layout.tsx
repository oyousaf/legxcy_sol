import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LenisProvider from "@/lib/LenisProvider";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Legxcy Solutions",
  description: "Where Vision Meets Innovation",
  keywords: [
    "Freelance web developer UK",
    "Next.js developer EMEA",
    "Responsive website design",
    "Modern web development services",
    "Custom business websites",
    "Legxcy Solutions digital agency",
    "Frontend developer UK",
    "Web development for startups",
    "Bespoke websites EMEA",
    "SEO-optimised websites",
    "UX/UI design for SMEs",
    "Professional website builder UK",
    "React and Next.js developer",
    "Mobile-first web design",
    "High-performance websites",
  ],
  metadataBase: new URL("https://legxcysol.dev"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Legxcy Solutions",
    description: "Bespoke websites crafted for impact.",
    url: "https://legxcysol.dev",
    siteName: "Legxcy Solutions",
    locale: "en_GB",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Legxcy Solutions – Where Vision Meets Innovation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legxcy Solutions",
    description: "Where Vision Meets Innovation",
    images: ["/og-image.jpg"],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f2f23",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data for SEO */}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              name: "Legxcy Solutions",
              url: "https://legxcysol.dev",
              logo: "https://legxcysol.dev/logo.png",
              image: "https://legxcysol.dev/og-image.jpg",
              description:
                "Freelance web development service offering bespoke, modern, high-performance websites for UK and EMEA businesses.",
              areaServed: [
                "United Kingdom",
                "Europe, Middle East, and Africa (EMEA)",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Support",
                email: "info@legxcysol.dev",
                telephone: "+447597866002",
                url: "https://legxcysol.dev",
              },
              sameAs: ["https://legxcysol.dev"],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <LenisProvider>
          <Navbar />
          <ScrollToTop />
          <main className="pt-20">{children}</main>
          <Footer />
        </LenisProvider>
        <Analytics />
      </body>
    </html>
  );
}
