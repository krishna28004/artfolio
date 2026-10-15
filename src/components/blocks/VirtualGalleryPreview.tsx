"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/features/artwork/data/artworks";
import styles from "./VirtualGalleryPreview.module.css";

export function VirtualGalleryPreview({ artworks }: { artworks: Artwork[] }) {
  const stageRef = useRef<HTMLElement>(null);
  const recenterTiltRef = useRef<() => void>(() => {});
  const [tiltMode, setTiltMode] = useState<"off" | "on" | "unavailable">("off");
  const visibleArtworks = artworks.filter((artwork) => artwork.thumbnailUrl || artwork.imageUrl).slice(0, 10);

  const enableTilt = async () => {
    if (tiltMode === "on") {
      recenterTiltRef.current();
      return;
    }
    if (!("DeviceOrientationEvent" in window)) {
      setTiltMode("unavailable");
      return;
    }

    try {
      const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (orientation.requestPermission && await orientation.requestPermission() !== "granted") {
        setTiltMode("unavailable");
        return;
      }
      setTiltMode("on");
    } catch {
      setTiltMode("unavailable");
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cards = Array.from(stage.querySelectorAll<HTMLElement>("[data-gallery-depth]"));
    const current = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = 0;

    const paint = () => {
      current.x += (target.x - current.x) * 0.11;
      current.y += (target.y - current.y) * 0.11;

      cards.forEach((card) => {
        const depth = Number(card.dataset.galleryDepth) || 1;
        card.style.setProperty("--motion-x", `${(current.x * depth * 24).toFixed(2)}px`);
        card.style.setProperty("--motion-y", `${(current.y * depth * 17).toFixed(2)}px`);
      });

      if (Math.abs(current.x - target.x) > 0.002 || Math.abs(current.y - target.y) > 0.002) {
        frame = requestAnimationFrame(paint);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onMove = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect();
      target.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      target.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      start();
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      current.x = current.y = target.x = target.y = 0;
      cards.forEach((card) => {
        card.style.removeProperty("--motion-x");
        card.style.removeProperty("--motion-y");
      });
    };

    const updateMotion = () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      reset();
      if (pointer.matches && !reducedMotion.matches) {
        stage.addEventListener("pointermove", onMove, { passive: true });
        stage.addEventListener("pointerleave", onLeave);
      }
    };

    pointer.addEventListener("change", updateMotion);
    reducedMotion.addEventListener("change", updateMotion);
    updateMotion();

    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      pointer.removeEventListener("change", updateMotion);
      reducedMotion.removeEventListener("change", updateMotion);
      reset();
    };
  }, [visibleArtworks.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || tiltMode !== "on") return;

    const mobile = window.matchMedia("(max-width: 767px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cards = Array.from(stage.querySelectorAll<HTMLElement>("[data-gallery-depth]")).slice(0, 4);
    const bodies = cards.map((card) => ({
      card,
      depth: Number(card.dataset.galleryDepth) || 1,
      x: 0, y: 0, vx: 0, vy: 0,
    }));
    let baseline: { beta: number; gamma: number } | null = null;
    let forceX = 0;
    let forceY = 0;
    let visible = false;
    let receivedSignal = false;
    let frame = 0;

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      forceX = forceY = 0;
      bodies.forEach((body) => {
        body.x = body.y = body.vx = body.vy = 0;
        body.card.style.removeProperty("--motion-x");
        body.card.style.removeProperty("--motion-y");
      });
    };

    const paint = () => {
      if (!visible || !mobile.matches || reducedMotion.matches) {
        frame = 0;
        return;
      }
      let moving = false;
      bodies.forEach((body) => {
        const targetX = forceX * 28 * body.depth;
        const targetY = forceY * 23 * body.depth;
        body.vx = (body.vx + (targetX - body.x) * 0.065) * 0.78;
        body.vy = (body.vy + (targetY - body.y) * 0.065) * 0.78;
        body.x += body.vx;
        body.y += body.vy;
        body.card.style.setProperty("--motion-x", `${body.x.toFixed(2)}px`);
        body.card.style.setProperty("--motion-y", `${body.y.toFixed(2)}px`);
        if (Math.abs(targetX - body.x) > 0.08 || Math.abs(targetY - body.y) > 0.08 || Math.abs(body.vx) > 0.05 || Math.abs(body.vy) > 0.05) moving = true;
      });
      frame = moving ? requestAnimationFrame(paint) : 0;
    };

    const start = () => {
      if (!frame && visible && mobile.matches && !reducedMotion.matches) frame = requestAnimationFrame(paint);
    };

    const angleDifference = (angle: number, origin: number) => {
      let difference = angle - origin;
      if (difference > 180) difference -= 360;
      if (difference < -180) difference += 360;
      return difference;
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (!mobile.matches || reducedMotion.matches || event.beta === null || event.gamma === null) return;
      receivedSignal = true;
      if (!baseline) {
        baseline = { beta: event.beta, gamma: event.gamma };
        return;
      }

      const horizontal = Math.max(-1, Math.min(1, angleDifference(event.gamma, baseline.gamma) / 24));
      const vertical = Math.max(-1, Math.min(1, angleDifference(event.beta, baseline.beta) / 24));
      const angle = screen.orientation?.angle ?? 0;
      if (angle === 90) { forceX = -vertical; forceY = horizontal; }
      else if (angle === 270) { forceX = vertical; forceY = -horizontal; }
      else if (angle === 180) { forceX = -horizontal; forceY = -vertical; }
      else { forceX = horizontal; forceY = vertical; }
      start();
    };

    const onPreferenceChange = () => {
      if (!mobile.matches || reducedMotion.matches) reset();
      else start();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(frame);
      if (!visible) frame = 0;
    }, { threshold: 0.05 });
    observer.observe(stage);

    const recenter = () => {
      baseline = null;
      forceX = forceY = 0;
      start();
    };
    recenterTiltRef.current = recenter;
    const unavailableTimer = window.setTimeout(() => {
      if (!receivedSignal && mobile.matches) setTiltMode("unavailable");
    }, 4000);

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    window.addEventListener("orientationchange", recenter);
    mobile.addEventListener("change", onPreferenceChange);
    reducedMotion.addEventListener("change", onPreferenceChange);

    return () => {
      window.clearTimeout(unavailableTimer);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("orientationchange", recenter);
      mobile.removeEventListener("change", onPreferenceChange);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      observer.disconnect();
      recenterTiltRef.current = () => {};
      reset();
    };
  }, [tiltMode, visibleArtworks.length]);

  return (
    <section ref={stageRef} className={styles.stage} aria-labelledby="virtual-gallery-title">
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.artworkField}>
        {visibleArtworks.map((artwork, index) => (
          <Link
            key={artwork.id}
            href={`/artwork/${artwork.id}`}
            className={styles.card}
            data-gallery-depth={index % 3 === 0 ? "1.4" : index % 3 === 1 ? "0.8" : "1.1"}
            aria-label={`View ${artwork.title}`}
            style={{ animationDelay: `${index * 65}ms` }}
          >
            <span className={styles.cardSurface}>
              <Image
                src={artwork.thumbnailUrl || artwork.imageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 40vw, (max-width: 1024px) 23vw, 20vw"
                className={styles.artworkImage}
              />
              <span className={styles.cardTitle}>{artwork.title}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className={styles.centerpiece}>
        <p className={styles.eyebrow}>An invitation to step inside</p>
        <h2 id="virtual-gallery-title" className={styles.title}>
          <Link href="/exhibition" className={styles.titleLink}>
            Explore Virtual <span>ArtGallery</span>
            <span className={styles.arrow} aria-hidden="true">↗</span>
          </Link>
        </h2>
        <p className={styles.hint}>Move your pointer to explore the collection</p>
      </div>
      <div className={styles.tiltControl}>
        {tiltMode === "unavailable" ? (
          <span role="status">Tilt motion is unavailable on this device</span>
        ) : (
          <button type="button" onClick={enableTilt} className={styles.tiltButton}>
            {tiltMode === "on" ? "Recenter tilt" : "Enable tilt motion"}
          </button>
        )}
      </div>
    </section>
  );
}
