import { Section } from "@/components/layout/Section";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <Section className="min-h-[100svh] pt-32 lg:pt-0 flex items-center justify-center relative overflow-hidden">
      
      {/* 1. BACKGROUND INTEGRATION (Subtle Space Utilization) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        <span className="font-serif text-[clamp(6rem,18vw,20rem)] font-bold text-white/[0.03] select-none whitespace-nowrap">
          ARTFOLIO
        </span>
        {/* Soft radial glow behind the composition to elevate the premium feel */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] bg-white/[0.02] rounded-full blur-[120px]"></div>
      </div>

      {/* 2. LAYOUT STRUCTURE (Strict Flexbox for zero cropping/overflow issues) */}
      <div className="w-full flex items-center justify-center relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between w-full max-w-[1440px] mx-auto gap-12 lg:gap-8">

          {/* LEFT: Text Block */}
          {/* Constrained width to ensure balance against the image block */}
          <div className="w-full lg:w-[45%] flex flex-col items-center lg:items-start text-center lg:text-left shrink-0 animate-reveal stagger-1">
            <h1 className="font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] tracking-tight text-white mb-6">
              Handmade Pencil Sketches by Krishna Kumar
            </h1>
            <p className="font-sans text-base lg:text-lg leading-[1.7] font-light text-white/70 mb-10 max-w-[420px]">
              A curated portfolio of painstaking graphite mastery. Explore raw, artisanal artwork crafted through traditional physical techniques.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto items-center">
              <Link href="/#gallery" className="px-10 py-4 bg-white text-black transition-all lg:hover:bg-white/90 lg:hover:scale-[1.02] active:scale-95 uppercase text-[12px] tracking-[0.2em] font-medium shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                Enter Exhibition
              </Link>
              <Link href="/learning" className="group flex items-center gap-3 text-white/60 lg:hover:text-white transition-colors uppercase text-[12px] tracking-[0.2em] font-medium">
                <span>The Process</span>
                <span className="block w-6 h-[1px] bg-white/30 lg:group-hover:bg-white lg:group-hover:w-10 transition-all duration-[800ms] ease-editorial"></span>
              </Link>
            </div>
          </div>

          {/* RIGHT: Image Container (Zero Distortion & Zero Cropping Guarantee) */}
          <div className="w-full lg:w-[55%] flex justify-center lg:justify-end items-center relative animate-reveal stagger-2">
            
            {/* The image wrapper naturally adapts to image dimensions. No fixed aspect ratios. */}
            <div className="relative w-full max-w-[800px] flex justify-center lg:justify-end items-center">
              
              {/* Note: explicit width/height ensures native aspect ratio is loaded, while w-full/h-auto scales it dynamically. object-contain provides safety fallback. */}
              <Image
                src="/images/artist/illustratedme.png"
                alt="Krishna Kumar — Artist Profile"
                width={1200}
                height={1200}
                className="w-full h-auto max-h-[80vh] object-contain object-center lg:object-right transition-transform duration-[1500ms] ease-editorial motion-safe:hover:scale-[1.02]"
                priority
              />

            </div>

          </div>

        </div>
      </div>
    </Section>
  );
}
