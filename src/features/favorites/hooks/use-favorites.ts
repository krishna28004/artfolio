"use client";

import { useEffect, useState } from "react";

const FAVORITES_KEY = "artfolio_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      queueMicrotask(() => {
        setFavorites(parsed);
      });
    } catch (error) {
      console.error("Failed to parse favorites", error);
    }
  }, []);

  const toggleFavorite = (id: string) => {
    const nextFavorites = favorites.includes(id)
      ? favorites.filter((favId) => favId !== id)
      : [...favorites, id];

    setFavorites(nextFavorites);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites));
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}
