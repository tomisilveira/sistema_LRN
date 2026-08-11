"use client";

// Cliente de Supabase para Client Components: usa la anon key, respeta RLS.
// Válido tanto para la vista pública (sin sesión) como para el panel admin
// (con sesión de Supabase Auth, adjuntada vía cookies por @supabase/ssr).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
