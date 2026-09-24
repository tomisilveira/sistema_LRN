import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { AdminSidebar } from "./admin-sidebar";
import { SectionNavProvider } from "./section-nav-context";
import { listManageableEvents } from "@/lib/admin-auth";
import type { EventRow } from "@/lib/database.types";

type SidebarEventRow = Pick<EventRow, "id" | "name" | "is_public" | "status" | "event_date">;

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  // getClaims (dentro de getAdminContext) en vez de getUser: cuando el
  // proyecto usa signing keys asimétricas verifica la firma del JWT
  // localmente, sin round-trip al servidor de Auth en cada navegación.
  // proxy.ts hace lo mismo (getClaims) y además refresca la cookie de sesión.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    redirect("/admin/login");
  }

  const userEmail = typeof claims.email === "string" ? claims.email : "";
  // Usuario + eventos del selector del sidebar en una sola tanda (solo los
  // que administra: un event_admin por RLS también lee los públicos
  // ajenos, ver lib/admin-auth.ts).
  const { admin, events } = await listManageableEvents<SidebarEventRow>(
    supabase,
    "id, name, is_public, status, event_date"
  );

  if (!admin) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 min-h-screen">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold">Sin permisos de administrador</h1>
          <p className="text-sm panel-label">
            Tu cuenta ({userEmail}) inició sesión pero no está habilitada como administrador. Pedile
            al superusuario de la Liga que te dé de alta.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <SectionNavProvider>
      <div className="min-h-screen md:flex">
        <AdminSidebar userEmail={userEmail} events={events} isSuperadmin={admin.isSuperadmin} />
        <main className="flex-1 p-6 panel-enter min-w-0">{children}</main>
      </div>
    </SectionNavProvider>
  );
}
