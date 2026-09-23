"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Do not wrap login page with the admin navigation
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  };

  const navLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/commissions", label: "Commissions Queue" },
    { href: "/admin/artworks", label: "Artwork Catalog" },
  ];

  return (
    <div className="min-h-screen bg-background text-text flex flex-col font-sans">
      {/* Admin Top Bar */}
      <header className="border-b border-outline-variant/20 bg-surface-highest/5 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="font-serif text-lg tracking-wider text-text font-medium">ARTfolio</span>
              <span className="text-[9px] uppercase tracking-[0.25em] px-2 py-0.5 border border-primary/40 text-primary">
                Curator CMS
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-[12px] tracking-[0.15em] uppercase transition-colors ${
                      isActive ? "text-primary font-semibold border-b border-primary pb-1" : "text-muted hover:text-text"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="text-[11px] uppercase tracking-widest text-muted hover:text-text transition-colors"
            >
              Live Site &nearr;
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-1.5 border border-outline-variant/30 text-[11px] uppercase tracking-widest text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
