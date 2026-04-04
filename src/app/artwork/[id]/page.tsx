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
    medium: "Digital Native / Generative Texture",
    dimensions: "8000 x 10000 px",
  };
}

export default async function ArtworkPage(props: any) {
  // Awaiting params safely for universal Next.js 14/15 compat
  const params = await Promise.resolve(props.params);
  const artwork = await getArtwork(params.id);

  if (!artwork) {
    notFound();
  }

  return (
    <main className="flex-1 flex flex-col bg-background">
      <Section className="pt-8 pb-32">

        {/* Navigation Return */}
        <div className="mb-10">
          <Link href="/" className="group font-sans text-[13px] text-muted hover:text-text uppercase tracking-widest transition-colors duration-[600ms] flex items-center gap-2 w-fit">
            {/* The arrow pulls slightly backwards on hover, easing the user into the 'return' action */}
            <span className="transition-transform duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:-translate-x-1">
              &larr;
            </span>
            <span>Return to Exhibition</span>
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
              title={artwork.title}
              artist={artwork.artist}
              year={artwork.year.toString()}
              medium={artwork.medium}
              dimensions={artwork.dimensions}
              description={artwork.description}
            />
          </div>

        </div>
      </Section>
    </main>
  );
}
