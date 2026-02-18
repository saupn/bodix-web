import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2D4A3E",
          dark: "#1E332A",
          light: "#3D5F4F",
        },
        secondary: {
          DEFAULT: "#E8DFD0",
          dark: "#D4C9B8",
          light: "#F5F0E8",
        },
        accent: {
          DEFAULT: "#C4785A",
          dark: "#A85F43",
          light: "#D4927A",
        },
        neutral: {
          50: "#FAFAF8",
          100: "#F5F5F3",
          200: "#E8E8E6",
          300: "#D4D4D2",
          400: "#A3A3A1",
          500: "#737371",
          600: "#525250",
          700: "#3D3D3B",
          800: "#2C2C2A",
          900: "#1A1A18",
        },
        success: "#7CB083",
      },
      fontFamily: {
        heading: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        body: ["var(--font-playfair-display)", "Playfair Display", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
