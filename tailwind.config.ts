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
        salon: {
          cream: "#F4FBF6",
          blush: "#E8F5E9",
          rose: "#A5D6A7",
          mauve: "#81A684",
          text: "#2E4A32",
          accent: "#66BB6A",
        },
        soft: {
          cream: "#F4FBF6",
          blush: "#E8F5E9",
          rose: "#A5D6A7",
          accent: "#81C784",
          dark: "#4CAF50",
        },
      },
      fontFamily: {
        arabic: ["var(--font-tajawal)", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
