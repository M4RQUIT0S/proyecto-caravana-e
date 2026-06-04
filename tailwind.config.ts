import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta AgroTrace (theme claro). Se conservan los nombres de token existentes
        // para no tocar los componentes; sólo cambian los valores.
        bg: {
          DEFAULT: "#F4F4EF", // surface-alt — fondo de la app
          soft: "#F0F0E8", // surface-muted — inputs, hundidos, chips, hover
          card: "#FAFAF5", // surface — cards/paneles (lo más claro, "papel")
        },
        line: {
          DEFAULT: "#DEE1D8", // border
          strong: "#C8C8C0", // border-strong (botones, divisores marcados)
        },
        ink: {
          DEFAULT: "#164113", // text (verde de marca)
          muted: "#486848", // text-muted (secundario / labels)
          dim: "#8C9A82", // hint / placeholders
        },
        // "accent" = verde primario (estructura: links, íconos, estados activos).
        accent: {
          DEFAULT: "#285820", // primary-500
          soft: "#486848", // primary-400
          deep: "#164113", // primary-700
        },
        // "action" = naranja (sólo CTAs / atención).
        action: {
          DEFAULT: "#FC8B00", // accent-500
          hover: "#E57A00", // accent-600
          soft: "#FFC078", // accent-300
          weak: "#F8D8D0", // accent-100 (disabled)
        },
        success: "#285820",
        warning: "#FC8B00",
        error: "#C0392B",
        info: "#2C5F8A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 4px 14px rgba(8,56,8,0.10)",
        sm: "0 1px 2px rgba(8,56,8,0.06)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.5)",
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
