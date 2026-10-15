import { Section } from "@/components/layout/Section";
import { ArtworkScribbleLoader } from "@/components/artwork/ArtworkScribbleLoader";

export default function ArtworksLoading() {
  return (
    <Section className="flex min-h-[60vh] flex-1 items-center justify-center">
      <ArtworkScribbleLoader label="Loading the artwork collection" />
    </Section>
  );
}
