import { Hero } from "@/components/blocks/Hero";
import { Gallery } from "@/components/blocks/Gallery";
import { About } from "@/components/blocks/About";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <Hero />
      <Gallery />
      <About />
    </div>
  );
}