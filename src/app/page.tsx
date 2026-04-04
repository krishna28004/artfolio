import { Hero } from "@/components/blocks/Hero";
import { Gallery } from "@/components/blocks/Gallery";
import { Section } from "@/components/layout/Section";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <Hero />

      {/* WallFit Preview Section */}
      <Section className="py-32 border-t border-white/5 bg-[#050505]">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <h2 className="font-serif text-[36px] md:text-[48px] text-text tracking-[-0.03em] leading-tight mb-6">
            Buy with absolute certainty.
          </h2>
          <p className="font-sans text-[16px] leading-[1.6] font-light text-muted max-w-2xl mb-10">
            Digital art shouldn't be a guessing game. Experience our WallFit™ technology to instantly visualize pieces in your exact physical space—true to scale and lighting—before you acquire.
          </p>
          <Link href="/artwork/monolith-01?wallfit=true" className="px-10 py-5 border border-white/20 text-white uppercase text-[12px] tracking-[0.15em] font-bold transition-all duration-300 hover:bg-white hover:text-black">
            Try the WallFit Demo
          </Link>
        </div>
      </Section>

      <Gallery />

      {/* Commission CTA Section */}
      <Section className="py-32 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-serif text-[36px] md:text-[48px] text-text tracking-[-0.03em] leading-tight mb-6">
              Bespoke Artworks
            </h2>
            <p className="font-sans text-[16px] leading-[1.6] font-light text-muted max-w-md mb-10">
              Commission an exclusive, custom piece tailored entirely to your personal aesthetic vision and spatial requirements.
            </p>
            <Link href="/commission" className="px-10 py-4 border border-text text-black bg-text uppercase text-[13px] tracking-[0.1em] font-medium transition-colors duration-300 hover:bg-transparent hover:text-text hover:border-text">
              Request a Commission
            </Link>
          </div>
          <div className="aspect-square bg-gradient-to-br from-zinc-800 to-black border border-white/5 relative flex items-center justify-center p-12">
            {/* Minimal graphic representation of a bespoke piece */}
            <div className="w-full h-full border border-dashed border-white/20 flex flex-col items-center justify-center text-center">
              <span className="uppercase text-[10px] tracking-[0.3em] text-muted mb-2">Commission Slot</span>
              <span className="font-serif text-xl italic text-white/50">Available</span>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}