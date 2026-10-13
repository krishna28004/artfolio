import { CommissionForm } from "@/components/commission/CommissionForm";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CommissionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const artworkRef = params.ref ? String(params.ref) : "";

  return (
    <main className="flex-1 flex flex-col bg-background text-text min-h-screen">
      <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 pt-24 pb-28 md:pt-32 md:pb-36 flex flex-col">
        {/* Minimal Hero Header */}
        <header className="text-center mb-12 md:mb-16">
          <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-primary mb-3">
            Private Commissions
          </p>
          <h1 className="font-serif text-[38px] sm:text-[46px] md:text-[54px] text-text font-normal leading-[1.12] tracking-[-0.02em] mb-4">
            Commission a Piece
          </h1>
          <p className="font-sans text-[14px] sm:text-[15px] text-muted font-light max-w-[500px] mx-auto leading-relaxed">
            Work directly with the artist to bring a bespoke vision into reality.
          </p>
        </header>

        {/* Minimal Premium Commission Form */}
        <CommissionForm initialReference={artworkRef} />
      </div>
    </main>
  );
}
