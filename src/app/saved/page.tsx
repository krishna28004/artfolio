"use client";
import { Section } from "@/components/layout/Section";
import { ArtCard } from "@/components/gallery/ArtCard";
import { placeholders } from "@/lib/data/placeholders";
import { useFavorites } from "@/hooks/useFavorites";
import Link from "next/link";

export default function SavedPage() {
    const { favorites } = useFavorites();

    const savedArtworks = placeholders.filter(artwork => favorites.includes(artwork.id));

    return (
        <div className="flex-1 flex flex-col bg-background">
            <Section className="py-24">
                <header className="mb-20 animate-reveal">
                    <h1 className="font-serif text-[48px] md:text-[64px] text-text mb-4">Your Collection</h1>
                    <p className="font-sans text-muted text-[15px] max-w-md italic">
                        A curated selection of your favorite pencil sketches, archived for your personal inspiration.
                    </p>
                </header>

                {savedArtworks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                        {savedArtworks.map((artwork, index) => (
                            <ArtCard key={artwork.id} artwork={artwork} index={index} />
                        ))}
                    </div>
                ) : (
                    <div className="py-32 flex flex-col items-center text-center animate-reveal">
                        <p className="font-sans text-muted mb-12 uppercase tracking-[0.2em] text-[13px]">No masterpieces archived yet.</p>
                        <Link
                            href="/"
                            className="px-10 py-4 border border-outline-variant/30 text-text uppercase text-[11px] tracking-[0.2em] hover:bg-surface-highest/20 transition-all duration-500"
                        >
                            Explore Gallery
                        </Link>
                    </div>
                )}
            </Section>
        </div>
    );
}
