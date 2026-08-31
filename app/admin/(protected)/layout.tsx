import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { AdminSidebar } from "./admin-sidebar";
import { SectionNavProvider } from "./section-nav-context";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  // getClaims en vez de getUser: cuando el proyecto usa signing keys
  // asimétricas (Auth > JWT Keys) verifica la firma del JWT localmente
  // contra el JWKS cacheado, sin round-trip al servidor de Auth en cada
  // navegación del panel. Si el proyecto todavía usa el secreto HS256
  // compartido, getClaims cae solo a un getUser() (misma latencia que
  // antes) — nunca es más lento. proxy.ts sigue haciendo el getUser() que
  // refresca la cookie de sesión una vez por request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    redirect("/admin/login");
  }

  const userId = claims.sub;
  const userEmail = typeof claims.email === "string" ? claims.email : "";

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!adminRow) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 min-h-screen">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold">Sin permisos de administrador</h1>
          <p className="text-sm panel-label">
            Tu cuenta ({userEmail}) inició sesión pero no está habilitada como admin. Pedile a
            alguien de la mesa de jueces que te agregue en la tabla <code>admins</code>.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  // Lista de eventos para el selector del sidebar (cambiar de evento sin
  // volver a /admin). Liviano: sólo id/nombre/visibilidad/estado.
  const { data: events } = await supabase
    .from("events")
    .select("id, name, is_public, status")
    .order("event_date", { ascending: false });

  return (
    <SectionNavProvider>
      <div className="min-h-screen md:flex">
        <AdminSidebar userEmail={userEmail} events={events ?? []} />
        <main className="flex-1 p-6 panel-enter min-w-0">{children}</main>
      </div>
    </SectionNavProvider>
  );
}
