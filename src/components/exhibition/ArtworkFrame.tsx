"use client";

import React, { useMemo, Suspense } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { calculateFrameDimensions, FrameDimensions } from "@/features/artwork/utils/exhibition-validation";

export interface ArtworkFrameProps {
  id?: string;
  title?: string;
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

function ArtworkFrameFallback({
  frameWidth = 1.48,
  frameHeight = 1.88,
  matWidth = 1.40,
  matHeight = 1.80,
  artWidth = 1.20,
  artHeight = 1.60,
}: Partial<FrameDimensions>) {
  return (
    <>
      {/* Outer Wooden Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[frameWidth, frameHeight, 0.05]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>

      {/* Inner White Matting */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[matWidth, matHeight]} />
        <meshStandardMaterial color="#f5f5f3" roughness={0.95} />
      </mesh>

      {/* Canvas Placeholder */}
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[artWidth, artHeight]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
    </>
  );
}

function ArtworkFrameContent({
  url,
  maxAnisotropy,
}: {
  url: string;
  maxAnisotropy: number;
}) {
  const texture = useTexture(url, (loaded) => {
    if (loaded instanceof THREE.Texture) {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.anisotropy = maxAnisotropy;
      loaded.generateMipmaps = true;
      loaded.needsUpdate = true;
    }
  });

  const dims = useMemo(() => {
    const img = texture?.image as { width?: number; height?: number } | undefined;
    return calculateFrameDimensions(img?.width, img?.height, 1.6, 0.10, 0.04);
  }, [texture]);

  return (
    <>
      {/* Outer Wooden Frame (Sized accurately to image aspect ratio) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[dims.frameWidth, dims.frameHeight, 0.05]} />
        <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Inner White Matting */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[dims.matWidth, dims.matHeight]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.95} />
      </mesh>

      {/* Canvas Artwork with Original Aspect Ratio */}
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[dims.artWidth, dims.artHeight]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
    </>
  );
}

export function ArtworkFrame({
  url,
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: ArtworkFrameProps) {
  const { gl } = useThree();
  const maxAnisotropy = useMemo(
    () => Math.min(gl.capabilities.getMaxAnisotropy(), 16),
    [gl]
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={<ArtworkFrameFallback />}>
        <ArtworkFrameContent url={url} maxAnisotropy={maxAnisotropy} />
      </Suspense>
    </group>
  );
}
