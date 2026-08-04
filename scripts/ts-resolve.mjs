// Node ESM exige la extensión en los imports relativos; el código de la app usa el estilo
// de bundler (`./storage`, `@/lib/types`). Este hook completa la extensión al resolver, y
// con eso cualquier módulo de src/ se puede importar desde un test sin build ni empaquetador
// (Node 24 ya ejecuta TypeScript borrando los tipos).
//
//   node --import ./scripts/ts-resolve.mjs scripts/mi-test.mjs

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolverRuta } from "node:path";

const RAIZ = resolverRuta(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATOS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function primeroQueExista(base) {
  for (const ext of CANDIDATOS) if (existsSync(base + ext)) return base + ext;
  return null;
}

registerHooks({
  resolve(especificador, contexto, siguiente) {
    // Alias "@/..." → src/... (el mismo de tsconfig.json).
    const relativo = especificador.startsWith("@/")
      ? resolverRuta(RAIZ, "src", especificador.slice(2))
      : especificador.startsWith(".") && contexto.parentURL
      ? resolverRuta(dirname(fileURLToPath(contexto.parentURL)), especificador)
      : null;

    if (relativo && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      const archivo = primeroQueExista(relativo);
      if (archivo) return { url: pathToFileURL(archivo).href, shortCircuit: true };
    }
    return siguiente(especificador, contexto);
  },
});
