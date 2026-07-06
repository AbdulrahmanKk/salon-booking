import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sm: {
          bg: "#FFFFFF",
          text: "#1A1A1A",
          muted: "#6B6B6B",
          border: "#E8E8E8",
          accent: "#8B7355",
        },
        salon: {
          cream: "#FFFFFF",
          blush: "#F5F5F5",
          rose: "#E8E8E8",
          mauve: "#6B6B6B",
          text: "#1A1A1A",
          accent: "#8B7355",
        },
        soft: {
          cream: "#FFFFFF",
          blush: "#F5F5F5",
          rose: "#E8E8E8",
          accent: "#8B7355",
          dark: "#6B5A45",
        },
      },
      fontFamily: {
        arabic: ["var(--font-tajawal)", "Tahoma", "sans-serif"],
      },
      maxWidth: {
        page: "720px",
        wide: "960px",
      },
    },
  },
  plugins: [],
};

export default config;
