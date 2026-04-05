"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { Section } from "@/components/layout/Section";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service securely
        console.error(error);
    }, [error]);

    return (
        <div className="flex-1 flex flex-col bg-background min-h-[70vh]">
            <Section className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-lg mx-auto">
                    <h2 className="font-serif text-[36px] text-text mb-4">A Structural Error Occurred</h2>
                    <p className="font-sans text-[15px] text-muted mb-10 leading-relaxed">
                        The platform encountered an unexpected anomaly. Our engineers have been notified.
                        You may attempt to reload the interface or return safely to the exhibition.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={() => reset()}
                            className="px-8 py-4 bg-white text-black text-[11px] uppercase tracking-[0.15em] font-bold transition-all duration-300 hover:bg-gray-200"
                        >
                            Attempt Recovery
                        </button>
                        <Link
                            href="/"
                            className="px-8 py-4 border border-outline-variant/30 text-text uppercase text-[11px] tracking-[0.2em] font-medium transition-colors duration-[600ms] ease-editorial hover:border-primary hover:text-primary"
                        >
                            Return Home
                        </Link>
                    </div>
                </div>
            </Section>
        </div>
    );
}
