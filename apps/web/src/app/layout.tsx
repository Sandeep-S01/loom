import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loom — AI Workspace",
  description:
    "Loom is a single-user AI workspace with multi-provider chat and a local desktop companion.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
