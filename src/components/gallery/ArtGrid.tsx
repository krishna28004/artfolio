import { ReactNode } from "react";

interface ArtGridProps {
  children: ReactNode;
}

export function ArtGrid({ children }: ArtGridProps) {
  // Simple, uniform layout block. No complex span handling.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 lg:gap-x-12 gap-y-16 lg:gap-y-24">
      {children}
    </div>
  );
}
