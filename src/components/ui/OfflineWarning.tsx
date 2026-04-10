"use client";
import React, { useState, useEffect } from "react";

export function OfflineWarning() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        // Initialize state
        setIsOffline(!navigator.onLine);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Minimal non-blocking fixed toast notification
    return (
        <div 
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-700 ease-in-out ${
                isOffline ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
            }`}
             aria-live="polite"
        >
            <div className="bg-red-950/90 border border-red-500/50 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_10px_40px_rgba(220,38,38,0.2)]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-sans text-[12px] uppercase tracking-widest text-red-50 font-medium">
                    Connection Lost
                </span>
            </div>
        </div>
    );
}
