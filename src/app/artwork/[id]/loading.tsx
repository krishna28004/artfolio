import { Section } from "@/components/layout/Section";
import { ArtworkScribbleLoader } from "@/components/artwork/ArtworkScribbleLoader";

export default function ArtworkLoading() {
  return (
    <Section className="flex min-h-[60vh] flex-1 items-center justify-center">
      <ArtworkScribbleLoader label="Loading artwork details" />
    </Section>
  );
}
