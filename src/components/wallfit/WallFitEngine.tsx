"use client";
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
// Dynamically require fabric ONLY on the client to avoid SSR 'fabric is not defined' crashes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fabric: any;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fabric = require("fabric").fabric;
}

export interface WallFitEngineRef {
  loadRoom: (dataUrl: string) => void;
  loadArtwork: (url: string) => void;
  setTransform: (scale: number, skewX: number) => void;
  exportScene: () => void;
}

interface EngineProps {
  onReady?: () => void;
}

// Strictly isolated Matrix Rendering Block wrapper
export const WallFitEngine = forwardRef<WallFitEngineRef, EngineProps>(({ onReady }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const artworkRef = useRef<fabric.Image | null>(null);

  // Exposing strictly typed functional controls to the parent React boundary
  useImperativeHandle(ref, () => ({
    loadRoom: (dataUrl: string) => {
      if (!fabricRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(dataUrl, (img: any) => {
        const canvas = fabricRef.current!;
        const scaleFactor = Math.min(canvas.width! / img.width!, canvas.height! / img.height!);
        img.set({ originX: 'center', originY: 'center', left: canvas.width! / 2, top: canvas.height! / 2, scaleX: scaleFactor, scaleY: scaleFactor, selectable: false, evented: false });
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
      });
    },
    loadArtwork: (url: string) => {
      if (!fabricRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(url, (img: any) => {
        const canvas = fabricRef.current!;
        img.set({
          originX: 'center', originY: 'center',
          left: canvas.width! / 2, top: canvas.height! / 2,
          scaleX: 0.3, scaleY: 0.3,
          borderColor: '#D4AF37', cornerColor: '#D4AF37', cornerSize: 12, transparentCorners: false,
          shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 35, offsetX: 15, offsetY: 25 })
        });

        // Anti-void Object Constraints
        img.on('moving', function () {
          if (img.left! < 0) img.set('left', 0);
          if (img.top! < 0) img.set('top', 0);
          if (img.left! > canvas.width!) img.set('left', canvas.width!);
          if (img.top! > canvas.height!) img.set('top', canvas.height!);
        });

        canvas.add(img);
        artworkRef.current = img;
        canvas.setActiveObject(img);
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    },
    setTransform: (scale: number, skewX: number) => {
      const obj = artworkRef.current;
      if (!obj || !fabricRef.current) return;
      obj.set('scaleX', scale);
      obj.set('scaleY', scale);
      obj.set('skewX', skewX);
      fabricRef.current.renderAll(); // Manually flush canvas to prevent DOM-React looping races
    },
    exportScene: () => {
      if (!fabricRef.current) return;
      // Terminate bounding boxes for pure screenshot
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
      // Overclock multiplier for absolute retina rendering quality
      const dataURL = fabricRef.current.toDataURL({ format: 'jpeg', quality: 1, multiplier: 2 });
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'artfolio_simulation.jpg';
      link.click();
    }
  }));

  // Automatic Lifecycle Management
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;
    const w = window.innerWidth > 768 ? window.innerWidth * 0.7 : window.innerWidth;
    const h = window.innerHeight;

    fabricRef.current = new fabric.Canvas(canvasRef.current, { width: w, height: h, backgroundColor: '#0a0a0a', selection: false });

    const handleResize = () => {
      if (!fabricRef.current) return;
      const newW = window.innerWidth > 768 ? window.innerWidth * 0.7 : window.innerWidth;
      const newH = window.innerHeight;
      fabricRef.current.setDimensions({ width: newW, height: newH });
      fabricRef.current.renderAll();
    };

    window.addEventListener('resize', handleResize);

    if (onReady) onReady();

    return () => {
      window.removeEventListener('resize', handleResize);
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [onReady]);

  return (
    <div className="w-full h-full flex items-center justify-center relative border-r border-white/5 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
});

WallFitEngine.displayName = "WallFitEngine";
