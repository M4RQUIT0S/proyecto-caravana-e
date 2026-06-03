"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-dim">
        Cargando…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-dim">
        Redirigiendo…
      </div>
    );
  }
  return <>{children}</>;
}
