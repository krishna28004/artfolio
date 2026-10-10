/**
 * Artfolio Virtual Museum — Architecture & Floor Plan Configuration
 *
 * Isolated, data-only configuration defining the multi-room virtual art museum.
 * Coordinate conventions:
 * - World Units: Meters (1 unit = 1 meter)
 * - X-axis: Horizontal transverse (West = -X, East = +X)
 * - Y-axis: Vertical elevation (Floor = 0, Eye-level = 1.65m, Ceiling = 4.8m to 5.2m)
 * - Z-axis: Horizontal longitudinal (North/Deep Galleries = -Z, South/Entrance = +Z)
 */

export type Vector2D = [number, number]; // [x, z]
export type Vector3D = [number, number, number]; // [x, y, z]

export type FrameStyle =
  | "gold-gilt"
  | "dark-walnut"
  | "black-metal"
  | "ornate-baroque"
  | "minimalist-oak";

export type FloorType =
  | "walnut-herringbone"
  | "dark-oak-plank"
  | "limestone-tile"
  | "polished-marble";

export type WallTheme =
  | "charcoal-matte"
  | "deep-slate"
  | "muted-teal"
  | "warm-grey";

export interface WallSegment {
  id: string;
  name?: string;
  start: Vector2D;
  end: Vector2D;
  thickness: number;
  height: number;
  doorwayIds?: string[];
  theme?: WallTheme;
}

export interface Doorway {
  id: string;
  name: string;
  fromRoomId: string;
  toRoomId: string;
  position: Vector3D;
  width: number;
  height: number;
  normal: Vector2D;
  wallId: string;
}

export interface ArtworkSlot {
  id: string;
  roomId: string;
  wallId: string;
  position: Vector3D;
  rotation: Vector3D;
  dimensions: {
    maxWidth: number;
    maxHeight: number;
  };
  frameStyle: FrameStyle;
  hasPlaque: boolean;
  plaquePosition?: "right" | "left" | "bottom";
  isFeatured?: boolean;
  spotlightColor?: string;
  spotlightIntensity?: number;
}

export interface WaypointNode {
  id: string;
  roomId: string;
  position: Vector3D;
  neighborIds: string[];
  type: "spawn" | "doorway" | "poi" | "gallery-walk";
  label?: string;
}

export interface PointOfInterest {
  id: string;
  roomId: string;
  name: string;
  position: Vector3D;
  description?: string;
  type: "bench" | "pedestal" | "skylight" | "focal-wall";
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Room {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  bounds: RoomBounds;
  ceilingHeight: number;
  theme: WallTheme;
  floorType: FloorType;
  wallIds: string[];
  doorwayIds: string[];
  artworkSlotIds: string[];
  poiIds?: string[];
}

export interface MuseumConfig {
  id: string;
  title: string;
  version: string;
  author: string;
  constants: {
    wallThickness: number;
    defaultCeilingHeight: number;
    playerRadius: number;
    eyeHeight: number;
    doorwayWidth: number;
    doorwayHeight: number;
  };
  spawn: {
    position: Vector3D;
    lookAt: Vector3D;
    yaw: number;
  };
  rooms: Room[];
  walls: WallSegment[];
  doorways: Doorway[];
  artworkSlots: ArtworkSlot[];
  waypoints: WaypointNode[];
  pointsOfInterest: PointOfInterest[];
}

export const MUSEUM_CONSTANTS = {
  wallThickness: 0.3,
  defaultCeilingHeight: 4.8,
  playerRadius: 0.35,
  eyeHeight: 1.65,
  doorwayWidth: 2.4,
  doorwayHeight: 3.2,
};

export const MUSEUM_CONFIG: MuseumConfig = {
  id: "artfolio-museum-v1",
  title: "The National Graphite & Fine Art Pavilion",
  version: "1.0.0",
  author: "Krishna Kumar",
  constants: MUSEUM_CONSTANTS,

  spawn: {
    position: [0, 1.65, 27],
    lookAt: [0, 1.65, 0], // Looking directly North into the grand central gallery axis
    yaw: 0,
  },

  rooms: [
    {
      id: "room-entrance",
      name: "Grand Entrance Gallery",
      subtitle: "Orientation, Curatorial Welcome & Overview",
      description:
        "The ceremonial portico with tall arched portals presenting a direct axial sightline into the Main Exhibition Hall.",
      bounds: { minX: -8, maxX: 8, minZ: 18, maxZ: 30 },
      ceilingHeight: 4.8,
      theme: "charcoal-matte",
      floorType: "walnut-herringbone",
      wallIds: ["w-ent-s", "w-ent-w", "w-ent-e", "w-ent-n"],
      doorwayIds: ["d-ent-main", "d-ent-east"],
      artworkSlotIds: ["slot-ent-w1", "slot-ent-w2"],
      poiIds: ["poi-welcome-plaque"],
    },
    {
      id: "room-main",
      name: "Main Exhibition Hall",
      subtitle: "The Central Rotunda & Masterpiece Salon",
      description:
        "The grand central atrium featuring an illuminated architectural ceiling coffer, central gallery bench, and interconnected wings.",
      bounds: { minX: -10, maxX: 10, minZ: -6, maxZ: 18 },
      ceilingHeight: 5.2,
      theme: "deep-slate",
      floorType: "walnut-herringbone",
      wallIds: ["w-main-s", "w-main-w", "w-main-e", "w-main-n"],
      doorwayIds: ["d-ent-main", "d-main-west", "d-main-east", "d-main-corridor"],
      artworkSlotIds: ["slot-main-w1", "slot-main-w2", "slot-main-e1", "slot-main-e2"],
      poiIds: ["poi-main-bench", "poi-main-skylight"],
    },
    {
      id: "room-west",
      name: "West Gallery",
      subtitle: "Graphite Realism Salon & Studies",
      description:
        "An intimate, moody salon dedicated to hyper-realistic pencil textures, natural light studies, and wildlife graphite masterworks.",
      bounds: { minX: -26, maxX: -10, minZ: -3, maxZ: 15 },
      ceilingHeight: 4.5,
      theme: "charcoal-matte",
      floorType: "dark-oak-plank",
      wallIds: ["w-west-s", "w-west-w", "w-west-n", "w-west-e"],
      doorwayIds: ["d-main-west", "d-west-corridor"],
      artworkSlotIds: ["slot-west-w1", "slot-west-w2", "slot-west-s1"],
      poiIds: ["poi-west-bench"],
    },
    {
      id: "room-east",
      name: "East Wing",
      subtitle: "Master Portraiture & Character Studies",
      description:
        "Dedicated wing presenting intricate portraiture, facial expression studies, and emotional graphite renderings.",
      bounds: { minX: 10, maxX: 26, minZ: -3, maxZ: 24 },
      ceilingHeight: 4.5,
      theme: "muted-teal",
      floorType: "dark-oak-plank",
      wallIds: ["w-east-s", "w-east-e", "w-east-n", "w-east-w"],
      doorwayIds: ["d-ent-east", "d-main-east", "d-east-corridor"],
      artworkSlotIds: ["slot-east-e1", "slot-east-e2", "slot-east-n1"],
      poiIds: ["poi-east-bench"],
    },
    {
      id: "room-corridor",
      name: "Central Connecting Vestibule",
      subtitle: "The Sculpture Court & Transition Hall",
      description:
        "Transverse architectural connector linking the West Salon, Main Hall, East Wing, and the premier Featured Masterpiece Sanctuary.",
      bounds: { minX: -12, maxX: 12, minZ: -16, maxZ: -6 },
      ceilingHeight: 4.8,
      theme: "warm-grey",
      floorType: "limestone-tile",
      wallIds: ["w-corr-s", "w-corr-w", "w-corr-e", "w-corr-n"],
      doorwayIds: ["d-main-corridor", "d-west-corridor", "d-east-corridor", "d-corr-feat"],
      artworkSlotIds: ["slot-corr-w1", "slot-corr-e1"],
      poiIds: ["poi-central-pedestal"],
    },
    {
      id: "room-featured",
      name: "Featured Masterpiece Sanctuary",
      subtitle: "The Apex Crown Jewel Exhibition",
      description:
        "An exclusive, cathedral-scale showcase room with dedicated focal spotlighting for Artfolio's premier acquisition piece.",
      bounds: { minX: -9, maxX: 9, minZ: -36, maxZ: -16 },
      ceilingHeight: 5.2,
      theme: "deep-slate",
      floorType: "polished-marble",
      wallIds: ["w-feat-s", "w-feat-w", "w-feat-e", "w-feat-n"],
      doorwayIds: ["d-corr-feat"],
      artworkSlotIds: ["slot-feat-north-apex", "slot-feat-w1", "slot-feat-e1"],
      poiIds: ["poi-feat-bench", "poi-feat-apex-spot"],
    },
  ],

  walls: [
    // --- Room 1: Grand Entrance Gallery Walls ---
    { id: "w-ent-s", start: [-8, 30], end: [8, 30], thickness: 0.3, height: 4.8 },
    { id: "w-ent-w", start: [-8, 18], end: [-8, 30], thickness: 0.3, height: 4.8 },
    { id: "w-ent-e", start: [8, 18], end: [8, 30], thickness: 0.3, height: 4.8, doorwayIds: ["d-ent-east"] },
    { id: "w-ent-n", start: [-8, 18], end: [8, 18], thickness: 0.3, height: 4.8, doorwayIds: ["d-ent-main"] },

    // --- Room 2: Main Exhibition Hall Walls ---
    { id: "w-main-s", start: [-10, 18], end: [10, 18], thickness: 0.3, height: 5.2, doorwayIds: ["d-ent-main"] },
    { id: "w-main-w", start: [-10, -6], end: [-10, 18], thickness: 0.3, height: 5.2, doorwayIds: ["d-main-west"] },
    { id: "w-main-e", start: [10, -6], end: [10, 18], thickness: 0.3, height: 5.2, doorwayIds: ["d-main-east"] },
    { id: "w-main-n", start: [-10, -6], end: [10, -6], thickness: 0.3, height: 5.2, doorwayIds: ["d-main-corridor"] },

    // --- Room 3: West Gallery Walls ---
    { id: "w-west-s", start: [-26, 15], end: [-10, 15], thickness: 0.3, height: 4.5 },
    { id: "w-west-w", start: [-26, -3], end: [-26, 15], thickness: 0.3, height: 4.5 },
    { id: "w-west-n", start: [-26, -3], end: [-10, -3], thickness: 0.3, height: 4.5, doorwayIds: ["d-west-corridor"] },
    { id: "w-west-e", start: [-10, -3], end: [-10, 15], thickness: 0.3, height: 4.5, doorwayIds: ["d-main-west"] },

    // --- Room 4: East Wing Walls ---
    { id: "w-east-s", start: [8, 24], end: [26, 24], thickness: 0.3, height: 4.5, doorwayIds: ["d-ent-east"] },
    { id: "w-east-e", start: [26, -3], end: [26, 24], thickness: 0.3, height: 4.5 },
    { id: "w-east-n", start: [10, -3], end: [26, -3], thickness: 0.3, height: 4.5, doorwayIds: ["d-east-corridor"] },
    { id: "w-east-w", start: [10, -3], end: [10, 24], thickness: 0.3, height: 4.5, doorwayIds: ["d-main-east"] },

    // --- Room 5: Central Connecting Vestibule Walls ---
    { id: "w-corr-s", start: [-12, -6], end: [12, -6], thickness: 0.3, height: 4.8, doorwayIds: ["d-main-corridor", "d-west-corridor", "d-east-corridor"] },
    { id: "w-corr-w", start: [-12, -16], end: [-12, -6], thickness: 0.3, height: 4.8 },
    { id: "w-corr-e", start: [12, -16], end: [12, -6], thickness: 0.3, height: 4.8 },
    { id: "w-corr-n", start: [-12, -16], end: [12, -16], thickness: 0.3, height: 4.8, doorwayIds: ["d-corr-feat"] },

    // --- Room 6: Featured Masterpiece Sanctuary Walls ---
    { id: "w-feat-s", start: [-9, -16], end: [9, -16], thickness: 0.3, height: 5.2, doorwayIds: ["d-corr-feat"] },
    { id: "w-feat-w", start: [-9, -36], end: [-9, -16], thickness: 0.3, height: 5.2 },
    { id: "w-feat-e", start: [9, -36], end: [9, -16], thickness: 0.3, height: 5.2 },
    { id: "w-feat-n", start: [-9, -36], end: [9, -36], thickness: 0.3, height: 5.2 },
  ],

  doorways: [
    {
      id: "d-ent-main",
      name: "Grand Portico Entrance Portal",
      fromRoomId: "room-entrance",
      toRoomId: "room-main",
      position: [0, 0, 18],
      width: 2.8,
      height: 3.6,
      normal: [0, -1],
      wallId: "w-ent-n",
    },
    {
      id: "d-ent-east",
      name: "Portico Promenade Connector",
      fromRoomId: "room-entrance",
      toRoomId: "room-east",
      position: [8, 0, 24],
      width: 2.2,
      height: 3.2,
      normal: [1, 0],
      wallId: "w-ent-e",
    },
    {
      id: "d-main-west",
      name: "West Salon Archway",
      fromRoomId: "room-main",
      toRoomId: "room-west",
      position: [-10, 0, 6],
      width: 2.4,
      height: 3.2,
      normal: [-1, 0],
      wallId: "w-main-w",
    },
    {
      id: "d-main-east",
      name: "East Wing Archway",
      fromRoomId: "room-main",
      toRoomId: "room-east",
      position: [10, 0, 6],
      width: 2.4,
      height: 3.2,
      normal: [1, 0],
      wallId: "w-main-e",
    },
    {
      id: "d-main-corridor",
      name: "Transverse Gallery Passage",
      fromRoomId: "room-main",
      toRoomId: "room-corridor",
      position: [0, 0, -6],
      width: 2.6,
      height: 3.4,
      normal: [0, -1],
      wallId: "w-main-n",
    },
    {
      id: "d-west-corridor",
      name: "West Vestibule Connector",
      fromRoomId: "room-west",
      toRoomId: "room-corridor",
      position: [-11, 0, -5],
      width: 2.2,
      height: 3.0,
      normal: [0, -1],
      wallId: "w-west-n",
    },
    {
      id: "d-east-corridor",
      name: "East Vestibule Connector",
      fromRoomId: "room-east",
      toRoomId: "room-corridor",
      position: [11, 0, -5],
      width: 2.2,
      height: 3.0,
      normal: [0, -1],
      wallId: "w-east-n",
    },
    {
      id: "d-corr-feat",
      name: "Sanctuary Grand Ceremonial Portal",
      fromRoomId: "room-corridor",
      toRoomId: "room-featured",
      position: [0, 0, -16],
      width: 3.0,
      height: 3.8,
      normal: [0, -1],
      wallId: "w-corr-n",
    },
  ],

  artworkSlots: [
    // Entrance Gallery (2 Slots)
    {
      id: "slot-ent-w1",
      roomId: "room-entrance",
      wallId: "w-ent-w",
      position: [-7.85, 1.6, 22],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "dark-walnut",
      hasPlaque: true,
      plaquePosition: "right",
    },
    {
      id: "slot-ent-w2",
      roomId: "room-entrance",
      wallId: "w-ent-w",
      position: [-7.85, 1.6, 26],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "dark-walnut",
      hasPlaque: true,
      plaquePosition: "right",
    },

    // Main Hall (4 Slots)
    {
      id: "slot-main-w1",
      roomId: "room-main",
      wallId: "w-main-w",
      position: [-9.85, 1.6, 12],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "right",
      spotlightIntensity: 180,
    },
    {
      id: "slot-main-w2",
      roomId: "room-main",
      wallId: "w-main-w",
      position: [-9.85, 1.6, 0],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "right",
      spotlightIntensity: 180,
    },
    {
      id: "slot-main-e1",
      roomId: "room-main",
      wallId: "w-main-e",
      position: [9.85, 1.6, 12],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "left",
      spotlightIntensity: 180,
    },
    {
      id: "slot-main-e2",
      roomId: "room-main",
      wallId: "w-main-e",
      position: [9.85, 1.6, 0],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "left",
      spotlightIntensity: 180,
    },

    // West Gallery (3 Slots)
    {
      id: "slot-west-w1",
      roomId: "room-west",
      wallId: "w-west-w",
      position: [-25.85, 1.6, 3],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "black-metal",
      hasPlaque: true,
      plaquePosition: "right",
    },
    {
      id: "slot-west-w2",
      roomId: "room-west",
      wallId: "w-west-w",
      position: [-25.85, 1.6, 9],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "black-metal",
      hasPlaque: true,
      plaquePosition: "right",
    },
    {
      id: "slot-west-s1",
      roomId: "room-west",
      wallId: "w-west-s",
      position: [-18, 1.6, 14.85],
      rotation: [0, Math.PI, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.0 },
      frameStyle: "dark-walnut",
      hasPlaque: true,
      plaquePosition: "right",
    },

    // East Wing (3 Slots)
    {
      id: "slot-east-e1",
      roomId: "room-east",
      wallId: "w-east-e",
      position: [25.85, 1.6, 3],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "ornate-baroque",
      hasPlaque: true,
      plaquePosition: "left",
    },
    {
      id: "slot-east-e2",
      roomId: "room-east",
      wallId: "w-east-e",
      position: [25.85, 1.6, 11],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.6, maxHeight: 2.0 },
      frameStyle: "ornate-baroque",
      hasPlaque: true,
      plaquePosition: "left",
    },
    {
      id: "slot-east-n1",
      roomId: "room-east",
      wallId: "w-east-n",
      position: [18, 1.6, -2.85],
      rotation: [0, 0, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.0 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "right",
    },

    // Central Vestibule (2 Slots)
    {
      id: "slot-corr-w1",
      roomId: "room-corridor",
      wallId: "w-corr-w",
      position: [-11.85, 1.6, -11],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.5, maxHeight: 1.8 },
      frameStyle: "minimalist-oak",
      hasPlaque: true,
      plaquePosition: "right",
    },
    {
      id: "slot-corr-e1",
      roomId: "room-corridor",
      wallId: "w-corr-e",
      position: [11.85, 1.6, -11],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.5, maxHeight: 1.8 },
      frameStyle: "minimalist-oak",
      hasPlaque: true,
      plaquePosition: "left",
    },

    // Featured Sanctuary (3 Slots)
    {
      id: "slot-feat-north-apex",
      roomId: "room-featured",
      wallId: "w-feat-n",
      position: [0, 1.8, -35.85],
      rotation: [0, 0, 0],
      dimensions: { maxWidth: 2.4, maxHeight: 2.8 },
      frameStyle: "ornate-baroque",
      hasPlaque: true,
      plaquePosition: "right",
      isFeatured: true,
      spotlightColor: "#fff7e6",
      spotlightIntensity: 300,
    },
    {
      id: "slot-feat-w1",
      roomId: "room-featured",
      wallId: "w-feat-w",
      position: [-8.85, 1.6, -26],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "right",
      spotlightIntensity: 200,
    },
    {
      id: "slot-feat-e1",
      roomId: "room-featured",
      wallId: "w-feat-e",
      position: [8.85, 1.6, -26],
      rotation: [0, -Math.PI / 2, 0],
      dimensions: { maxWidth: 1.8, maxHeight: 2.2 },
      frameStyle: "gold-gilt",
      hasPlaque: true,
      plaquePosition: "left",
      spotlightIntensity: 200,
    },
  ],

  pointsOfInterest: [
    {
      id: "poi-welcome-plaque",
      roomId: "room-entrance",
      name: "Curatorial Welcome Plaque",
      position: [2.5, 1.4, 27],
      description: "Introductory essay on Krishna Kumar's fine graphite explorations.",
      type: "focal-wall",
    },
    {
      id: "poi-main-bench",
      roomId: "room-main",
      name: "Rotunda Leather Viewing Bench",
      position: [0, 0.45, 6],
      description: "Central seating for long contemplation of the main gallery walls.",
      type: "bench",
    },
    {
      id: "poi-main-skylight",
      roomId: "room-main",
      name: "Architectural Ceiling Coffer & Track Rig",
      position: [0, 5.2, 6],
      description: "Overhead recessed architectural skylight with ambient fill.",
      type: "skylight",
    },
    {
      id: "poi-west-bench",
      roomId: "room-west",
      name: "West Salon Rest Bench",
      position: [-18, 0.45, 6],
      type: "bench",
    },
    {
      id: "poi-east-bench",
      roomId: "room-east",
      name: "East Wing Rest Bench",
      position: [18, 0.45, 11],
      type: "bench",
    },
    {
      id: "poi-central-pedestal",
      roomId: "room-corridor",
      name: "Center Vestibule Bronze Sculpture Pedestal",
      position: [0, 0.6, -11],
      description: "Centerpiece bronze cast on dark limestone plinth.",
      type: "pedestal",
    },
    {
      id: "poi-feat-bench",
      roomId: "room-featured",
      name: "Apex Sanctuary Velvet Bench",
      position: [0, 0.45, -24],
      type: "bench",
    },
    {
      id: "poi-feat-apex-spot",
      roomId: "room-featured",
      name: "Masterpiece Focal Spotlight",
      position: [0, 4.8, -33],
      type: "focal-wall",
    },
  ],

  waypoints: [
    {
      id: "wp-spawn",
      roomId: "room-entrance",
      position: [0, 1.65, 27],
      neighborIds: ["wp-ent-center", "wp-d-ent-east"],
      type: "spawn",
      label: "Museum Entrance",
    },
    {
      id: "wp-ent-center",
      roomId: "room-entrance",
      position: [0, 1.65, 22],
      neighborIds: ["wp-spawn", "wp-d-ent-main", "wp-d-ent-east"],
      type: "gallery-walk",
    },
    {
      id: "wp-d-ent-main",
      roomId: "room-entrance",
      position: [0, 1.65, 18],
      neighborIds: ["wp-ent-center", "wp-main-south"],
      type: "doorway",
      label: "Portal: Entrance -> Main",
    },
    {
      id: "wp-d-ent-east",
      roomId: "room-entrance",
      position: [8, 1.65, 24],
      neighborIds: ["wp-spawn", "wp-ent-center", "wp-east-south"],
      type: "doorway",
      label: "Portal: Entrance -> East Wing",
    },
    {
      id: "wp-main-south",
      roomId: "room-main",
      position: [0, 1.65, 14],
      neighborIds: ["wp-d-ent-main", "wp-main-center"],
      type: "gallery-walk",
    },
    {
      id: "wp-main-center",
      roomId: "room-main",
      position: [0, 1.65, 6],
      neighborIds: ["wp-main-south", "wp-main-north", "wp-d-main-west", "wp-d-main-east"],
      type: "poi",
      label: "Main Rotunda Center",
    },
    {
      id: "wp-main-north",
      roomId: "room-main",
      position: [0, 1.65, -2],
      neighborIds: ["wp-main-center", "wp-d-main-corr"],
      type: "gallery-walk",
    },
    {
      id: "wp-d-main-west",
      roomId: "room-main",
      position: [-10, 1.65, 6],
      neighborIds: ["wp-main-center", "wp-west-center"],
      type: "doorway",
      label: "Portal: Main -> West",
    },
    {
      id: "wp-d-main-east",
      roomId: "room-main",
      position: [10, 1.65, 6],
      neighborIds: ["wp-main-center", "wp-east-center"],
      type: "doorway",
      label: "Portal: Main -> East",
    },
    {
      id: "wp-west-center",
      roomId: "room-west",
      position: [-18, 1.65, 6],
      neighborIds: ["wp-d-main-west", "wp-d-west-corr"],
      type: "poi",
      label: "West Salon Center",
    },
    {
      id: "wp-d-west-corr",
      roomId: "room-west",
      position: [-11, 1.65, -5],
      neighborIds: ["wp-west-center", "wp-corr-west"],
      type: "doorway",
      label: "Portal: West -> Vestibule",
    },
    {
      id: "wp-east-south",
      roomId: "room-east",
      position: [14, 1.65, 20],
      neighborIds: ["wp-d-ent-east", "wp-east-center"],
      type: "gallery-walk",
    },
    {
      id: "wp-east-center",
      roomId: "room-east",
      position: [18, 1.65, 6],
      neighborIds: ["wp-east-south", "wp-d-main-east", "wp-d-east-corr"],
      type: "poi",
      label: "East Wing Center",
    },
    {
      id: "wp-d-east-corr",
      roomId: "room-east",
      position: [11, 1.65, -5],
      neighborIds: ["wp-east-center", "wp-corr-east"],
      type: "doorway",
      label: "Portal: East -> Vestibule",
    },
    {
      id: "wp-d-main-corr",
      roomId: "room-main",
      position: [0, 1.65, -6],
      neighborIds: ["wp-main-north", "wp-corr-center"],
      type: "doorway",
      label: "Portal: Main -> Vestibule",
    },
    {
      id: "wp-corr-west",
      roomId: "room-corridor",
      position: [-7, 1.65, -11],
      neighborIds: ["wp-d-west-corr", "wp-corr-center"],
      type: "gallery-walk",
    },
    {
      id: "wp-corr-center",
      roomId: "room-corridor",
      position: [0, 1.65, -11],
      neighborIds: ["wp-d-main-corr", "wp-corr-west", "wp-corr-east", "wp-d-corr-feat"],
      type: "poi",
      label: "Central Sculpture Court",
    },
    {
      id: "wp-corr-east",
      roomId: "room-corridor",
      position: [7, 1.65, -11],
      neighborIds: ["wp-d-east-corr", "wp-corr-center"],
      type: "gallery-walk",
    },
    {
      id: "wp-d-corr-feat",
      roomId: "room-corridor",
      position: [0, 1.65, -16],
      neighborIds: ["wp-corr-center", "wp-feat-center"],
      type: "doorway",
      label: "Portal: Vestibule -> Sanctuary",
    },
    {
      id: "wp-feat-center",
      roomId: "room-featured",
      position: [0, 1.65, -26],
      neighborIds: ["wp-d-corr-feat", "wp-feat-apex"],
      type: "poi",
      label: "Sanctuary Center",
    },
    {
      id: "wp-feat-apex",
      roomId: "room-featured",
      position: [0, 1.65, -33],
      neighborIds: ["wp-feat-center"],
      type: "poi",
      label: "Masterpiece Viewing Stance",
    },
  ],
};

/**
 * Validates a MuseumConfig object for integrity, graph connectivity, and coordinate sanity.
 */
export function validateMuseumConfig(config: MuseumConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const roomIds = new Set<string>();
  const wallIds = new Set<string>();
  const doorwayIds = new Set<string>();
  const slotIds = new Set<string>();
  const waypointIds = new Set<string>();

  // 1. Validate Rooms
  for (const room of config.rooms) {
    if (roomIds.has(room.id)) {
      errors.push(`Duplicate room ID: "${room.id}"`);
    }
    roomIds.add(room.id);

    const { minX, maxX, minZ, maxZ } = room.bounds;
    if (minX >= maxX || minZ >= maxZ) {
      errors.push(`Room "${room.id}" has invalid bounds: [${minX}, ${maxX}, ${minZ}, ${maxZ}]`);
    }
    if (room.ceilingHeight <= 0 || !Number.isFinite(room.ceilingHeight)) {
      errors.push(`Room "${room.id}" has invalid ceiling height: ${room.ceilingHeight}`);
    }
  }

  // 2. Validate Walls
  for (const wall of config.walls) {
    if (wallIds.has(wall.id)) {
      errors.push(`Duplicate wall ID: "${wall.id}"`);
    }
    wallIds.add(wall.id);

    const [sx, sz] = wall.start;
    const [ex, ez] = wall.end;
    if (!Number.isFinite(sx) || !Number.isFinite(sz) || !Number.isFinite(ex) || !Number.isFinite(ez)) {
      errors.push(`Wall "${wall.id}" has non-finite coordinate values.`);
    }
    if (sx === ex && sz === ez) {
      errors.push(`Wall "${wall.id}" has zero length.`);
    }
  }

  // 3. Validate Doorways
  for (const door of config.doorways) {
    if (doorwayIds.has(door.id)) {
      errors.push(`Duplicate doorway ID: "${door.id}"`);
    }
    doorwayIds.add(door.id);

    if (!roomIds.has(door.fromRoomId)) {
      errors.push(`Doorway "${door.id}" references non-existent fromRoomId: "${door.fromRoomId}"`);
    }
    if (!roomIds.has(door.toRoomId)) {
      errors.push(`Doorway "${door.id}" references non-existent toRoomId: "${door.toRoomId}"`);
    }
    if (!wallIds.has(door.wallId)) {
      errors.push(`Doorway "${door.id}" references non-existent wallId: "${door.wallId}"`);
    }
    if (door.width <= 0 || door.height <= 0) {
      errors.push(`Doorway "${door.id}" has non-positive width/height dimensions.`);
    }
  }

  // 4. Validate Artwork Slots
  for (const slot of config.artworkSlots) {
    if (slotIds.has(slot.id)) {
      errors.push(`Duplicate artwork slot ID: "${slot.id}"`);
    }
    slotIds.add(slot.id);

    if (!roomIds.has(slot.roomId)) {
      errors.push(`Artwork slot "${slot.id}" references non-existent roomId: "${slot.roomId}"`);
    }
    if (!wallIds.has(slot.wallId)) {
      errors.push(`Artwork slot "${slot.id}" references non-existent wallId: "${slot.wallId}"`);
    }
    const [px, py, pz] = slot.position;
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      errors.push(`Artwork slot "${slot.id}" has non-finite position.`);
    }
    if (slot.dimensions.maxWidth <= 0 || slot.dimensions.maxHeight <= 0) {
      errors.push(`Artwork slot "${slot.id}" has non-positive max dimensions.`);
    }
  }

  // 5. Validate Spawn Position
  const [sx, , sz] = config.spawn.position;
  let spawnInsideRoom = false;
  for (const room of config.rooms) {
    if (
      sx >= room.bounds.minX &&
      sx <= room.bounds.maxX &&
      sz >= room.bounds.minZ &&
      sz <= room.bounds.maxZ
    ) {
      spawnInsideRoom = true;
      break;
    }
  }
  if (!spawnInsideRoom) {
    errors.push(`Spawn position [${sx}, ${sz}] is not inside any configured room boundaries.`);
  }

  // 6. Validate Waypoints Graph & Reachability
  for (const wp of config.waypoints) {
    if (waypointIds.has(wp.id)) {
      errors.push(`Duplicate waypoint ID: "${wp.id}"`);
    }
    waypointIds.add(wp.id);

    if (!roomIds.has(wp.roomId)) {
      errors.push(`Waypoint "${wp.id}" references non-existent roomId: "${wp.roomId}"`);
    }
  }

  for (const wp of config.waypoints) {
    for (const neighborId of wp.neighborIds) {
      if (!waypointIds.has(neighborId)) {
        errors.push(`Waypoint "${wp.id}" references non-existent neighbor "${neighborId}"`);
      }
    }
  }

  // Graph reachability: ensure every room has at least one reachable waypoint from spawn
  const visited = new Set<string>();
  const queue = ["wp-spawn"];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const node = config.waypoints.find((w) => w.id === currentId);
    if (node) {
      for (const nextId of node.neighborIds) {
        if (!visited.has(nextId)) {
          queue.push(nextId);
        }
      }
    }
  }

  const reachedRooms = new Set<string>();
  for (const visitedId of visited) {
    const node = config.waypoints.find((w) => w.id === visitedId);
    if (node) reachedRooms.add(node.roomId);
  }

  for (const room of config.rooms) {
    if (!reachedRooms.has(room.id)) {
      errors.push(`Room "${room.id}" is unreachable from spawn in waypoint graph.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface MuseumArtwork {
  id: string;
  title?: string;
  artist?: string;
  year?: number;
  medium?: string;
  dimensions?: string;
  url: string;
  position: Vector3D;
  rotation?: Vector3D;
}

export const LEGACY_ARTWORKS: MuseumArtwork[] = [
  {
    id: "luminous-veil",
    title: "Luminous Veil",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/luminous-veil.jpg",
    position: [-24.92, 2.1, -28],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "sovereign-gaze",
    title: "Sovereign Gaze",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sovereign-gaze.jpg",
    position: [-24.92, 2.1, -12],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "monsoon-child",
    title: "Monsoon Child",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/monsoon-child.jpg",
    position: [-24.92, 2.1, 4],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "tears-in-the-rain",
    title: "Tears in the Rain",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/tears-in-the-rain.jpg",
    position: [-24.92, 2.1, 20],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "the-dreamer",
    title: "The Dreamer",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-dreamer.jpg",
    position: [24.92, 2.1, -28],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "behind-the-lens",
    title: "Behind the Lens",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/behind-the-lens.jpg",
    position: [24.92, 2.1, -12],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "radiant-spirit",
    title: "Radiant Spirit",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/radiant-spirit.jpg",
    position: [24.92, 2.1, 4],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "chrome-elegy",
    title: "Chrome Elegy",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/chrome-elegy.jpg",
    position: [24.92, 2.1, 20],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "the-curious-mr-bean",
    title: "The Curious Mr. Bean",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-curious-mr-bean.jpg",
    position: [-10, 2.1, -39.92],
    rotation: [0, 0, 0],
  },
  {
    id: "sorcerer-supreme",
    title: "Sorcerer Supreme",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sorcerer-supreme.jpg",
    position: [10, 2.1, -39.92],
    rotation: [0, 0, 0],
  },
];

export const MUSEUM_ARTWORKS: MuseumArtwork[] = [
  {
    id: "sorcerer-supreme",
    title: "Sorcerer Supreme",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sorcerer-supreme.jpg",
    position: [0, 1.8, -35.85],
    rotation: [0, 0, 0],
  },
  {
    id: "the-curious-mr-bean",
    title: "The Curious Mr. Bean",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-curious-mr-bean.jpg",
    position: [-7.85, 1.6, 24],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "luminous-veil",
    title: "Luminous Veil",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/luminous-veil.jpg",
    position: [-9.85, 1.6, 12],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "sovereign-gaze",
    title: "Sovereign Gaze",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sovereign-gaze.jpg",
    position: [-9.85, 1.6, 0],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "the-dreamer",
    title: "The Dreamer",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-dreamer.jpg",
    position: [9.85, 1.6, 12],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "behind-the-lens",
    title: "Behind the Lens",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/behind-the-lens.jpg",
    position: [9.85, 1.6, 0],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "monsoon-child",
    title: "Monsoon Child",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/monsoon-child.jpg",
    position: [-25.85, 1.6, 3],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "tears-in-the-rain",
    title: "Tears in the Rain",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/tears-in-the-rain.jpg",
    position: [-25.85, 1.6, 9],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "radiant-spirit",
    title: "Radiant Spirit",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/radiant-spirit.jpg",
    position: [25.85, 1.6, 3],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "chrome-elegy",
    title: "Chrome Elegy",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/chrome-elegy.jpg",
    position: [25.85, 1.6, 11],
    rotation: [0, -Math.PI / 2, 0],
  },
];

