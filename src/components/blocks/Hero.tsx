import { Section } from "@/components/layout/Section";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <Section className="min-h-[90vh] pb-32 pt-24 lg:pt-0 flex items-center overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0 items-center w-full">

        {/* LEFT: Text Block */}
        <div className="lg:col-span-5 flex flex-col items-start z-10 animate-reveal stagger-1">
          <h1 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-text mb-6">
            Handmade Pencil Sketches by Krishna Kumar
          </h1>

          <p className="font-sans text-[16px] leading-[1.6] font-light text-muted max-w-md mb-10">
            A curated portfolio of painstaking graphite mastery. Explore raw, artisanal artwork crafted through traditional hand-sketching techniques.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-6">
            <Link href="/#gallery" className="px-10 py-5 bg-gradient-to-r from-primary to-primary-container text-[#3c2f00] text-center uppercase text-[12px] tracking-[0.1em] font-medium transition-all duration-[500ms] ease-out hover:brightness-110 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.1)] active:scale-95 shadow-ambient">
              Enter Exhibition
            </Link>
            <Link href="/learning" className="px-10 py-5 bg-transparent border border-outline-variant/30 text-center text-text uppercase text-[12px] tracking-[0.1em] font-medium transition-all duration-[500ms] ease-out hover:bg-white/5 hover:border-white/40 hover:-translate-y-1 active:scale-95">
              Sketching Secrets
            </Link>
          </div>
        </div>

        {/* RIGHT: Refined Illustration Card */}
        <div className="lg:col-span-6 lg:col-start-7 w-full animate-reveal stagger-2" style={{ animationDuration: '1200ms' }}>
          <div className="group relative w-full max-w-lg mx-auto lg:ml-auto">

            {/* Premium Separation Glow */}
            <div className="absolute -inset-10 bg-primary/5 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000 z-0"></div>

            {/* The "Card" Container — Properly Rounded and Sized */}
            <div className="relative aspect-square w-full rounded-[48px] overflow-hidden bg-black/40 border border-white/5 shadow-[0_32px_80px_-15px_rgba(0,0,0,0.8)] p-4 sm:p-8 transition-all duration-700 group-hover:border-white/10 group-hover:shadow-ambient">
              
              {/* Subtle inner gold rim light effect */}
              <div className="absolute inset-0 rounded-[48px] border border-primary/5 pointer-events-none z-10"></div>
              
              <div className="relative w-full h-full">
                <Image
                  src="/images/artist/illustratedme.png"
                  alt="Krishna Kumar — Artist Design"
                  fill
                  sizes="(max-width: 1024px) 100vw, 512px"
                  className="object-contain object-center transition-all duration-[2000ms] ease-out group-hover:scale-[1.02] contrast-[1.1] brightness-[1.02]"
                  priority
                  loading="eager"
                />
              </div>

              {/* Glassy Overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5 pointer-events-none opacity-50"></div>
            </div>

            {/* Captions below */}
            <div className="mt-8 flex justify-between items-end border-l border-primary/20 pl-6 h-10">
              <div className="animate-reveal stagger-3">
                <p className="font-serif text-[18px] text-text/90 italic tracking-wide">Krishna Kumar</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted/40 mt-1 font-medium">Bespoke Pencil Artist</p>
              </div>
              <div className="flex flex-col items-end opacity-20 group-hover:opacity-40 transition-opacity duration-700">
                <p className="font-sans text-[8px] uppercase tracking-[0.2em] text-muted">Aest. Profile</p>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted mt-0.5">MMXXIV</p>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </Section>
  );
}
