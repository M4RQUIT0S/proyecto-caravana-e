"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadDB } from "./storage";
import type { DBShape, Usuario } from "./types";

interface AuthCtx {
  db: DBShape;
  user: Usuario | null;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDB] = useState<DBShape>(() => loadDB());

  const refresh = useCallback(() => setDB(loadDB()), []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("caravanas:update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("caravanas:update", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const user = useMemo(
    () => db.usuarios.find((u) => u.id === db.sesion.userId) ?? null,
    [db]
  );

  return <Ctx.Provider value={{ db, user, refresh }}>{children}</Ctx.Provider>;
}

export function useApp(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp debe usarse dentro de AppProvider");
  return c;
}
