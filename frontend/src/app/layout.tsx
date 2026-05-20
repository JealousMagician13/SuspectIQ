// Shared Next.js layout that wraps every page and defines the page metadata.
import type { Metadata } from "next";
import "./globals.css";

// Metadata controls the browser title and description for this Next.js page.
export const metadata: Metadata = {
  title: "CCTV Camera Scrollytelling",
  description: "A canvas-based exploded camera scroll sequence.",
};

// Provides the root HTML structure that Next.js uses around every page.
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
