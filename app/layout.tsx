import SiteShell from "@/components/SiteShell";
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { GA_TRACKING_ID } from "@/lib/gtag";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://legxcysol.dev"),
  title: {
    default: "Legxcy Solutions | Modern Web Design & Digital Solutions",
    template: "%s | Legxcy Solutions",
  },
  description:
    "Legxcy Solutions is a digital agency delivering bespoke, high-performance websites and modern web solutions for forward-thinking businesses across the UK and EMEA.",
  alternates: {
    canonical: "https://legxcysol.dev/",
  },
  openGraph: {
    title: "Legxcy Solutions | Modern Web Design & Digital Solutions",
    description:
      "Bespoke websites and digital experiences engineered for performance, clarity, and growth.",
    url: "https://legxcysol.dev",
    siteName: "Legxcy Solutions",
    locale: "en_GB",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Legxcy Solutions – Modern Web Design & Digital Solutions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legxcy Solutions | Digital Agency",
    description:
      "High-performance websites and modern digital solutions for growing businesses.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      {
        url: "/android-chrome-192x192.png",
        type: "image/png",
        sizes: "192x192",
      },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c211b",
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

        {/* Structured Data */}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebDevelopmentService",
              name: "Legxcy Solutions",
              url: "https://legxcysol.dev",
              logo: "https://legxcysol.dev/logo.webp",
              image: "https://legxcysol.dev/og-image.jpg",
              description:
                "Digital agency providing bespoke web design and modern web development solutions for growing businesses.",
              serviceType: "Web Design and Development",
              areaServed: {
                "@type": "AdministrativeArea",
                name: "United Kingdom",
              },
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Business Enquiries",
                email: "info@legxcysol.dev",
                telephone: "+447597866002",
                url: "https://legxcysol.dev",
              },
              sameAs: ["https://www.linkedin.com/company/legxcy-solutions/"],
            }),
          }}
        />
      </head>

      <body
        className={`${inter.variable} ${geistMono.variable} antialiased relative`}
      >
        <SiteShell>{children}</SiteShell>

        <Analytics />
      </body>
    </html>
  );
}
