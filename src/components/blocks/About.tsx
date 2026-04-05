import { Section } from "@/components/layout/Section";

export function About() {
    return (
        <Section className="py-32 border-t border-white/5 bg-[#0a0a0a]" id="about">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-16 items-center">

                {/* Left Side: Text */}
                <div className="flex-1">
                    <h2 className="font-serif text-[40px] md:text-[56px] text-text tracking-[-0.03em] leading-tight mb-8">
                        The Artist
                    </h2>
                    <div className="flex flex-col gap-6 font-sans text-[16px] leading-[1.8] font-light text-muted">
                        <p>
                            I am <strong className="text-text font-medium">Krishna Kumar</strong>, a dedicated artist specializing in hand-drawn, graphite-based pencil sketches. What began as a personal fascination with light, shadow, and texture has evolved into a lifelong pursuit of mastering the monochromatic spectrum.
                        </p>
                        <p>
                            This platform serves as the central digital archive for my physical works. In a world increasingly saturated with digital generation, I remain anchored to the tactile sensation of graphite on paper. Every stroke is intentional; every shadow is built through patient layering.
                        </p>
                        <p>
                            Whether you are here to explore the exhibition, study the technique, or acquire a bespoke commission, I welcome you to my studio.
                        </p>
                    </div>
                </div>

                {/* Right Side: Portrait Placeholder / Signature block */}
                <div className="flex-1 w-full relative aspect-[3/4] bg-surface-lowest border border-white/5 p-8 flex flex-col justify-end shadow-ambient grayscale opacity-90 transition-opacity hover:opacity-100">
                    <div className="absolute inset-0 bg-black/40"></div>
                    {/* Replace this div with an actual `<Image>` when a portrait is available */}
                    <div className="z-10 mt-auto">
                        <span className="font-serif text-3xl italic text-primary/80">K. Kumar</span>
                        <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-muted mt-2">Lead Artist & Curator</p>
                    </div>
                </div>

            </div>
        </Section>
    );
}
