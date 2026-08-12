import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

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
    <div className="min-h-screen flex flex-col">
      <header className="panel-nav border-b px-6 py-3 flex items-center justify-between">
        <Link href="/admin" className="font-semibold">
          Liga Robótica Neuquina — Admin
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/admin" className="text-sm panel-label hover:opacity-80">
            Eventos
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
