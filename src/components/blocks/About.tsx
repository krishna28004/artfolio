import { Section } from "@/components/layout/Section";
import Image from "next/image";

const InstagramIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export function About() {
    return (
        <Section className="py-32 border-t border-white/5 bg-[#0a0a0a]" id="about">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-16 lg:gap-24 items-center">

                {/* Left Side: Text */}
                <div className="flex-1 order-2 md:order-1">
                    <div className="flex items-center gap-4 mb-4">
                        <span className="h-[1px] w-12 bg-primary"></span>
                        <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-primary">Behind The Canvas</span>
                    </div>
                    <h2 className="font-serif text-[40px] md:text-[52px] text-text tracking-[-0.03em] leading-[1.1] mb-8">
                        Mastering the <br/><span className="text-muted/60 italic">Monochromatic</span> Spectrum.
                    </h2>
                    <div className="flex flex-col gap-6 font-sans text-[15px] md:text-[16px] leading-[1.8] font-light text-muted/80 mb-10">
                        <p>
                            I am <strong className="text-white font-medium">Krishna Kumar</strong>, a visual artist specializing in hyper-realistic graphite expressions. My work strips away the distraction of color, focusing solely on the raw interplay of light, shadow, and texture to evoke genuine human emotion.
                        </p>
                        <p>
                            In an era increasingly defined by instant digital generation, my process represents a deliberate return to the tangible. I remain anchored to the tactile sensation of graphite on paper—every stroke intentional, every shadow built through patient, meticulous layering.
                        </p>
                        <p>
                            Whether you are here to explore the virtual exhibition, study my technique, or acquire a bespoke commission, I welcome you to my digital studio.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 border-t border-white/5 pt-8">
                        <div>
                            <p className="font-serif text-3xl text-primary mb-1">Graphite</p>
                            <p className="font-sans text-[10px] uppercase tracking-widest text-muted">Primary Medium</p>
                        </div>
                        <div>
                            <p className="font-serif text-3xl text-primary mb-1">Realism</p>
                            <p className="font-sans text-[10px] uppercase tracking-widest text-muted">Aesthetic Style</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Portrait & Signature block */}
                <div className="flex-1 w-full relative aspect-[4/5] md:aspect-[3/4] bg-surface-lowest border border-white/5 p-8 flex flex-col justify-end shadow-ambient grayscale transition-all duration-[800ms] hover:grayscale-0 group overflow-hidden order-1 md:order-2">
                    <Image 
                        src="/images/artist/krishna.jpg"
                        alt="Krishna Kumar"
                        fill
                        sizes="(max-width: 768px) 100vw, 450px"
                        className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    
                    <div className="z-10 mt-auto flex items-end justify-between w-full">
                        <div>
                            <span className="font-serif text-3xl italic text-white font-light tracking-wide">K. Kumar</span>
                            <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-primary mt-2">Lead Artist & Curator</p>
                        </div>
                        
                        <a 
                            href="https://instagram.com/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-3.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-primary hover:border-primary hover:text-black transition-all duration-500 hover:scale-110 active:scale-95 text-white/80 flex items-center justify-center -mb-2"
                            aria-label="Instagram Profile"
                        >
                            <InstagramIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                        </a>
                    </div>
                </div>

            </div>
        </Section>
    );
}
