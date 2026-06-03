"use client";

// Indicador de conectividad (RNF-01 / RNF-08 / RU02). El modo offline es un estado de
// primera clase: el sistema debe funcionar sin señal y mostrarlo siempre.

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
