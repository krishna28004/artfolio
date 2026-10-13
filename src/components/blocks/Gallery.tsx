"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";
import type { Artwork } from "@/features/artwork/data/artworks";
import styles from "./Gallery.module.css";

interface GalleryProps {
  artworks: Artwork[];
}

interface IllustrationCropProps {
  variant: string;
  source: "desktop" | "mobile";
  crop: [number, number, number, number];
}

// The approvals are complete compositions, rather than separate illustration WebPs.
// Clip their drawing regions; all heading text and controls remain live HTML.
function IllustrationCrop({ variant, source, crop }: IllustrationCropProps) {
  const [x, y, width, height] = crop;
  const [sourceWidth, sourceHeight] = source === "desktop" ? [1720, 914] : [840, 1871];
  return (
    <div
      aria-hidden="true"
      className={"selected-works-art " + styles.art + " " + variant}
      style={{ aspectRatio: width + " / " + height }}
    >
      <Image
        src={"/images/editorial/selected-works-reference-" + source + ".png"}
        alt=""
        width={sourceWidth}
        height={sourceHeight}
        sizes="(min-width: 1024px) 105vw, 110vw"
        draggable={false}
        style={{
          width: (sourceWidth / width) * 100 + "%",
          left: (-x / width) * 100 + "%",
          top: (-y / height) * 100 + "%",
        }}
      />
    </div>
  );
}

export function Gallery({ artworks }: GalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Section className="!py-0" containerClassName="!max-w-none !px-0" id="gallery">
      <div className={"selected-works-stage " + styles.stage}>
        <IllustrationCrop source="desktop" crop={[0, 166, 560, 462]} variant={styles.desktopLeft} />
        <IllustrationCrop source="desktop" crop={[1210, 205, 510, 423]} variant={styles.desktopRight} />
        <IllustrationCrop source="desktop" crop={[0, 166, 560, 462]} variant={styles.mobileLeft} />
        <IllustrationCrop source="mobile" crop={[600, 950, 240, 310]} variant={styles.mobileRight} />

        <div className={styles.notes} aria-hidden="true">
          <span className={styles.observation}>From Observation<br />to Expression</span>
          <span className={styles.progress}>Art in<br />progress —</span>
          <span className={styles.details}>Art lives<br />in the details</span>
          <span className={styles.studies}>Graphite Studies</span>
        </div>

        <div className={styles.content}>
          <p className={"selected-works-overline " + styles.overline}>A curated collection</p>
          <h2 className="m-0">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls="selected-works-grid"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              className={"group " + styles.toggle + " rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"}
            >
              <span className={"selected-works-title " + styles.title}>
                Selected{" "}
                <span className={styles.word}>Works</span>
                <ChevronDown
                  aria-hidden="true"
                  size={20}
                  strokeWidth={1.5}
                  className={styles.chevron + " text-primary " + (isExpanded ? "rotate-180" : "")}
                />
              </span>
              <span className={styles.subtitle}>
                {isExpanded ? "Hide collection" : "View collection · " + artworks.length + " artworks"}
              </span>
            </button>
          </h2>
        </div>
      </div>

      <div
        id="selected-works-grid"
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        hidden={!isExpanded}
        className={styles.collection}
      >
        {artworks.length > 0 ? (
          <ArtGrid>
            {artworks.map((art, index) => (
              <ArtCard key={art.id} artwork={art} index={index} />
            ))}
          </ArtGrid>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/10 py-20 text-center">
            <p className="font-serif italic text-zinc-500">The curator is currently selecting new works for the collection.</p>
          </div>
        )}
      </div>
    </Section>
  );
}
