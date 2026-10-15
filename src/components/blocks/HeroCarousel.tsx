import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/features/artwork/data/artworks";
import { CarouselStrip } from "./CarouselStrip";
import { HomeFeatureDock } from "./HomeNavigation";
import styles from "./HeroCarousel.module.css";

export function HeroCarousel({ artworks }: { artworks: Artwork[] }) {
  return (
    <section id="top" aria-labelledby="home-hero-title" className="relative overflow-hidden bg-background pt-8 pb-12 sm:pt-12 lg:pt-14">
      <div className={styles.studioBackdrop} aria-hidden="true" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 select-none overflow-hidden text-center font-serif text-[clamp(6rem,20vw,23rem)] leading-none tracking-[0.1em] text-white/[0.018]">
        ARTFOLIO
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className={"grid grid-cols-1 items-center gap-10 sm:gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] lg:gap-16 xl:gap-20 " + styles.heroGrid}>
          <div className="min-w-0 max-w-[760px] pt-2 lg:pt-0">
            <p className="mb-5 font-sans text-[10px] uppercase tracking-[0.34em] text-primary/80 sm:text-[11px] sm:tracking-[0.38em]">
              The graphite studio of Krishna Kumar
            </p>
            <h1 id="home-hero-title" className={"max-w-[760px] font-serif text-[clamp(2.7rem,6vw,5.5rem)] leading-[1.02] tracking-[-0.04em] text-text text-balance " + styles.heroTitle}>
              Handmade pencil sketches, <span className="italic text-text/75">made to be felt.</span>
            </h1>
            <p className="mt-5 max-w-[540px] font-sans text-sm leading-[1.75] text-muted sm:mt-6 sm:text-base">
              Explore a collection of patient, expressive graphite work. Step inside the exhibition or begin a piece of your own.
            </p>
            <div className={"mt-7 flex flex-wrap items-center gap-4 sm:mt-8 sm:gap-7 " + styles.heroActions}>
              <Link href="/#gallery" className="min-h-12 inline-flex items-center justify-center bg-primary px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-background transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                Explore collection
              </Link>
              <Link href="/exhibition" className="min-h-12 inline-flex items-center justify-center border-b border-primary/50 text-[11px] uppercase tracking-[0.18em] text-primary transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                Enter exhibition <span aria-hidden="true" className="ml-2">↗</span>
              </Link>
            </div>
          </div>

          <figure className="artist-portrait mx-auto w-full max-w-[350px] sm:max-w-[440px] lg:max-w-[500px]">
            <div className={"relative aspect-square overflow-hidden " + styles.photoStage}>
              <Image
                src="/images/artist/removedbg-hero.webp"
                alt="Krishna Kumar sketching"
                width={885}
                height={1005}
                priority
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 350px, 500px"
                className={styles.artistPhoto}
              />
            </div>
          </figure>
        </div>

        <div className="mt-9 sm:mt-10 lg:mt-12">
          <HomeFeatureDock />
        </div>
      </div>

      {artworks.length > 0 && <div className="relative z-10 mt-10 sm:mt-12 lg:mt-14">
        <div className="mx-auto mb-4 flex max-w-[1440px] items-center gap-4 px-5 sm:px-8 lg:px-12">
          <span className="h-px w-7 bg-primary/60" aria-hidden="true" />
          <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-muted">A selection from the collection</p>
        </div>
        <CarouselStrip artworks={artworks} />
      </div>}
    </section>
  );
}
