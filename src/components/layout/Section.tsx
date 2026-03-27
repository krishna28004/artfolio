import { ReactNode } from "react";
import { Container } from "./Container";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

export function Section({ children, className = "", containerClassName = "" }: SectionProps) {
  return (
    <section className={`py-12 md:py-16 lg:py-24 ${className}`}>
      <Container className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}
