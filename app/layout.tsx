import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LenisProvider from "@/lib/LenisProvider";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { GA_TRACKING_ID } from "@/lib/gtag";
import WhatsAppBubble from "@/components/WhatsappBubble";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://legxcysol.dev"),
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
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
        {/* Preconnect for Google Fonts */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />

        {/* Preload Logo */}
        <link
          rel="preload"
          href="/logo.webp"
          as="image"
          type="image/png"
          fetchPriority="high"
        />

        {/* Google Analytics */}
        {GA_TRACKING_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}

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
              logo: "https://legxcysol.dev/logo.webp",
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
          <WhatsAppBubble />
          <main className="pt-20">{children}</main>
          <Footer />
        </LenisProvider>
        <Analytics />
      </body>
    </html>
  );
}
