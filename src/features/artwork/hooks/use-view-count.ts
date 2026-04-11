"use client";

import { useEffect, useState } from "react";

const getMockViews = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 2000) + 800;
};

export function useViewCount(artworkId: string) {
  const [views, setViews] = useState<number>(0);

  useEffect(() => {
    const baseViews = getMockViews(artworkId);
    queueMicrotask(() => {
      setViews(baseViews);
    });
  }, [artworkId]);

  return { views: views.toLocaleString() };
}
