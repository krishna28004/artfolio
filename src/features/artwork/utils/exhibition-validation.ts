/**
 * Exhibition 3D Data Validation and Geometry Calculation Utilities
 */

export interface GalleryBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const ROOM_BOUNDS: GalleryBounds = {
  minX: -25,
  maxX: 25,
  minY: 0,
  maxY: 7,
  minZ: -40,
  maxZ: 40,
};

export const VISITOR_BOUNDS = {
  minX: -23,
  maxX: 23,
  minZ: -38,
  maxZ: 38,
};

/**
 * Validates that a 3D position is a finite 3-element numeric tuple within gallery boundaries.
 */
export function isValid3DPosition(pos: unknown): pos is [number, number, number] {
  if (!Array.isArray(pos) || pos.length !== 3) return false;
  const [x, y, z] = pos;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;

  return (
    x >= ROOM_BOUNDS.minX &&
    x <= ROOM_BOUNDS.maxX &&
    y >= ROOM_BOUNDS.minY &&
    y <= ROOM_BOUNDS.maxY &&
    z >= ROOM_BOUNDS.minZ &&
    z <= ROOM_BOUNDS.maxZ
  );
}

/**
 * Validates that a 3D rotation is a finite 3-element numeric tuple.
 */
export function isValid3DRotation(rot: unknown): rot is [number, number, number] {
  if (!Array.isArray(rot) || rot.length !== 3) return false;
  const [rx, ry, rz] = rot;
  return Number.isFinite(rx) && Number.isFinite(ry) && Number.isFinite(rz);
}

export interface FrameDimensions {
  artWidth: number;
  artHeight: number;
  matWidth: number;
  matHeight: number;
  frameWidth: number;
  frameHeight: number;
  aspect: number;
}

/**
 * Calculates display dimensions preserving the image's original aspect ratio.
 * Computes harmonious matting and frame outer borders without distorting the artwork.
 *
 * @param textureWidth  Original image texture width in pixels
 * @param textureHeight Original image texture height in pixels
 * @param maxDim        Maximum physical dimension for the artwork canvas (default: 1.6 meters)
 * @param mattingBorder Uniform margin for the matting around the canvas (default: 0.10 meters)
 * @param frameBorder   Outer frame thickness (default: 0.04 meters)
 */
export function calculateFrameDimensions(
  textureWidth?: number,
  textureHeight?: number,
  maxDim: number = 1.6,
  mattingBorder: number = 0.10,
  frameBorder: number = 0.04
): FrameDimensions {
  let aspect = 0.75; // Default portrait A3 aspect ratio (3:4)

  if (
    typeof textureWidth === "number" &&
    typeof textureHeight === "number" &&
    textureWidth > 0 &&
    textureHeight > 0
  ) {
    aspect = textureWidth / textureHeight;
    // Clamp extreme aspect ratios to prevent scene-breaking distortion
    aspect = Math.max(0.3, Math.min(3.0, aspect));
  }

  let artWidth: number;
  let artHeight: number;

  if (aspect >= 1) {
    // Landscape or square
    artWidth = maxDim;
    artHeight = maxDim / aspect;
  } else {
    // Portrait
    artHeight = maxDim;
    artWidth = maxDim * aspect;
  }

  const matWidth = artWidth + mattingBorder * 2;
  const matHeight = artHeight + mattingBorder * 2;
  const frameWidth = matWidth + frameBorder * 2;
  const frameHeight = matHeight + frameBorder * 2;

  const round = (val: number) => Math.round(val * 10000) / 10000;

  return {
    artWidth: round(artWidth),
    artHeight: round(artHeight),
    matWidth: round(matWidth),
    matHeight: round(matHeight),
    frameWidth: round(frameWidth),
    frameHeight: round(frameHeight),
    aspect: round(aspect),
  };
}

/**
 * Clamps a floor point to safe walkable room boundaries.
 */
export function clampToWalkableBounds(
  x: number,
  z: number,
  bounds = VISITOR_BOUNDS
): { x: number; z: number } {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, z)),
  };
}
