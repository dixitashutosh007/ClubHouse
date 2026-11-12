import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { TopBarNav } from "@/components/TopBarNav";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const geistSans = { variable: "" };
const geistMono = { variable: "" };

import React, { Suspense } from "react";

export const metadata: Metadata = {
  title: "Club House — Your Society's Community App",
  description: "Private community apps for verified residents of your society, starting with RideShare",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Club House",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-100 min-h-screen text-slate-900 selection:bg-emerald-100 selection:text-emerald-900`}>
        <ServiceWorkerRegistration />
        <AuthProvider>
          <div className="max-w-md mx-auto min-h-screen bg-slate-50 md:my-4 md:min-h-[calc(100vh-2rem)] md:rounded-3xl shadow-2xl shadow-slate-300/60 border border-slate-200/70 flex flex-col justify-between overflow-hidden">
            <TopBarNav />
            <main className="flex-1 flex flex-col">{children}</main>
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
