"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The 3D virtual exhibition at /exhibition is an immersive full-viewport WebGL experience.
  // It provides its own dedicated in-gallery HUD, controls, and exit navigation.
  const is3DExhibition = pathname === "/exhibition";

  // Admin section has its own layout and header in src/app/admin/layout.tsx
  const isAdmin = pathname.startsWith("/admin");

  if (is3DExhibition) {
    return (
      <main className="w-full h-full min-h-screen overflow-hidden">
        {children}
      </main>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen flex flex-col flex-1">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col flex-1">
      <Navbar />
      <main className="flex-1 flex flex-col pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
