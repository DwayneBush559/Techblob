import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e50914",
          dark: "#b00710",
        },
        surface: {
          DEFAULT: "#0d0d0f",
          raised: "#17171a",
          border: "#2a2a2e",
        },
      },
      aspectRatio: {
        video: "16 / 9",
      },
    },
  },
  plugins: [],
};

export default config;
