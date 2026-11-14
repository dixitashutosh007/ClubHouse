import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/shell/AppShell";

import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

// Aangan type: Bricolage Grotesque for headings, Plus Jakarta Sans for everything else.
// Self-hosted by next/font; Hindi and Kannada fall back to system fonts (globals.css).
const headingFont = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", variable: "--font-heading" });
const bodyFont = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });

import React from "react";

export const metadata: Metadata = {
  title: "Club House — Your Society's Community App",
  description: "Private community apps for verified residents of your society, starting with RideShare",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Club House",
  },
  // Icons come from app/favicon.ico, app/icon.svg and app/apple-icon.png (the Club House logo)
};

export const viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled for low-vision users (WCAG 1.4.4)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="antialiased bg-ivory min-h-screen text-ink selection:bg-terracotta-tint selection:text-ink">
        <ServiceWorkerRegistration />
        <AuthProvider>
          <ToastProvider>
          <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
