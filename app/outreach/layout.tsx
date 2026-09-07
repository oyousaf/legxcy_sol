import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Outreach Workspace | Legxcy Solutions" },
  description: "Private business outreach workspace.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/outreach" },
};

export default function OutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
