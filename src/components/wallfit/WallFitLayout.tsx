"use client";
import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { WallFitEngine, WallFitEngineRef } from "./WallFitEngine";

interface WallFitLayoutProps {
  artworkUrl: string;
  onClose: () => void;
}

export function WallFitLayout({ artworkUrl, onClose }: WallFitLayoutProps) {
  const engineRef = useRef<WallFitEngineRef>(null);
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [scale, setScale] = useState(0.5);
  const [skewX, setSkewX] = useState(0);

  // Auto-sync React state adjustments down directly to the Canvas Engine
  useEffect(() => {
    if (step >= 3 && engineRef.current) {
      engineRef.current.setTransform(scale, skewX);
    }
  }, [scale, skewX, step]);

  const handleRoomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Thermal Optimization: Downscale image massively before passing to Fabric loop
    const reader = new FileReader();
    reader.onload = (f) => {
      const data = f.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1920;
        const resizeRatio = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * resizeRatio;
        canvas.height = img.height * resizeRatio;
        
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const optimizedWebp = canvas.toDataURL("image/webp", 0.8);
        
        // Push processed high-perf image buffer to Engine via Facade Pattern
        if (engineRef.current) {
            engineRef.current.loadRoom(optimizedWebp);
            engineRef.current.loadArtwork(artworkUrl);
            setStep(2); // Auto transition to Placement Step
        }
      };
      img.src = data;
    };
    reader.readAsDataURL(file);
  };

  const triggerExport = () => {
    engineRef.current?.exportScene();
    // Non-intrusive automated teardown
    setTimeout(() => onClose(), 1500); 
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col md:flex-row animate-in fade-in duration-500">
      
      {/* 1. LEFT STAGE: The Canvas Hardware */}
      <div className="w-full md:w-[70%] h-[60vh] md:h-full relative">
        <WallFitEngine ref={engineRef} />
        
        {step === 1 && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
             <div className="border border-white/20 border-dashed rounded-lg p-10 md:p-16 text-center bg-background/80 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] max-w-lg w-full transition-colors hover:border-accent/40">
                <h3 className="font-serif text-[28px] text-text mb-3">Initialize Environment</h3>
                <p className="font-sans text-muted text-[14px] mb-10 leading-relaxed">Upload a wide horizontal photograph of your intended physical space to spin up the rendering matrix.</p>
                <div className="relative overflow-hidden cursor-pointer inline-block w-full">
                  <Button className="pointer-events-none w-full tracking-[0.2em] uppercase text-[12px] py-4 bg-white/5 border border-white/10 hover:bg-white/10">Upload Space</Button>
                  <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleRoomUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>
             </div>
          </div>
        )}
      </div>

      {/* 2. RIGHT STAGE: Tactical Dashboard UX */}
      <div className="w-full md:w-[30%] h-[40vh] md:h-full bg-[#080808] flex flex-col p-8 md:p-12 justify-between overflow-y-auto">
        <div>
          <div className="flex justify-between items-center mb-10">
            <h2 className="font-serif text-[32px] text-accent tracking-[-0.02em]">WallFit UI</h2>
            <button onClick={onClose} className="text-muted hover:text-white transition-colors uppercase tracking-[0.2em] text-[10px] font-sans">Close Session</button>
          </div>

          {step === 1 && (
            <p className="font-sans text-muted/70 text-[14px] leading-relaxed mb-12 animate-in fade-in">
              The engine requires spatial context prior to plotting the artwork boundary matrix. Secure an image of your layout to begin.
            </p>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-700">
               <h3 className="font-sans text-text text-[14px] tracking-widest uppercase">Placement Matrix</h3>
               <p className="font-sans text-muted/70 text-[13px] leading-relaxed mb-6">Drag the artwork physically across the canvas plane to assign its visual anchor block.</p>
               <Button onClick={() => setStep(3)} className="w-full bg-white/10 text-white hover:bg-white/20 uppercase tracking-[0.1em] text-[11px] font-sans h-12">Lock Topology</Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-10 animate-in slide-in-from-right-4 duration-700">
              <h3 className="font-sans text-text text-[14px] tracking-widest uppercase">Perspective Injection</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex justify-between">
                   <label className="text-[10px] text-muted uppercase tracking-[0.2em] font-sans">Simulation Depth (X)</label>
                   <span className="text-[10px] text-accent font-sans">{skewX}°</span>
                </div>
                <input type="range" min="-45" max="45" step="1" value={skewX} onChange={(e) => setSkewX(parseInt(e.target.value))} className="w-full accent-accent bg-white/10 h-[2px] appearance-none cursor-pointer" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between">
                   <label className="text-[10px] text-muted uppercase tracking-[0.2em] font-sans">Visual Scale Output</label>
                   <span className="text-[10px] text-accent font-sans">{(scale * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.1" max="2.0" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full accent-accent bg-white/10 h-[2px] appearance-none cursor-pointer" />
              </div>

              <Button onClick={() => setStep(4)} className="w-full bg-white/10 text-white hover:bg-white/20 mt-4 uppercase tracking-[0.1em] text-[11px] font-sans h-12">Finalize Output</Button>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-700">
               <h3 className="font-sans text-text text-[14px] tracking-widest uppercase">Extraction Phase</h3>
               <p className="font-sans text-muted/70 text-[13px] leading-relaxed mb-6">The simulation block is resolved. Produce the final rendering composite.</p>
            </div>
          )}
        </div>

        {/* Dynamic Stepper Progression Mapping */}
        <div className="flex items-center justify-center gap-3 mt-auto pt-10">
           {[1,2,3,4].map((s) => (
             <div key={s} className={`w-2 h-2 rounded-full transition-colors duration-500 ${step === s ? 'bg-accent' : 'bg-white/10'}`} />
           ))}
        </div>

        {step === 4 && (
          <div className="pt-8 animate-in slide-in-from-bottom-4 duration-700 delay-300">
            <Button onClick={triggerExport} className="w-full py-6 uppercase tracking-[0.2em] text-[11px] bg-accent text-black hover:bg-white transition-colors duration-500 font-bold h-14">
              Commence Render
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
