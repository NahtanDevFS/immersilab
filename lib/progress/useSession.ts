"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getServerSnapshot, getSnapshot, subscribe } from "./store";

export interface SessionState {
  user: User | null;
  /** true hasta saber si hay sesión (evita mostrar "Ingresar" un instante). */
  loading: boolean;
}

/** Usuario con sesión iniciada en Supabase, en vivo. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

/** Progreso del dueño activo (invitado o cuenta), en vivo. */
export function useProgress() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Nombre para mostrar de una cuenta. */
export function displayName(user: User): string {
  const name = (user.user_metadata as { full_name?: string } | undefined)?.full_name;
  return name?.trim() || user.email?.split("@")[0] || "Mi cuenta";
}
