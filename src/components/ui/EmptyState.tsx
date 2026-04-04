import { Section } from "@/components/layout/Section";

interface EmptyStateProps {
    message?: string;
}

export function EmptyState({ message = "No artworks available in this collection yet." }: EmptyStateProps) {
    return (
        <Section className="py-32 flex flex-col items-center text-center justify-center border-t border-white/5">
            <div className="w-16 h-px bg-white/20 mb-8 mx-auto" />
            <h3 className="font-serif text-[28px] md:text-[36px] text-text mb-4">
                Exhibition Vacant
            </h3>
            <p className="font-sans text-[15px] font-light text-muted uppercase tracking-[0.1em] max-w-md">
                {message}
            </p>
        </Section>
    );
}
