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
import { supabase, supabaseConfigurado } from "./supabase/client";
import { activarSync, hydrate, syncOcupado } from "./supabase/sync";
import type { DBShape, Usuario } from "./types";

interface AuthCtx {
  db: DBShape;
  user: Usuario | null;
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDB] = useState<DBShape>(() => loadDB());
  const [loading, setLoading] = useState<boolean>(supabaseConfigurado());

  const refresh = useCallback(() => setDB(loadDB()), []);

  // Actualizaciones optimistas locales (cada saveDB dispara 'caravanas:update').
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const handler = () => refresh();
    window.addEventListener("caravanas:update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("caravanas:update", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  // Sesión + datos desde Supabase (RLS). Sin configurar, la app sigue en localStorage.
  useEffect(() => {
    activarSync();
    if (!supabaseConfigurado()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const sb = supabase();
    let montado = true;

    // Hidratación inicial garantizada: en cada montaje (incluida una recarga de página de
    // una ruta protegida) bajamos los datos y soltamos el estado de carga. Tomamos la sesión
    // con getSession() ACÁ (fuera del callback de auth, donde sería seguro).
    (async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();
        await hydrate(session);
      } catch (e) {
        console.error("[supabase] hydrate inicial:", e);
      }
      if (montado) {
        refresh();
        setLoading(false);
      }
    })();

    // Cambios posteriores de sesión. El callback NO debe llamar métodos de sb.auth
    // (deadlock del navigator lock): usamos la `session` que recibe como parámetro.
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      hydrate(session)
        .catch((e) => console.error("[supabase] hydrate onAuthStateChange:", e))
        .finally(() => {
          if (montado) {
            refresh();
            setLoading(false);
          }
        });
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  // Re-hidratación en segundo plano: cuando otro usuario entra al campo (acepta una
  // invitación o se une con código) el cambio ocurre en Supabase, así que este navegador
  // no lo ve hasta volver a bajar los datos. Refrescamos al volver el foco a la ventana,
  // al hacerse visible la pestaña y con un intervalo de respaldo, para que la lista de
  // miembros (y el resto de los datos) aparezca sola sin recargar la página. Se omite
  // mientras haya cambios locales en vuelo, para no pisar un update optimista.
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let montado = true;
    let corriendo = false;

    const sincronizar = async () => {
      if (!montado || corriendo || syncOcupado()) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      corriendo = true;
      try {
        await hydrate();
        if (montado) refresh();
      } catch (e) {
        console.error("[supabase] re-hidratación en segundo plano:", e);
      } finally {
        corriendo = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sincronizar();
    };

    window.addEventListener("focus", sincronizar);
    document.addEventListener("visibilitychange", onVisible);
    const intervalo = window.setInterval(sincronizar, 15_000);

    return () => {
      montado = false;
      window.removeEventListener("focus", sincronizar);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(intervalo);
    };
  }, [refresh]);

  const user = useMemo(
    () => db.usuarios.find((u) => u.id === db.sesion.userId) ?? null,
    [db]
  );

  return (
    <Ctx.Provider value={{ db, user, loading, refresh }}>{children}</Ctx.Provider>
  );
}

export function useApp(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp debe usarse dentro de AppProvider");
  return c;
}
