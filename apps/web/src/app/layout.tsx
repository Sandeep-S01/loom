import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loom - AI Workspace",
  description:
    "Loom is a single-user AI workspace with multi-provider chat and a local desktop companion.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/brand/loom-favicon-64.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
