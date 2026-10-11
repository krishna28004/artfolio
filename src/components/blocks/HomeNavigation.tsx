"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Images, PenLine, UserRound,
  type LucideIcon,
} from "lucide-react";

type Destination = { label: string; href: string; icon: LucideIcon };

const destinations: Destination[] = [
  { label: "Exhibition", href: "/exhibition", icon: Images },
  { label: "Learnings", href: "/learning", icon: BookOpen },
  { label: "Commission", href: "/commission", icon: PenLine },
  { label: "About", href: "/#about", icon: UserRound },
];

export function HomeFeatureDock() {
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  const reset = () => {
    for (const item of itemRefs.current) item?.style.setProperty("--dock-scale", "1");
  };

  const magnify = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const item of itemRefs.current) {
      if (!item) continue;
      const bounds = item.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      const proximity = Math.max(0, 1 - Math.abs(event.clientX - center) / 145);
      item.style.setProperty("--dock-scale", (1 + proximity * 0.12).toFixed(3));
    }
  };

  return (
    <nav
      aria-label="Explore Artfolio"
      className="home-feature-dock mx-auto"
      onPointerMove={magnify}
      onPointerLeave={reset}
    >
      {destinations.map(({ label, href, icon: Icon }, index) => (
        <Link
          key={label}
          ref={(element) => { itemRefs.current[index] = element; }}
          href={href}
          aria-current={activeHref === href ? "location" : undefined}
          onClick={() => setActiveHref(href)}
          onBlur={reset}
          className="home-feature-item group relative flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-text/75 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon
            aria-hidden="true"
            size={19}
            strokeWidth={1.5}
            className="home-feature-icon shrink-0 transition-transform duration-300"
          />
          <span className="home-feature-label whitespace-nowrap text-[11px] uppercase tracking-[0.12em]">
            {label}
          </span>
          <span
            aria-hidden="true"
            className="home-feature-active absolute inset-x-3 bottom-1 h-px origin-center scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100"
            style={{ transform: activeHref === href ? "scaleX(1)" : undefined }}
          />
        </Link>
      ))}
    </nav>
  );
}
