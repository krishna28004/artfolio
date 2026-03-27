import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        card: "var(--card)",
        accent: "var(--accent)",
        text: "var(--text)",
        muted: "var(--muted)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      container: {
        center: true,
        padding: "var(--container-padding)",
        screens: {
          "2xl": "var(--container-max-width)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
