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
        // warning del sistema es #FC8B00, pero como texto sobre crema queda de bajo
        // contraste; usamos un ámbar más profundo (legible AA) reservando el naranja
        // brillante (token `action`) para los CTAs.
        warning: "#B45309",
        error: "#C0392B",
        info: "#2C5F8A",

        // --- Paleta "soft UI" del landing (aditiva: ningún componente existente
        // la usa, así que no altera login/registro/app). Verde salvia + azul
        // apagado + lavanda sobre gris cálido.
        // Los tonos medios del mockup se usan SOLO como superficie: texto blanco
        // sobre ellos da ~2:1 y no pasa AA. El texto siempre va en `ink`.
        sage: {
          DEFAULT: "#8FA98D",
          soft: "#C6D3C2",
          pale: "#DEE6DB",
          deep: "#4F6B4D", // blanco encima = 5.7:1 → AA. Es el CTA primario.
        },
        steel: {
          DEFAULT: "#7C949E",
          soft: "#BED0D6",
          pale: "#DCE5E8",
          deep: "#43606B",
        },
        lavender: {
          DEFAULT: "#C9C2EC",
          soft: "#DEDAF5",
          pale: "#EDEBFA",
          deep: "#584C9B",
        },
        mist: {
          DEFAULT: "#E4E2DC", // fondo cálido del mockup
          deep: "#D6D3CB",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 14px rgba(8,56,8,0.10)",
        sm: "0 1px 2px rgba(8,56,8,0.06)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.5)",
        // Extrusión del mockup: sombra difusa abajo + filo de luz arriba.
        lift: "0 18px 40px -22px rgba(38,55,38,0.38), 0 3px 8px -3px rgba(38,55,38,0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
        "lift-lg": "0 34px 64px -30px rgba(38,55,38,0.45), 0 6px 14px -6px rgba(38,55,38,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
        press: "inset 0 2px 6px rgba(38,55,38,0.16), inset 0 -1px 0 rgba(255,255,255,0.55)",
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
