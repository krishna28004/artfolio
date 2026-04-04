import { Section } from "@/components/layout/Section";

export default function Loading() {
    return (
        <Section className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-6">
                <div className="relative w-8 h-8">
                    <div className="absolute inset-0 border border-white/20 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-2 bg-white/40 rounded-full animate-pulse"></div>
                </div>
                <p className="font-sans text-[11px] text-muted tracking-[0.3em] uppercase">
                    Curating Gallery
                </p>
            </div>
        </Section>
    );
}
