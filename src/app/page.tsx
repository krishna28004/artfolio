import { Hero } from "@/components/blocks/Hero";
import { Gallery } from "@/components/blocks/Gallery";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <Hero />
      <Gallery />
    </main>
  );
}