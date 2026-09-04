"use client";

// Cliente de Supabase para Client Components: usa la anon key, respeta RLS.
// Válido tanto para la vista pública (sin sesión) como para el panel admin
// (con sesión de Supabase Auth, adjuntada vía cookies por @supabase/ssr).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Falla clara en vez del error genérico de @supabase/ssr — típico
    // síntoma de un deploy nuevo sin las variables de entorno cargadas.
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno."
    );
  }
  return createBrowserClient(url, anonKey);
}
