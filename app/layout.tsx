import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LenisProvider from "@/lib/LenisProvider";

import { Inter, Geist_Mono } from "next/font/google";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Legxcy Solutions",
  description: "Where Vision Meets Innovation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <LenisProvider>
          <Navbar />
          <ScrollToTop />
          <main className="pt-20">{children}</main>
          <Footer />
        </LenisProvider>
      </body>
    </html>
  );
}
