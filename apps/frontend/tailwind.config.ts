import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // NASA brand colors (optional accents)
        "nasa-blue": "#0B3D91",
        "nasa-red": "#FC3D21",
        // Semantic colors
        primary: {
          DEFAULT: "#2563EB", // blue-600
          hover: "#1D4ED8", // blue-700
        },
        secondary: "#4B5563", // gray-600
        success: "#16A34A", // green-600
        warning: "#F59E0B", // amber-500
        error: "#DC2626", // red-600
        info: "#3B82F6", // blue-500
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 150ms ease-out",
        "slide-up": "slideUp 200ms ease-out",
        "slide-down": "slideDown 200ms ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
