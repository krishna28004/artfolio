import { MUSEUM_ARTWORKS } from "@/components/exhibition/config/museum.config";

export interface MuseumSlot {
  id: string;
  label: string;
  initialArtworkId: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

const names: Record<string, { id: string; label: string }> = {
  "sorcerer-supreme": { id: "sanctuary-apex", label: "Featured Sanctuary · Apex" },
  "the-curious-mr-bean": { id: "entrance-west", label: "Grand Entrance · West" },
  "luminous-veil": { id: "main-west-1", label: "Main Hall · West 1" },
  "sovereign-gaze": { id: "main-west-2", label: "Main Hall · West 2" },
  "the-dreamer": { id: "main-east-1", label: "Main Hall · East 1" },
  "behind-the-lens": { id: "main-east-2", label: "Main Hall · East 2" },
  "monsoon-child": { id: "west-gallery-1", label: "West Gallery · 1" },
  "tears-in-the-rain": { id: "west-gallery-2", label: "West Gallery · 2" },
  "radiant-spirit": { id: "east-wing-1", label: "East Wing · 1" },
  "chrome-elegy": { id: "east-wing-2", label: "East Wing · 2" },
};

/** Room coordinates come from the existing museum configuration. */
export const MUSEUM_SLOTS: MuseumSlot[] = MUSEUM_ARTWORKS.map((artwork) => ({
  id: names[artwork.id].id,
  label: names[artwork.id].label,
  initialArtworkId: artwork.id,
  position: artwork.position,
  rotation: artwork.rotation || [0, 0, 0],
}));

export function getMuseumSlot(id: string | null | undefined) {
  return MUSEUM_SLOTS.find((slot) => slot.id === id) || null;
}
