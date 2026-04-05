import { Section } from "@/components/layout/Section";
import { ArtworkDisplay } from "@/components/artwork/ArtworkDisplay";
import { ArtworkInfo } from "@/components/artwork/ArtworkInfo";
import Link from "next/link";

import { notFound } from "next/navigation";
import { placeholders } from "@/lib/data/placeholders";

// Server-side data resolution mock
async function getArtwork(id: string) {
  const artwork = placeholders.find(a => a.id === id);
  if (!artwork) return null;

  return {
    ...artwork,
    medium: artwork.medium || "Pencil on Paper",
    dimensions: artwork.dimensions || "A3 Sheet",
  };
}

interface PageProps {
  params: { id: string } | Promise<{ id: string }>;
}

export default async function ArtworkPage(props: PageProps) {
  // Awaiting params safely for universal Next.js 14/15 compat
  const params = await Promise.resolve(props.params);
  const artwork = await getArtwork(params.id);

  if (!artwork) {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <Section className="pt-8 pb-32">

        {/* Navigation Return & Action block */}
        <div className="mb-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <Link href="/" className="group font-sans text-[13px] text-muted hover:text-text uppercase tracking-widest transition-colors duration-[600ms] flex items-center gap-2 w-fit">
            <span className="transition-transform duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:-translate-x-1">
              &larr;
            </span>
            <span>Return to Exhibition</span>
          </Link>

          <Link href={`/artwork/${artwork.id}?wallfit=true`} className="text-[11px] font-sans text-primary tracking-[0.2em] uppercase border-b border-primary pb-1 hover:text-white hover:border-white transition-colors self-start sm:self-auto duration-[600ms] ease-editorial">
            Try WallFit&trade; Preview
          </Link>
        </div>

        {/* The Exhibition Layout (Asymmetrical) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-16 lg:gap-x-20">

          {/* ARTWORK (Domination: 7 Columns) */}
          <div className="lg:col-span-7">
            <ArtworkDisplay title={artwork.title} imageUrl={artwork.imageUrl} />
          </div>

          {/* INFORMATION (Restraint: 5 Columns) */}
          <div className="lg:col-span-5 lg:py-12">
            <ArtworkInfo
              id={artwork.id}
              title={artwork.title}
              artist={artwork.artist}
              year={artwork.year.toString()}
              medium={artwork.medium}
              dimensions={artwork.dimensions}
              description={artwork.description}
              imageUrl={artwork.imageUrl}
            />
          </div>

        </div>
      </Section>
    </div>
  );
}
