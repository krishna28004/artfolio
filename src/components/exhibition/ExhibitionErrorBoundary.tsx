"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ExhibitionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EXHIBITION_3D_ERROR] Uncaught WebGL/R3F boundary exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-screen bg-[#080808] flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="max-w-md p-10 border border-white/10 bg-white/[0.02] backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-sans block mb-3">
              Spatial Matrix Notice
            </span>
            <h2 className="font-serif text-2xl md:text-3xl text-text font-normal mb-4">
              3D Exhibition Unavailable
            </h2>
            <p className="font-sans text-xs text-muted leading-relaxed mb-8">
              Your device or network was unable to initialize the spatial WebGL matrix. You can explore the complete collection through our accessible linear exhibition archive.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/exhibition/accessible"
                className="px-6 py-3 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-widest hover:brightness-110 transition-all"
              >
                Open Accessible Archive &rarr;
              </Link>
              <Link
                href="/"
                className="px-6 py-3 border border-white/20 text-text font-sans uppercase text-[11px] tracking-widest hover:border-white transition-colors"
              >
                Return to Gallery
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
