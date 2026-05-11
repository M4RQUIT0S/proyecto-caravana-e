import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d0c",
          soft: "#11140f",
          card: "#171b16",
        },
        line: "#252b22",
        ink: {
          DEFAULT: "#e9efe2",
          muted: "#9aa490",
          dim: "#6b7464",
        },
        accent: {
          DEFAULT: "#a8c97f",
          soft: "#cfe1b0",
          deep: "#6b8a48",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.35)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
