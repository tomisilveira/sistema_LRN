import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { AdminSidebar } from "./admin-sidebar";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 min-h-screen">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold">Sin permisos de administrador</h1>
          <p className="text-sm panel-label">
            Tu cuenta ({user.email}) inició sesión pero no está habilitada como admin. Pedile a
            alguien de la mesa de jueces que te agregue en la tabla <code>admins</code>.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      <AdminSidebar userEmail={user.email ?? ""} />
      <main className="flex-1 p-6 panel-enter min-w-0">{children}</main>
    </div>
  );
}
