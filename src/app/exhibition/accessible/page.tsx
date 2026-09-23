import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllArtworks } from "@/features/artwork/services/artwork-service";
import { Section } from "@/components/layout/Section";

export const metadata: Metadata = {
  title: "Accessible Exhibition Catalog | ARTfolio",
  description:
    "A fully accessible, keyboard-navigable 2D archival exhibition of Krishna Kumar's original pencil drawings.",
};

export default async function AccessibleExhibitionPage() {
  const artworks = await getAllArtworks();

  return (
    <main id="main-content" className="flex-1 bg-background text-text min-h-screen py-20">
      <Section className="max-w-5xl mx-auto px-6">
        <header className="mb-16 border-b border-outline-variant/20 pb-8">
          <Link
            href="/exhibition"
            className="text-[11px] uppercase tracking-widest text-primary hover:text-white transition-colors inline-block mb-4 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            &larr; Return to 3D Virtual Gallery
          </Link>
          <h1 className="font-serif text-3xl md:text-5xl text-text font-normal mb-3">
            Accessible Exhibition Archive
          </h1>
          <p className="font-sans text-muted text-sm leading-relaxed max-w-2xl">
            This linear 2D gallery is designed for screen readers, keyboard navigation, and collectors who prefer high-contrast, motion-free presentation of Krishna Kumar&apos;s pencil portraits and studies.
          </p>
        </header>

        <section aria-label="Curated Artworks" className="space-y-20">
          {artworks.map((art, index) => (
            <article
              key={art.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center p-8 bg-surface-highest/5 border border-outline-variant/20 rounded-sm"
              aria-labelledby={`artwork-title-${art.id}`}
            >
              <div className="relative md:col-span-5 aspect-[3/4] bg-surface-lowest overflow-hidden border border-outline-variant/30">
                <Image
                  src={art.imageUrl}
                  alt={`Pencil drawing of ${art.title}. ${art.description || ""}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>

              <div className="md:col-span-7 space-y-4">
                <span className="text-[10px] tracking-[0.25em] uppercase text-primary font-sans block">
                  Archive Piece 0{index + 1}
                </span>
                <h2 id={`artwork-title-${art.id}`} className="font-serif text-2xl md:text-3xl text-text font-normal">
                  {art.title}
                </h2>
                <dl className="grid grid-cols-2 gap-4 font-sans text-xs pt-2">
                  <div>
                    <dt className="text-muted uppercase tracking-wider text-[10px]">Artist</dt>
                    <dd className="text-text mt-0.5">{art.artist}</dd>
                  </div>
                  <div>
                    <dt className="text-muted uppercase tracking-wider text-[10px]">Year</dt>
                    <dd className="text-text mt-0.5">{art.year}</dd>
                  </div>
                  <div>
                    <dt className="text-muted uppercase tracking-wider text-[10px]">Medium</dt>
                    <dd className="text-text mt-0.5">{art.medium || "Pencil on Paper"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted uppercase tracking-wider text-[10px]">Dimensions</dt>
                    <dd className="text-text mt-0.5">{art.dimensions || "A3 Sheet"}</dd>
                  </div>
                </dl>

                {art.description && (
                  <p className="font-sans text-xs text-muted leading-relaxed pt-2">
                    {art.description}
                  </p>
                )}

                <div className="pt-6 flex flex-wrap gap-4">
                  <Link
                    href={`/artwork/${art.id}`}
                    className="px-6 py-3 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-widest hover:bg-white transition-colors focus:ring-2 focus:ring-primary focus:outline-none"
                    aria-label={`View detailed profile of ${art.title}`}
                  >
                    View Details &rarr;
                  </Link>
                  <Link
                    href={`/artwork/${art.id}?wallfit=true`}
                    className="px-6 py-3 border border-outline-variant/40 text-text font-sans uppercase text-[11px] tracking-widest hover:border-primary transition-colors focus:ring-2 focus:ring-primary focus:outline-none"
                    aria-label={`Simulate ${art.title} on your wall with WallFit`}
                  >
                    WallFit Preview
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </Section>
    </main>
  );
}
