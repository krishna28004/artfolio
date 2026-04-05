import { Section } from "@/components/layout/Section";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <Section className="min-h-[90vh] pb-32 pt-24 lg:pt-0 flex items-center">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 items-center">

        {/* LEFT: Text Block */}
        <div className="lg:col-span-5 flex flex-col items-start z-10 animate-reveal stagger-1">
          <h1 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-text mb-6">
            Handmade Pencil Sketches by Krishna Kumar
          </h1>

          <p className="font-sans text-[16px] leading-[1.6] font-light text-muted max-w-md mb-10">
            A curated portfolio of painstaking graphite mastery. Explore raw, artisanal artwork crafted through traditional hand-sketching techniques.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-6">
            <Link href="/#gallery" className="px-10 py-5 bg-gradient-to-r from-primary to-primary-container text-[#3c2f00] text-center uppercase text-[12px] tracking-[0.1em] font-medium transition-all duration-[600ms] ease-editorial hover:brightness-110 shadow-ambient">
              Enter Exhibition
            </Link>
            <Link href="/learning" className="px-10 py-5 bg-transparent border border-outline-variant/30 text-center text-text uppercase text-[12px] tracking-[0.1em] font-medium transition-all duration-[600ms] ease-editorial hover:bg-surface-highest/20">
              Sketching Secrets
            </Link>
          </div>
        </div>

        {/* RIGHT: Artist Portrait */}
        <div className="lg:col-span-6 lg:col-start-7 w-full animate-reveal stagger-2" style={{ animationDuration: '1200ms' }}>
          <div className="group relative w-full max-w-lg mx-auto lg:ml-auto">

            {/* Soft Ambient Glow Behind Photo */}
            <div className="absolute -inset-10 bg-primary/5 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-0"></div>

            {/* Decorative Gold Frame Accent (Refined) */}
            <div className="absolute -inset-3 border border-primary/10 pointer-events-none z-0 transition-all duration-1000 group-hover:border-primary/30 group-hover:-inset-4"></div>
            <div className="absolute -inset-6 border border-white/5 pointer-events-none z-0"></div>

            {/* Artist Photo with Creative Masking & Faded Look */}
            <div className="relative aspect-[3/4] w-full overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)]"
              style={{ clipPath: 'inset(0% round 4px 60px 4px 60px)' }}>
              <Image
                src="/images/artist/krishna.jpg"
                alt="Krishna Kumar — Artist"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-top transition-all duration-[3000ms] ease-[cubic-bezier(0.2,1,0.3,1)] group-hover:scale-[1.05] grayscale-[15%] contrast-[1.05] brightness-[0.92]"
                priority
              />

              {/* Archival Overlay (Noise & Vignette) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
            </div>

            {/* Caption below (Refined Typography) */}
            <div className="mt-6 flex justify-between items-end border-l border-primary/20 pl-4">
              <div>
                <p className="font-serif text-[16px] text-text/90 italic tracking-wide">Krishna Kumar</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted/40 mt-1.5 font-medium">Bespoke Pencil Artist · India</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-muted/20">Ref. Portfolio</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted/40 mt-0.5">Est. 2024</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Section>
  );
}
