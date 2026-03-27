import { Section } from "@/components/layout/Section";

export default function Home() {
  return (
    <Section className="flex-1 flex flex-col justify-center text-center">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-text mb-4">
        Krishna <span className="text-accent">Artfolio</span>
      </h1>
      <p className="text-lg text-muted max-w-2xl mx-auto">
        A premium collection of high-quality digital artwork and modern design.
      </p>
    </Section>
  );
}