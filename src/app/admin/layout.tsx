"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Image,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const navGroups = [
  {
    label: "Studio",
    links: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/commissions", label: "Commission queue", icon: Inbox },
      { href: "/admin/artworks", label: "Artwork catalog", icon: Image },
    ],
  },
  {
    label: "Business",
    links: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/audit", label: "Activity", icon: Activity },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    sessionStorage.removeItem("artfolio-studio-expires-at");
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  }, [router]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (response.status === 401) return void handleSignOut();
        if (!response.ok) return;
        const { expiresAt } = await response.json() as { expiresAt: string };
        const remaining = Date.parse(expiresAt) - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) return void handleSignOut();
        sessionStorage.setItem("artfolio-studio-expires-at", expiresAt);
        if (deadlineTimer) clearTimeout(deadlineTimer);
        deadlineTimer = setTimeout(() => void handleSignOut(), remaining);
      } catch {
        const saved = sessionStorage.getItem("artfolio-studio-expires-at");
        if (saved && Date.parse(saved) <= Date.now()) void handleSignOut();
      }
    };
    void check();
    const interval = setInterval(() => void check(), 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, handleSignOut]);

  if (pathname === "/admin/login") return <>{children}</>;

  const activeLabel = navGroups.flatMap((group) => group.links).find((link) =>
    link.href === "/admin" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)
  )?.label || "Studio";

  const navigation = (mobile = false) => (
    <nav aria-label="Studio navigation" className="space-y-7">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{group.label}</p>
          <div className="space-y-1">
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}
                  onClick={() => mobile && setMobileNavOpen(false)}
                  className={`group flex min-h-11 items-center gap-3 border px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    active
                      ? "border-primary/20 bg-primary/[0.08] text-primary"
                      : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.035] hover:text-white/90"
                  }`}>
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#0b0b0a] text-text font-sans selection:bg-primary/25">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-white/[0.08] bg-[#0d0d0c] px-5 py-6 md:flex">
        <Link href="/admin" className="mb-10 flex items-center gap-3 px-2" aria-label="Artfolio Studio overview">
          <span className="font-serif text-[22px] tracking-wide text-white/90">ARTfolio</span>
          <span className="border border-primary/30 px-2 py-1 text-[9px] uppercase leading-tight tracking-[0.16em] text-primary">Studio<br />Portal</span>
        </Link>
        {navigation()}
        <div className="mt-auto space-y-2 border-t border-white/[0.08] pt-5">
          <Link href="/" target="_blank" rel="noreferrer"
            className="flex min-h-11 items-center justify-between px-3 text-xs text-white/55 transition hover:text-primary">
            <span>View public gallery</span><ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <button onClick={handleSignOut}
            className="flex min-h-11 w-full items-center gap-3 border border-transparent px-3 text-left text-xs text-white/55 transition hover:border-red-300/15 hover:bg-red-300/[0.04] hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0b0b0a]/95 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen} aria-controls="studio-mobile-navigation" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                className="inline-flex h-10 w-10 items-center justify-center border border-white/10 text-white/75 transition hover:border-primary/40 hover:text-primary md:hidden">
                {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div className="min-w-0">
                <p className="hidden text-[9px] uppercase tracking-[0.24em] text-white/35 sm:block">Artfolio / Studio</p>
                <p className="truncate text-sm font-medium text-white/85">{activeLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 border border-white/[0.09] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/50 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Private workspace
              </span>
              <Link href="/" target="_blank" rel="noreferrer" aria-label="Open public site in a new tab"
                className="inline-flex h-10 items-center gap-2 border border-white/10 px-3 text-[10px] uppercase tracking-[0.12em] text-white/65 transition hover:border-primary/40 hover:text-primary">
                <span className="hidden sm:inline">Live site</span><ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
          {mobileNavOpen && (
            <div id="studio-mobile-navigation" className="border-t border-white/[0.08] bg-[#0d0d0c] px-4 py-5 md:hidden">
              {navigation(true)}
              <button onClick={handleSignOut} className="mt-6 flex min-h-11 w-full items-center gap-3 border-t border-white/[0.08] pt-4 text-left text-sm text-white/60">
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto min-h-[calc(100vh-68px)] w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-11">
          {children}
        </main>
      </div>
    </div>
  );
}
