# Master Implementation Plan: Graphite Line-Art & Illustration Integration

> **Target Project:** Artfolio (`C:\Users\user\Documents\artfolio`)  
> **Target Component:** `src/components/blocks/Gallery.tsx`  
> **Status:** Architecture & Implementation Blueprint (Ready for execution)  

---

## 1. Executive Summary & Design Vision

This plan details the exact technical implementation for integrating the **graphite pencil, technical line-art, and eye illustration** into the Artfolio homepage around the **Selected Works** heading, strictly matching the reference designs.

### Core Visual Requirements
1. **Desktop (Landscape):** A wide editorial banner framing "Selected Works" precisely in the center:
   - **Left:** Graphite sketching pencils, wood shavings, and fine graphite dust.
   - **Center:** Overline "— A CURATED COLLECTION —", dual-toned "Selected Works" title, down chevron `⌵`, and "VIEW COLLECTION · 10 ARTWORKS" subtitle.
   - **Right:** Detailed hyper-realistic graphite eye portrait sketch with fine radiating cross-hatching and technical construction arcs.
   - **Annotations:** Script text "Graphite Studies" and "Art Lives in the Details".
2. **Mobile (Portrait):** Disciplined vertical compactness with **ZERO extra scrolling**:
   - The entire section fits neatly into the standard viewport rhythm between the artwork carousel above and "Behind the Canvas" below.
   - **Top Left:** Handwritten italic script *"From Observation To Expression"*.
   - **Top Right:** Metadata note *"ART IN PROGRESS —"* and the carousel `|| PAUSE` control.
   - **Center:** Mathematically centered "Selected Works ⌵" and "VIEW COLLECTION · 10 ARTWORKS".
   - **Lower-Left:** Graphite pencils, wood shavings, and compass construction circles.
   - **Right / Lower-Right:** Hyper-realistic graphite eye illustration and *"Art Lives in the Details"* script.

---

## 2. Mobile Zero-Waste-Scroll Engineering

A common failure mode in responsive editorial layouts is allowing background illustrations to blow out the vertical container height, forcing the user to swipe through hundreds of pixels of empty dark space.

### The Mobile Height & Budget Calculation
In the mobile reference screenshot:
- The screen viewport is **390px × 844px** (standard portrait).
- The carousel card sliver is visible at the very top.
- The illustration block occupies **~420px** in height.
- The top of the "Behind the Canvas" photo is already entering the lower fold.

### Technical Container Rules for Mobile
1. **Bounded Height:** The illustration stage on mobile must be strictly clamped:
   ```css
   /* Mobile */
   min-height: 380px;
   max-height: 440px;
   height: clamp(380px, 55vh, 440px);

   /* Tablet */
   @media (min-width: 768px) {
     height: 420px;
   }

   /* Desktop */
   @media (min-width: 1024px) {
     height: clamp(440px, 32vw, 520px);
   }
   ```
2. **No Layout Shift on Expand:**
   - The interactive button toggles `#selected-works-grid`.
   - When collapsed (default), the height is exactly this 380–440px stage.
   - When expanded, the artwork grid unrolls **directly below** the illustration banner without pushing or altering the illustration's internal geometry.
3. **No Horizontal Overflow:**
   - All illustration elements use `overflow-hidden` on the outer parent so wide circular arcs or pencil tips never cause horizontal scroll (`scrollWidth <= innerWidth`).

---

## 3. Position Mapping Schema

### A. Desktop (Viewport ≥ 1024px)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Carousel Track]                                                           [❚❚ PAUSE]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [PENCIL & SHAVINGS]              — A CURATED COLLECTION —               [EYE SKETCH]  │
│  Left: 0 to 32%                      Selected Works ⌵                    Right: 0 to 35%
│  Compass Arcs                  VIEW COLLECTION · 10 ARTWORKS             Grid Lines    │
│  Z-index: 1                        (Centered Axis: 50%)                  Z-index: 1    │
│                                                                                        │
│                                "Graphite Studies"       "Art Lives in the Details"     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ───────────────────────────────── Horizontal Rule ──────────────────────────────────── │
│ [Behind The Canvas Section]                                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Pencil Cluster (Left):**
  - Anchor: `left: 0`, `top: 50%`, `transform: translateY(-50%)`
  - Width: `clamp(340px, 28vw, 500px)`
  - Blend: Natural `#0A0A0A` gradient fade at the right boundary (`mask-image: linear-gradient(to right, black 75%, transparent 100%)`).
- **Center Typography (Center):**
  - Anchor: `position: relative; z-index: 20; margin: 0 auto;`
  - Max text width: `540px`
  - Color hierarchy:
    - Overline: `text-primary/70` (`#E5E0D8` at 70% opacity)
    - "Selected": `text-text` (`#E5E2E1`)
    - "Works": `text-primary` (`#E5E0D8` warm metallic)
    - Chevron `⌵`: `text-primary`
    - Subtitle: `text-muted/80` (`#A0A0A0`)
- **Eye & Line-Art Cluster (Right):**
  - Anchor: `right: 0`, `top: 50%`, `transform: translateY(-50%)`
  - Width: `clamp(360px, 30vw, 540px)`
  - Blend: Gradient fade at the left boundary (`mask-image: linear-gradient(to left, black 75%, transparent 100%)`).

---

### B. Mobile Portrait (< 768px)

```
┌──────────────────────────────────────────────────────────┐
│ [Header: ARTFOLIO]                                   [=] │
│ [Carousel Cards Slivers]                     [❚❚ PAUSE]  │
├──────────────────────────────────────────────────────────┤
│ "From Observation                                        │
│     To Expression"                    "ART IN PROGRESS"  │
│                                                          │
│                     Selected                             │
│                     Works ⌵                              │
│           VIEW COLLECTION · 10 ARTWORKS                  │
│                                                          │
│  [PENCILS & SHAVINGS]                     [EYE SKETCH]   │
│   Bottom-Left (0, 0)                     Center-Right    │
│   Width: ~50%                            Width: ~58%     │
│   Z-index: 1                             Z-index: 1      │
│                                                          │
│                                  "Art Lives in the       │
│                                           Details"       │
├──────────────────────────────────────────────────────────┤
│ [Behind The Canvas: Mastering the Monochromatic Spectrum]│
└──────────────────────────────────────────────────────────┘
```

- **Top Left Callout:**
  - Content: *"From Observation To Expression"*
  - Position: `absolute top-3 left-4`
  - Styling: `font-serif italic text-[11px] text-white/45 tracking-wide`
- **Top Right Metadata:**
  - Content: *"ART IN PROGRESS —"*
  - Position: `absolute top-3.5 right-4`
  - Styling: `font-sans text-[8px] uppercase tracking-[0.25em] text-muted/60`
- **Center Heading:**
  - Position: `relative z-20 pt-10 pb-16 flex flex-col items-center justify-center`
  - Heading Size: `font-serif text-[34px] sm:text-[40px] leading-[1.08]`
  - Subtitle: `text-[9px] uppercase tracking-[0.22em] text-muted/80 mt-2`
- **Lower Left (Pencils & Shavings):**
  - Position: `absolute bottom-0 left-0 w-[48%] max-w-[210px] pointer-events-none`
  - Aligned flush to the bottom-left edge without overlapping the central text corridor.
- **Lower Right (Eye Sketch):**
  - Position: `absolute right-0 bottom-2 w-[54%] max-w-[240px] pointer-events-none`
  - Radial construction arcs extend across the lower quadrant.
- **Script Annotation:**
  - Content: *"Art Lives in the Details"*
  - Position: `absolute right-4 bottom-3`
  - Styling: `font-serif italic text-[11px] text-white/50`

---

## 4. Component Implementation Architecture

### File Modifications
1. **`src/components/blocks/Gallery.tsx`**
   - Replace the plain `<div className="mb-10 flex flex-col items-center text-center">` with the new responsive illustration stage.
   - Retain exact button properties:
     - `type="button"`
     - `aria-expanded={isExpanded}`
     - `aria-controls="selected-works-grid"`
     - `onClick={() => setIsExpanded((prev) => !prev)}`
   - Preserve `#selected-works-grid` below.

2. **Asset Placement:**
   - Desktop Asset: `public/images/editorial/selected-works-hero-desktop.webp`
   - Mobile Asset: `public/images/editorial/selected-works-hero-mobile.webp`

---

## 5. Ready-to-Use Component Code for `Gallery.tsx`

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";
import type { Artwork } from "@/features/artwork/data/artworks";

interface GalleryProps {
  artworks: Artwork[];
}

export function Gallery({ artworks }: GalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Section className="!py-0" id="gallery">
      {/* ────────────────── Editorial Illustration Stage ────────────────── */}
      <div className="relative w-full overflow-hidden bg-background border-b border-white/5">
        
        {/* DESKTOP BACKGROUND ILLUSTRATION (>= 768px) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block select-none">
          <Image
            src="/images/editorial/selected-works-hero-desktop.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-90 transition-opacity duration-1000 ease-editorial"
          />
        </div>

        {/* MOBILE BACKGROUND ILLUSTRATION (< 768px) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 block md:hidden select-none">
          <Image
            src="/images/editorial/selected-works-hero-mobile.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom opacity-85 transition-opacity duration-1000 ease-editorial"
          />
          {/* Mobile Editorial Callouts */}
          <span className="absolute top-3 left-4 font-serif italic text-[11px] text-white/45 tracking-wide">
            From Observation To Expression
          </span>
          <span className="absolute top-3.5 right-4 font-sans text-[8px] uppercase tracking-[0.25em] text-muted/60">
            Art in Progress —
          </span>
          <span className="absolute bottom-3 right-4 font-serif italic text-[11px] text-white/50">
            Art Lives in the Details
          </span>
        </div>

        {/* CENTER TYPOGRAPHY & INTERACTIVE TOGGLE */}
        <div className="relative z-20 mx-auto flex h-[390px] sm:h-[430px] md:h-[480px] lg:h-[520px] w-full max-w-[1440px] flex-col items-center justify-center px-4 text-center">
          
          {/* Overline with accent dashes (Desktop) */}
          <div className="mb-3 hidden sm:flex items-center gap-3">
            <span className="h-px w-6 bg-primary/40" aria-hidden="true" />
            <span className="font-sans text-[10px] uppercase tracking-[0.34em] text-primary/80">
              A Curated Collection
            </span>
            <span className="h-px w-6 bg-primary/40" aria-hidden="true" />
          </div>

          {/* Interactive Trigger Button */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="selected-works-grid"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="group flex min-h-12 flex-col items-center justify-center rounded-sm px-6 py-2 transition-transform duration-500 hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <span className="flex items-center gap-3">
              <span className="font-serif text-[38px] leading-tight tracking-[-0.03em] text-text sm:text-[48px] md:text-[58px]">
                Selected{" "}
                <span className="font-serif font-light text-primary transition-colors duration-500 group-hover:text-white">
                  Works
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                size={22}
                strokeWidth={1.5}
                className={`text-primary transition-transform duration-500 ease-editorial ${isExpanded ? "rotate-180" : ""}`}
              />
            </span>
            <span className="mt-2 font-sans text-[9px] uppercase tracking-[0.22em] text-muted/70 transition-colors group-hover:text-primary sm:text-[10px]">
              {isExpanded ? "Hide collection" : `View collection · ${artworks.length} artworks`}
            </span>
          </button>
        </div>
      </div>

      {/* ────────────────── Collapsible Artworks Grid ────────────────── */}
      <div
        id="selected-works-grid"
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        hidden={!isExpanded}
        className="py-16 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16">
          {artworks.length > 0 ? (
            <ArtGrid>
              {artworks.map((art, index) => (
                <ArtCard key={art.id} artwork={art} index={index} />
              ))}
            </ArtGrid>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/10 py-20 text-center">
              <p className="font-serif italic text-zinc-500">
                The curator is currently selecting new works for the collection.
              </p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
```

---

## 6. Verification & Automated Test Alignment

To ensure zero regressions against the existing test suite:
1. **Selector Contract:** The element `#gallery button[aria-controls="selected-works-grid"]` remains identical in type, ID, attributes, and behavior.
2. **Scroll Overflow Check:**
   - Run `node tests/homepage-navigation-browser.mjs`.
   - The test asserts: `overflow: document.documentElement.scrollWidth > innerWidth + 2` is `false`.
   - `overflow-hidden` on the stage wrapper guarantees this assertion passes across all viewports (`desktop`, `tablet`, `mobile-portrait`, `mobile-landscape`).
3. **Accessibility Checks:**
   - All decorative image elements have `aria-hidden="true"` and `pointer-events-none`.
   - Text contrast ratio between `#E5E0D8` / `#E5E2E1` on `#0A0A0A` exceeds **12:1** (WCAG AAA).
4. **Touch Target Size:**
   - The toggle button has a touch hitbox of at least **48px height**, satisfying mobile tap target requirements.
5. **Compile & Typecheck:**
   - `npx tsc --noEmit` -> 0 errors.
   - `npm run lint` -> 0 warnings.
   - `npm run build` -> Clean static route compilation.

---

## 7. Approval & Implementation Checklist

- [x] Step 1: Place approved WebP artwork assets into `public/images/editorial/`.
- [x] Step 2: Update `src/components/blocks/Gallery.tsx` using the bounded stage markup above.
- [x] Step 3: Run `npm test` and `node tests/homepage-navigation-browser.mjs`.
- [x] Step 4: Validate visual presentation in desktop and mobile viewports.
