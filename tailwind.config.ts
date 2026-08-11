import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Paleta "grafito + azul señal". Se conservan los nombres de token para que
      // las 33 pantallas que ya los consumen se actualicen sin tocar su markup;
      // sólo cambian los valores.
      colors: {
        bg: {
          DEFAULT: "#F6F7F9", // fondo de la app
          soft: "#EFF1F4", // inputs, filas alternas, hover
          card: "#FFFFFF", // superficie de paneles y tarjetas
        },
        line: {
          DEFAULT: "#E1E4E8", // borde de 1px: reemplaza a la sombra como separador
          strong: "#CBD1D8",
        },
        ink: {
          DEFAULT: "#12161B", // 15.9:1 sobre blanco
          muted: "#59636E", // 6.1:1 sobre blanco, 5.4:1 sobre bg-soft
          dim: "#79838E", // 3.9:1 — sólo placeholders y notas al pie
        },
        // Azul señal. Es a la vez el color estructural y el del CTA: la paleta no
        // tiene un segundo acento, que era justamente lo que la volvía ruidosa.
        accent: {
          DEFAULT: "#1B3A5C", // blanco encima = 11.6:1
          soft: "#2C5A8A",
          deep: "#12283F",
        },
        action: {
          DEFAULT: "#1B3A5C",
          hover: "#12283F",
          soft: "#E8EEF5", // fondo tenue para estados seleccionados
          weak: "#EDEFF2", // botón deshabilitado
        },
        // Semánticos: los usan 25 archivos para estado, no para decorar.
        // Todos verificados AA sobre blanco y sobre bg-soft.
        success: "#1E7A4B",
        warning: "#8A5A00",
        error: "#B3261E",
        info: "#1B3A5C",
      },
      fontFamily: {
        sans: ["Inter Variable", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        // La jerarquía la da el borde de 1px, no la sombra. Estas quedan al ras
        // y sólo se usan en elementos que flotan de verdad (menús, modales).
        sm: "0 1px 2px rgba(18,22,27,0.05)",
        soft: "0 1px 3px rgba(18,22,27,0.07), 0 1px 2px rgba(18,22,27,0.04)",
        pop: "0 8px 24px -8px rgba(18,22,27,0.18), 0 2px 6px -2px rgba(18,22,27,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
