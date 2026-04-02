import { ReactNode } from "react";

interface ArtGridProps {
  children: ReactNode;
}

export function ArtGrid({ children }: ArtGridProps) {
  // Simple, uniform layout block. No complex span handling.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
      {children}
    </div>
  );
}
