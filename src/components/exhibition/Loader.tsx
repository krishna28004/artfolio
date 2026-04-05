// Pure HTML/CSS loader - NO R3F hooks to avoid setState-in-render conflict.
// This is used as a Suspense fallback overlay.
export function Loader() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#0a0a0a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.5rem",
                zIndex: 100,
            }}
        >
            <span
                style={{
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "1.5rem",
                    color: "#f2ca50",
                    letterSpacing: "0.05em",
                    animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                }}
            >
                Curating Exhibition
            </span>
            <div
                style={{
                    width: 200,
                    height: 1,
                    background: "rgba(255,255,255,0.08)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: "-100%",
                        width: "100%",
                        height: "100%",
                        background: "#f2ca50",
                        animation: "shimmer 1.8s ease-in-out infinite",
                    }}
                />
            </div>
            <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{left:-100%} 100%{left:100%} }
      `}</style>
        </div>
    );
}
