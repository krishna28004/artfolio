"use client";
import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from "react";
import { CarouselCard } from "./CarouselCard";
import type { Artwork } from "@/features/artwork/data/artworks";

/* ──────────────────────────── Constants ──────────────────────────── */

interface BreakpointConfig {
  cardWidth: number;
  cardHeight: number;
  gap: number;
  perspective: number;
  maxRotateY: number;
  maxTranslateZ: number;
  speed: number;
}

function getConfig(viewportWidth: number): BreakpointConfig {
  if (viewportWidth >= 1440) {
    return { cardWidth: 280, cardHeight: 373, gap: 20, perspective: 1200, maxRotateY: 35, maxTranslateZ: 50, speed: 40 };
  }
  if (viewportWidth >= 1024) {
    return { cardWidth: 260, cardHeight: 347, gap: 20, perspective: 1000, maxRotateY: 30, maxTranslateZ: 45, speed: 35 };
  }
  if (viewportWidth >= 768) {
    return { cardWidth: 220, cardHeight: 293, gap: 16, perspective: 800, maxRotateY: 25, maxTranslateZ: 40, speed: 30 };
  }
  return { cardWidth: 200, cardHeight: 267, gap: 14, perspective: 600, maxRotateY: 20, maxTranslateZ: 35, speed: 25 };
}

/* ──────────────────────────── Component ──────────────────────────── */

interface CarouselStripProps {
  artworks: Artwork[];
}

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerReducedMotion = () => false;

export function CarouselStrip({ artworks }: CarouselStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const offsetRef = useRef(0);
  const isFocusPausedRef = useRef(false);
  const isManuallyPausedRef = useRef(false);
  const [config, setConfig] = useState<BreakpointConfig>(() => getConfig(1440));

  // Reduced-motion check
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);

  // Responsive config update on resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setConfig(getConfig(window.innerWidth));
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    const initialFrame = requestAnimationFrame(handleResize);
    return () => {
      cancelAnimationFrame(initialFrame);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const totalCards = artworks.length;
  const stripWidth = totalCards * (config.cardWidth + config.gap);

  // Per-card perspective transform
  const updateCardTransforms = useCallback(
    (currentOffset: number, flat = false) => {
      if (typeof window === "undefined") return;
      const viewportCenter = window.innerWidth / 2;
      const cards = cardRefs.current;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;
        if (flat) { card.style.transform = "none"; continue; }

        // Card center in viewport coordinates
        const cardCenter =
          currentOffset + i * (config.cardWidth + config.gap) + config.cardWidth / 2;

        // Normalize to -1..+1 range relative to viewport
        const normalizedX = (cardCenter - viewportCenter) / viewportCenter;
        const clampedX = Math.max(-1.5, Math.min(1.5, normalizedX));

        const rotateY = clampedX * config.maxRotateY;
        const scale = 1 - Math.abs(clampedX) * 0.12;
        const translateZ = -Math.abs(clampedX) * config.maxTranslateZ;

        card.style.transform = `perspective(${config.perspective}px) rotateY(${rotateY}deg) scale(${scale}) translateZ(${translateZ}px)`;
      }
    },
    [config]
  );

  // Main animation loop
  useEffect(() => {
    if (reducedMotion || totalCards < 3) return;

    let animationId: number;
    let lastTimestamp = 0;
    let needsInitialPaint = true;

    const animate = (timestamp: number) => {
      if (lastTimestamp === 0) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Prevent giant delta when returning from background tab
      const safeDelta = Math.min(delta, 0.1);

      const moving = !isFocusPausedRef.current && !isManuallyPausedRef.current && !document.hidden;
      if (moving) {
        offsetRef.current -= config.speed * safeDelta;

        // Seamless reset: when we've scrolled one full set, reset
        if (Math.abs(offsetRef.current) >= stripWidth) {
          offsetRef.current = offsetRef.current % stripWidth;
        }
      }

      if (moving || needsInitialPaint) {
        if (stripRef.current) {
          stripRef.current.style.transform = `translateX(${offsetRef.current}px)`;
        }
        updateCardTransforms(offsetRef.current);
        needsInitialPaint = false;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [reducedMotion, config.speed, stripWidth, totalCards, updateCardTransforms]);

  // Static card transforms for reduced-motion or initialization
  useEffect(() => {
    if (reducedMotion || totalCards < 3) {
      offsetRef.current = 0;
      if (stripRef.current) stripRef.current.style.transform = "translateX(0)";
      updateCardTransforms(0, true);
    }
  }, [reducedMotion, totalCards, updateCardTransforms]);

  // Pause button state
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const togglePause = useCallback(() => {
    setIsManuallyPaused((prev) => {
      isManuallyPausedRef.current = !prev;
      return !prev;
    });
  }, []);

  // Too few artworks to animate
  if (totalCards < 1) return null;

  // Render cards: originals + clones for seamless loop
  const renderSet = (startIndex: number, isClone: boolean) =>
    artworks.map((art, i) => (
      <CarouselCard
        key={`${isClone ? "clone-" : ""}${art.id}`}
        artwork={art}
        isClone={isClone}
        priority={!isClone && i < 3}
        cardWidth={config.cardWidth}
        cardHeight={config.cardHeight}
        ref={(el: HTMLElement | null) => {
          cardRefs.current[startIndex + i] = el;
        }}
      />
    ));

  return (
    <div className="relative w-full" role="region" aria-label="Artwork carousel" aria-roledescription="carousel">
      {/* The carousel track container — overflow hidden with padding for perspective */}
      <div
        className={`w-full py-4 ${reducedMotion || totalCards < 3 ? "overflow-x-auto" : "overflow-hidden"}`}
        onFocusCapture={() => { isFocusPausedRef.current = true; }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) isFocusPausedRef.current = false;
        }}
        style={{ perspective: `${config.perspective}px` }}
      >
        {/* The translating strip */}
        <div
          ref={stripRef}
          className="flex will-change-transform"
          style={{
            gap: `${config.gap}px`,
            transform: `translateX(0px)`,
          }}
        >
          {/* Original set */}
          {renderSet(0, false)}

          {/* Cloned set for seamless loop */}
          {totalCards >= 3 && !reducedMotion && (
            <div aria-hidden="true" className="contents" style={{ display: "contents" }}>
              {renderSet(totalCards, true)}
            </div>
          )}
        </div>
      </div>

      {/* Pause / Play button for accessibility */}
      {!reducedMotion && totalCards >= 3 && (
        <button
          onClick={togglePause}
          className="ml-auto mr-4 min-h-11 px-4 flex items-center font-sans text-[10px] uppercase tracking-[0.15em] text-white/60 hover:text-white transition-colors duration-500 focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] outline-none"
          aria-label={isManuallyPaused ? "Play carousel" : "Pause carousel"}
        >
          {isManuallyPaused ? "▶ Play" : "❚❚ Pause"}
        </button>
      )}
    </div>
  );
}
