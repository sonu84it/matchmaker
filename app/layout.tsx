import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PairMuse AI (Prototype)",
  description: "Upload your photo. Meet your AI match.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
