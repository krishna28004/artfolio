"use client";
import { useState, useEffect } from 'react';

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    // Initialize from localStorage safely after mount
    useEffect(() => {
        const saved = localStorage.getItem('artfolio_favorites');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // We use a microtask to ensure this doesn't block the initial paint
                // and satisfies strict React 19 effect rules.
                queueMicrotask(() => {
                    setFavorites(parsed);
                });
            } catch (e) {
                console.error("Failed to parse favorites", e);
            }
        }
    }, []);

    const toggleFavorite = (id: string) => {
        const newFavorites = favorites.includes(id)
            ? favorites.filter(favId => favId !== id)
            : [...favorites, id];

        setFavorites(newFavorites);
        localStorage.setItem('artfolio_favorites', JSON.stringify(newFavorites));
    };

    const isFavorite = (id: string) => favorites.includes(id);

    return { favorites, toggleFavorite, isFavorite };
}
