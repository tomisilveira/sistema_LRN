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
      <header className="panel-nav border-b">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex gap-0.5" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              <span className="w-2 h-2 rounded-full bg-brand-pink" />
              <span className="w-2 h-2 rounded-full bg-brand-green" />
            </span>
            <span>
              <span className="block font-semibold leading-tight">Liga Robótica Neuquina</span>
              <span className="block text-[11px] panel-label leading-tight">Panel de administración</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin"
              className="panel-chip text-sm rounded-full px-3 py-1.5 hover:bg-brand-teal/15 hover:text-brand-teal transition-colors"
            >
              Eventos
            </Link>
            <ThemeToggle />
            <span className="text-sm panel-label hidden sm:inline">{user.email}</span>
            <SignOutButton />
          </nav>
        </div>
        <div className="h-0.5 w-full bg-gradient-to-r from-brand-teal via-brand-orange to-brand-pink" />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
