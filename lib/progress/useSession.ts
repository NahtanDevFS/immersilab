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

export interface RoleState {
  /** "student", "teacher" o "admin"; null sin sesión o si no se pudo leer. */
  role: string | null;
  loading: boolean;
}

/**
 * Rol de la cuenta, leído de `profiles`. Solo sirve para decidir qué mostrar:
 * quien protege los datos es RLS en la base (`is_staff()`), no esta pantalla.
 */
export function useRole(user: User | null): RoleState {
  const userId = user?.id ?? null;
  const [fetched, setFetched] = useState<{ userId: string; role: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    createClient()
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setFetched({ userId, role: (data?.role as string | undefined) ?? null });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!userId) return { role: null, loading: false };
  if (fetched?.userId !== userId) return { role: null, loading: true };
  return { role: fetched.role, loading: false };
}

export function isStaff(role: string | null): boolean {
  return role === "teacher" || role === "admin";
}
