export default function OutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[--mossy-bg] text-white">{children}</body>
    </html>
  );
}
