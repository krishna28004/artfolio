/** Display-size correction used on the dedicated artwork detail experience. */
export function formatArtworkDimensions(dimensions: string | undefined): string {
  return (dimensions || "").replace(/\bA3\b/g, "A4");
}
