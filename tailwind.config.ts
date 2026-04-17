import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        "surface-low": "var(--bg-low)",
        "surface-lowest": "var(--bg-lowest)",
        "surface-highest": "var(--bg-highest)",
        primary: "var(--accent)",
        "primary-container": "var(--accent-container)",
        text: "var(--text)",
        muted: "var(--muted)",
        outline: "var(--outline)",
        "outline-variant": "var(--outline-variant)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
      },
      borderRadius: {
        DEFAULT: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "0px",
      },
      boxShadow: {
        'ambient': '0 24px 48px rgba(0, 0, 0, 0.5)',
      },
      transitionTimingFunction: {
        'editorial': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'luxury': '1200ms',
        'luxury-fast': '800ms',
      },
    },
  },
  plugins: [],
};
export default config;
