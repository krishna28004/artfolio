import { Section } from "@/components/layout/Section";
import { CommissionForm } from "@/components/commission/CommissionForm";

export default async function CommissionPage(props: any) {
  // Await search params safely to prevent Next 15 suspense errors
  const searchParams = await Promise.resolve(props.searchParams || {});
  const artworkRef = searchParams.ref ? String(searchParams.ref) : "";

  return (
    <main className="flex-1 flex flex-col bg-background">
      <Section className="py-24 md:py-32">
        
        <div className="max-w-xl mx-auto flex flex-col w-full">
          <div className="text-center mb-16">
            <h1 className="font-serif text-[40px] md:text-[56px] text-text leading-[1.1] tracking-[-0.02em] mb-6">
              Commission a Piece
            </h1>
            <p className="font-sans text-[16px] text-muted leading-[1.8] font-light">
              Work directly with the artist to bring a bespoke vision into reality. 
              Please provide context regarding scale and intent securely below.
            </p>
          </div>

          <CommissionForm initialReference={artworkRef} />
        </div>

      </Section>
    </main>
  );
}
