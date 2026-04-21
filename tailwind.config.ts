import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        card: "#121218",
        accent: "#9ae6b4",
        mist: "#c7d2fe",
        ink: "#f8fafc",
        muted: "#a1a1aa",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.04), 0 12px 48px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        radial:
          "radial-gradient(circle at top, rgba(154,230,180,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(199,210,254,0.12), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
