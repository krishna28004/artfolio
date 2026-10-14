export const FAVORITES_KEY = "artfolio_favorites";

export function parseFavorites(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
  } catch {
    return [];
  }
}

export function toggleFavoriteId(favorites: string[], id: string): string[] {
  return favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
}
