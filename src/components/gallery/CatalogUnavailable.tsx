"use client";

export function CatalogUnavailable({ href = "/#gallery" }: { href?: string }) {
  return (
    <div role="alert" className="border border-white/15 px-6 py-10 text-center">
      <p className="font-serif text-xl text-text">The collection is temporarily unavailable.</p>
      <p className="mt-3 text-sm text-muted">Please try again shortly. Your saved artwork choices are unchanged.</p>
      <a href={href} onClick={(event) => { event.preventDefault(); window.location.reload(); }} className="mt-5 inline-flex min-h-11 items-center border-b border-primary px-3 text-xs uppercase tracking-widest text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        Try again
      </a>
    </div>
  );
}
