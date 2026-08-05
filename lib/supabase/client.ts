import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para Client Components ("use client").
// Requiere las variables de entorno NEXT_PUBLIC_SUPABASE_URL y
// NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
