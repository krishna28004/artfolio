import { Metadata } from "next";
import { Section } from "@/components/layout/Section";
import { ArtworkDisplay } from "@/components/artwork/ArtworkDisplay";
import { ArtworkInfo } from "@/components/artwork/ArtworkInfo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtworkById } from "@/features/artwork/services/artwork-service";

interface PageProps {
  params: { id: string } | Promise<{ id: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await Promise.resolve(props.params);
  const artwork = await getArtworkById(params.id);

  if (!artwork) {
    return {
      title: "Artwork Not Found | ARTfolio",
      description: "The requested original artwork could not be found.",
    };
  }

  return {
    title: `${artwork.title} by ${artwork.artist} | ARTfolio`,
    description: artwork.description || `Original ${artwork.medium} artwork by ${artwork.artist}. Dimensions: ${artwork.dimensions}.`,
    openGraph: {
      title: `${artwork.title} | ARTfolio`,
      description: artwork.description || `Original artwork by ${artwork.artist}.`,
      images: [{ url: artwork.imageUrl, alt: artwork.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${artwork.title} | ARTfolio`,
      description: artwork.description || `Original artwork by ${artwork.artist}.`,
      images: [artwork.imageUrl],
    },
  };
}

export default async function ArtworkPage(props: PageProps) {
  const params = await Promise.resolve(props.params);
  const artwork = await getArtworkById(params.id);

  if (!artwork) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.title,
    image: artwork.imageUrl,
    description: artwork.description || undefined,
    artMedium: artwork.medium || "Pencil on Paper",
    artform: "Drawing",
    creator: {
      "@type": "Person",
      name: artwork.artist,
    },
    dateCreated: artwork.year ? String(artwork.year) : undefined,
    offers: artwork.price
      ? {
          "@type": "Offer",
          price: (artwork.price / 100).toFixed(2),
          priceCurrency: "INR",
          availability: artwork.isAvailable ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
        }
      : undefined,
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Section className="pt-8 pb-32">
        {/* Navigation Return & Action block */}
        <div className="mb-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <Link
            href="/"
            className="group font-sans text-[13px] text-muted hover:text-text uppercase tracking-widest transition-colors duration-[600ms] flex items-center gap-2 w-fit"
          >
            <span className="transition-transform duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:-translate-x-1">
              &larr;
            </span>
            <span>Return to Exhibition</span>
          </Link>

          <Link
            href={`/artwork/${artwork.id}?wallfit=true`}
            className="text-[11px] font-sans text-primary tracking-[0.2em] uppercase border-b border-primary pb-1 hover:text-white hover:border-white transition-colors self-start sm:self-auto duration-[600ms] ease-editorial"
          >
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
