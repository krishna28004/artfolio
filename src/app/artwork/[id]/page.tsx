import { Section } from "@/components/layout/Section";
import { ArtworkDisplay } from "@/components/artwork/ArtworkDisplay";
import { ArtworkInfo } from "@/components/artwork/ArtworkInfo";
import Link from "next/link";

// Server-side data resolution mock
function getArtwork(id: string) {
  return {
    id,
    title: "Obsidian Echoes",
    artist: "E. Thorne",
    year: "2024",
    imageUrl: "/featured-artwork.png",
    medium: "Digital Native / Generative Texture",
    dimensions: "8000 x 10000 px",
    description: "An exploration of depth through absence. Obsidian Echoes forces the viewer to confront the void through meticulously placed digital striations that mimic physical oil layers. The piece does not offer answers, only reflection."
  };
}

export default async function ArtworkPage(props: any) {
  // Awaiting params safely for universal Next.js 14/15 compat
  const params = await Promise.resolve(props.params);
  const artwork = getArtwork(params.id);

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
              year={artwork.year}
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
