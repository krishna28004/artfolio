"use client";

import { useEffect, useState } from "react";
import { FAVORITES_KEY, parseFavorites, toggleFavoriteId } from "./favorites-storage";

const FAVORITES_CHANGED = "artfolio:favorites-changed";
let sessionFavorites: string[] = [];

function readFavorites(): string[] {
  try { sessionFavorites = parseFavorites(localStorage.getItem(FAVORITES_KEY)); }
  catch { /* Browser storage can be disabled; keep this tab's current selection. */ }
  return sessionFavorites;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    let active = true;
    queueMicrotask(() => { if (active) sync(); });
    window.addEventListener(FAVORITES_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener(FAVORITES_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleFavorite = (id: string) => {
    const nextFavorites = toggleFavoriteId(readFavorites(), id);
    sessionFavorites = nextFavorites;
    setFavorites(nextFavorites);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites)); }
    catch { /* Keep the current page usable when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(FAVORITES_CHANGED));
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}
