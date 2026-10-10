"use client";

import React from "react";
import { MUSEUM_CONFIG } from "../config/museum.config";
import { MuseumFloor } from "./MuseumFloor";
import { MuseumWall } from "./MuseumWall";
import { DoorwayPortal } from "./DoorwayPortal";
import { MuseumCeiling } from "./MuseumCeiling";

export function MuseumShell() {
  return (
    <group name="museum-shell">
      {/* 1. Continuous Multi-Room PBR Floors */}
      <MuseumFloor
        rooms={MUSEUM_CONFIG.rooms}
        doorways={MUSEUM_CONFIG.doorways}
      />

      {/* 2. Solid Deduplicated Architectural Walls & Dark Stone Skirting */}
      <MuseumWall />

      {/* 3. Classical Architrave & Grand Cased Doorway Portals */}
      <DoorwayPortal />

      {/* 4. Room Ceilings & Main Hall Recessed Coffer Skylight */}
      <MuseumCeiling />

      {/* ========================================================= */}
      {/* 5. ARCHITECTURAL LIGHTING SYSTEM (Premium Museum Ambiance) */}
      {/* ========================================================= */}
      <group name="museum-lighting">
        {/* Soft Global Fill */}
        <ambientLight intensity={0.45} color="#fffcf5" />

        {/* Skylight Atrium Natural Downlight in Main Hall */}
        <directionalLight
          position={[0, 15, 6]}
          intensity={1.1}
          color="#fff8ed"
          castShadow={false}
        />

        {/* Room 1: Grand Entrance Portico Lighting */}
        <pointLight
          position={[0, 3.8, 24]}
          intensity={80}
          distance={16}
          decay={2}
          color="#ffedd4"
        />

        {/* Room 2: Main Exhibition Rotunda Ambient Accent */}
        <pointLight
          position={[0, 4.4, 6]}
          intensity={120}
          distance={22}
          decay={2}
          color="#fff6e8"
        />

        {/* Room 3: West Gallery (Moody Intimate Salon) */}
        <pointLight
          position={[-18, 3.8, 6]}
          intensity={70}
          distance={18}
          decay={2}
          color="#ffe8cc"
        />

        {/* Room 4: East Wing (Muted Teal Portraiture Salon) */}
        <pointLight
          position={[18, 3.8, 10.5]}
          intensity={75}
          distance={20}
          decay={2}
          color="#f4faff"
        />

        {/* Room 5: Central Connecting Vestibule */}
        <pointLight
          position={[0, 3.8, -11]}
          intensity={65}
          distance={16}
          decay={2}
          color="#ffebd4"
        />

        {/* Room 6: Featured Masterpiece Sanctuary — Apex Key Spotlight */}
        <spotLight
          position={[0, 4.8, -24]}
          target-position={[0, 1.8, -35.85]}
          intensity={280}
          angle={Math.PI / 5}
          penumbra={0.7}
          distance={24}
          decay={2}
          color="#fffaf0"
        />
        <pointLight
          position={[0, 4.2, -26]}
          intensity={90}
          distance={20}
          decay={2}
          color="#ffe8cc"
        />
      </group>
    </group>
  );
}
