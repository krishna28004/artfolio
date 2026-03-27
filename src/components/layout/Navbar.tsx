import { Container } from "./Container";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="text-xl font-bold text-accent">Artfolio</div>
          <nav className="flex gap-6">
            <a href="#" className="text-sm font-medium text-text hover:text-accent transition-colors">Works</a>
            <a href="#" className="text-sm font-medium text-text hover:text-accent transition-colors">About</a>
            <a href="#" className="text-sm font-medium text-text hover:text-accent transition-colors">Contact</a>
          </nav>
        </div>
      </Container>
    </header>
  );
}
