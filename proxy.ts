import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresca la sesión de Supabase Auth en cada request al panel admin, para
// que las cookies no expiren mientras el admin tiene la pestaña abierta
// todo el día del evento.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims en vez de getUser (sep 2026): el proyecto firma los JWT con
  // clave asimétrica (ES256, ver /auth/v1/.well-known/jwks.json), así que
  // la firma se valida en local contra el JWKS cacheado — antes esto era
  // un viaje a Supabase Auth (~100 ms) en CADA request del panel, incluidos
  // los de cada botón (Server Action). Si la sesión venció, igual la
  // refresca y reescribe las cookies (setAll de arriba), como getUser.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
