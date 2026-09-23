"use client";

import { useEffect, useState } from "react";


export function useViewCount(artworkId: string) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!artworkId) return;

    // Record authentic view telemetry
    fetch(`/api/artworks/${encodeURIComponent(artworkId)}/view`, {
      method: "POST",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.views === "number") {
          setViews(data.views);
        }
      })
      .catch(() => {
        // Telemetry failure fails silently without fabricating counts
      });

    return () => {
      isMounted = false;
    };
  }, [artworkId]);

  return { views: views !== null ? views.toLocaleString() : null };
}
