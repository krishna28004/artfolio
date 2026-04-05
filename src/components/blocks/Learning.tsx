"use client";
import { Section } from "@/components/layout/Section";

const TUTORIAL_VIDEOS = [
    { id: 1, title: "Drawing Tutorial — Pencil Sketch Techniques", imageThumbnail: "https://img.youtube.com/vi/6DwZvfW2YKs/maxresdefault.jpg", link: "https://youtu.be/6DwZvfW2YKs" },
    { id: 2, title: "Realistic Portrait Drawing Tutorial", imageThumbnail: "https://img.youtube.com/vi/wv1nQwL7coE/maxresdefault.jpg", link: "https://youtu.be/wv1nQwL7coE" }
];

export function Learning() {
    return (
        <Section className="py-32 bg-surface-highest border-t border-white/5" id="learning">

            {/* Header */}
            <div className="mb-20 flex flex-col items-center text-center max-w-2xl mx-auto">
                <h2 className="font-serif text-[40px] md:text-[56px] text-text tracking-[-0.03em] leading-tight mb-4">
                    Learning & Process
                </h2>
                <div className="w-12 h-px bg-primary/50 mb-6"></div>
                <p className="font-sans text-[15px] leading-[1.6] font-light text-muted">
                    Deconstructing the art of the pencil sketch. High-fidelity tutorials and foundational tips are currently in production.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                {/* Left Side: Video Spotlights */}
                <div className="lg:col-span-7 flex flex-col gap-10">
                    <h3 className="font-sans uppercase text-[13px] tracking-[0.2em] text-primary mb-2">Studio Sessions</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                        {TUTORIAL_VIDEOS.map((video) => (
                            <a key={video.id} href={video.link} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-4">
                                <div className="relative aspect-video w-full overflow-hidden bg-black border border-white/10 group-hover:border-primary/50 transition-colors duration-500">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={video.imageThumbnail}
                                        alt={video.title}
                                        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-[1000ms] grayscale group-hover:grayscale-0"
                                    />
                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-black/60 border border-primary/50 flex items-center justify-center backdrop-blur-md transition-transform duration-500 group-hover:scale-110">
                                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-primary border-b-[6px] border-b-transparent ml-1"></div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-serif text-lg text-text group-hover:text-primary transition-colors">{video.title}</h4>
                                    <span className="font-sans text-[11px] uppercase tracking-widest text-muted/50 mt-1 block">Watch on YouTube</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Right Side: Sketching Tips */}
                <div className="lg:col-span-5 bg-background p-10 border border-white/5 relative shadow-ambient">
                    <h3 className="font-sans uppercase text-[13px] tracking-[0.2em] text-primary mb-8 border-b border-white/10 pb-4">Essential Sketching Tips</h3>

                    <div className="flex flex-col gap-8">
                        <div>
                            <h4 className="font-serif text-[18px] text-text mb-2">01. Pressure Control</h4>
                            <p className="font-sans text-[14px] leading-relaxed text-muted font-light">Allow the weight of the pencil to dictate the line. Avoid pressing into the paper hard; build dark tones by layering multiple passes of softer graphite rather than digging down.</p>
                        </div>

                        <div>
                            <h4 className="font-serif text-[18px] text-text mb-2">02. Value Conservation</h4>
                            <p className="font-sans text-[14px] leading-relaxed text-muted font-light">Protect your pure whites. In pencil sketching, the white of the paper is your highest highlight. Once covered, it is challenging to reclaim it perfectly with an eraser.</p>
                        </div>

                        <div>
                            <h4 className="font-serif text-[18px] text-text mb-2">03. The Smudge Factor</h4>
                            <p className="font-sans text-[14px] leading-relaxed text-muted font-light">Utilize a blank piece of paper under your resting hand. Graphite transfers instantly to skin oils, potentially muddying the careful gradients you have just established.</p>
                        </div>
                    </div>
                </div>

            </div>

        </Section>
    );
}
