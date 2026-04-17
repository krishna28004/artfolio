import { ReactNode } from "react";
import { Container } from "./Container";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
}

export function Section({ children, className = "", containerClassName = "", id }: SectionProps) {
  return (
    <section id={id} className={`py-16 md:py-24 lg:py-32 relative ${className}`}>
      <Container className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}
