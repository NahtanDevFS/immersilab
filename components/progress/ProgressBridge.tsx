"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { onSignedIn, onSignedOut, pushPending } from "@/lib/progress/sync";

/**
 * Conecta la sesión de Supabase con el progreso guardado en el dispositivo.
 * No dibuja nada; vive en el layout raíz para escuchar en todas las páginas.
 *
 * - Al haber sesión (al iniciar sesión o al recargar con una ya abierta), lo
 *   logrado como invitado pasa a la cuenta y se sincroniza.
 * - Al cerrar sesión, lo de esa cuenta deja de mostrarse en el dispositivo.
 * - Al volver la conexión, se sube lo que había quedado pendiente.
 */
export function ProgressBridge() {
  useEffect(() => {
    const supabase = createClient();
    let currentUser: string | null = null;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      if (userId && userId !== currentUser) {
        currentUser = userId;
        // Fuera del callback: el SDK no recomienda llamar a Supabase dentro
        // de onAuthStateChange (puede bloquearse esperando el mismo lock).
        window.setTimeout(() => void onSignedIn(userId), 0);
      } else if (!userId && event === "SIGNED_OUT") {
        onSignedOut(currentUser);
        currentUser = null;
      }
    });

    const retry = () => void pushPending();
    window.addEventListener("online", retry);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", retry);
    };
  }, []);

  return null;
}
