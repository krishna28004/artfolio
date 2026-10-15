import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";
import { CatalogUnavailable } from "@/components/gallery/CatalogUnavailable";
import { getArtworkCatalog } from "@/features/artwork/services/artwork-service";

export const metadata: Metadata = {
  title: "All Artworks | ARTfolio",
  description: "Explore the complete collection of original graphite artworks by Krishna Kumar.",
};

export default async function ArtworksPage() {
  const catalog = await getArtworkCatalog();

  return (
    <div className="flex-1 bg-background">
      <Section className="min-h-[70vh] pt-12 md:pt-20">
        <header className="mb-14 md:mb-20">
          <p className="mb-5 flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.3em] text-primary">
            <span className="h-px w-8 bg-primary/60" aria-hidden="true" />
            The collection
          </p>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-serif text-[42px] leading-tight text-text md:text-[64px]">All Artworks</h1>
              <p className="mt-4 max-w-xl font-sans text-sm leading-7 text-muted">
                Original graphite studies, each presented with its story and archival details.
              </p>
            </div>
            {catalog.status !== "unavailable" && (
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted/70">
                {catalog.artworks.length} {catalog.artworks.length === 1 ? "artwork" : "artworks"}
              </p>
            )}
          </div>
        </header>

        {catalog.status === "unavailable" ? (
          <CatalogUnavailable href="/artworks" />
        ) : catalog.status === "empty" ? (
          <div className="border-y border-white/10 py-20 text-center">
            <h2 className="font-serif text-2xl text-text">The collection is being prepared</h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted">New works will appear here as they are released.</p>
            <Link href="/" className="mt-8 inline-flex min-h-11 items-center border-b border-primary px-2 text-xs uppercase tracking-widest text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              Return to the studio
            </Link>
          </div>
        ) : (
          <ArtGrid>
            {catalog.artworks.map((artwork, index) => <ArtCard key={artwork.id} artwork={artwork} index={index} priority={index === 0} />)}
          </ArtGrid>
        )}
      </Section>
    </div>
  );
}
