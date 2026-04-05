"use client";
import { useState, useEffect } from 'react';

// Generates a consistent "high-end" mock view count based on artwork ID string
// This ensures the numbers look real but don't jump around on refreshes.
const getMockViews = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 2000) + 800; // Returns something between 800 and 2800
};

export function useViewCount(artworkId: string) {
    const [views, setViews] = useState<number>(0);

    useEffect(() => {
        // For now, we simulate the "Subtle" metric
        const baseViews = getMockViews(artworkId);
        queueMicrotask(() => {
            setViews(baseViews);
        });
    }, [artworkId]);

    return { views: views.toLocaleString() };
}
