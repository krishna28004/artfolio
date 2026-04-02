import { Container } from "./Container";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="text-xl font-bold text-accent">Artfolio</div>
          <nav className="flex gap-6">
            <Link href="/" className="text-sm font-medium text-text transition-colors duration-[500ms] hover:text-accent">Exhibition</Link>
            <Link href="/commission" className="text-sm font-medium text-text transition-colors duration-[500ms] hover:text-accent">Commission</Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
