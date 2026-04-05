"use client";
import Link from "next/link";
import { Section } from "@/components/layout/Section";

export default function NotFound() {
    return (
        <div className="flex-1 flex flex-col bg-background">
            <Section className="min-h-[70vh] flex items-center justify-center text-center">
                <div className="max-w-md animate-reveal">
                    <h1 className="font-serif text-[80px] md:text-[120px] text-primary/20 leading-none mb-4">
                        404
                    </h1>
                    <h2 className="font-serif text-[24px] md:text-[32px] text-text mb-6">
                        The Piece is Being Restored
                    </h2>
                    <p className="font-sans text-muted text-[15px] leading-relaxed mb-12 font-light">
                        The masterpiece you seek is currently unavailable or has been archived.
                        Please return to the main gallery to continue your curatorial journey.
                    </p>
                    <Link
                        href="/"
                        className="inline-flex px-12 py-4 bg-transparent border border-outline-variant/30 text-text uppercase text-[12px] tracking-[0.2em] font-medium transition-all duration-700 ease-editorial hover:bg-surface-highest/20 active:scale-[0.98]"
                    >
                        Return to Gallery
                    </Link>
                </div>
            </Section>
        </div>
    );
}
