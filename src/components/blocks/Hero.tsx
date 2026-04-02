import { Section } from "@/components/layout/Section";
import Image from "next/image";

export function Hero() {
  return (
    <Section className="pt-24 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 items-end">
        
        {/* LEFT: Text Block (4 Columns) - Bottom Aligned */}
        <div className="lg:col-span-4 flex flex-col items-start pb-4 lg:pb-8">
          <h1 className="font-serif text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.02em] text-text mb-6">
            Curated Digital Excellence
          </h1>
          
          <p className="font-sans text-[16px] leading-[1.6] font-light text-muted max-w-md mb-10">
            An exclusive collection of meticulous digital artistry, 
            designed for collectors who demand uncompromising aesthetic quality.
          </p>
          
          <button className="px-10 py-4 border border-text/20 text-text uppercase text-[13px] tracking-[0.1em] font-medium transition-colors duration-300 hover:border-text hover:text-accent">
            Enter Exhibition
          </button>
        </div>

        {/* RIGHT: Artwork (7 Columns, offset by 1) */}
        <div className="lg:col-span-7 lg:col-start-6 w-full">
          {/* Subtle cursor integration and exceptionally slow visual scaling on hover */}
          <div className="group relative w-full aspect-[4/5] border border-white/5 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] overflow-hidden cursor-crosshair">
            <Image 
              src="/featured-artwork.png" 
              alt="Featured Artwork"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-center transition-transform duration-[1500ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.01]"
              priority
            />
          </div>
        </div>

      </div>
    </Section>
  );
}
