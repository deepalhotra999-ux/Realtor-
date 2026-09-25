import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dwellwise — Find the place that fits your life", template: "%s · Dwellwise" },
  description:
    "Search homes for sale and rent on an open, free-first marketplace with map search, AI home matching, and collaborative home search.",
  applicationName: "Dwellwise",
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
