import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminRow, EventAdmin } from "@/lib/database.types";
import type { AdminContext } from "@/lib/admin-auth";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { UsersIcon } from "@/app/components/action-icons";
import { shareEvent, unshareEvent } from "./actions";

/** Pestaña "Administradores" del evento: quién lo administra y compartirlo
 * con otro admin que ya exista (las cuentas nuevas las crea solo el
 * superusuario, en /admin/usuarios). Los superusuarios no se listan para
 * compartir: ya ven todos los eventos. */
export async function EventAdminsPanel({
  supabase,
  eventId,
  me,
}: {
  supabase: SupabaseClient;
  eventId: string;
  me: AdminContext;
}) {
  const [{ data: linksData }, { data: adminsData }] = await Promise.all([
    supabase.from("event_admins").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("admins").select("user_id, full_name, email, role").order("full_name"),
  ]);
  const links = (linksData ?? []) as EventAdmin[];
  const admins = (adminsData ?? []) as Pick<AdminRow, "user_id" | "full_name" | "email" | "role">[];
  const adminById = new Map(admins.map((a) => [a.user_id, a]));
  const linkedIds = new Set(links.map((l) => l.user_id));
  const candidates = admins.filter((a) => a.role === "event_admin" && !linkedIds.has(a.user_id));
  const displayName = (a: { full_name: string | null; email: string | null } | undefined) =>
    a?.full_name || a?.email || "Usuario";

  return (
    <section className="panel-card rounded-xl p-4 space-y-4">
      <div>
        <h2 className="font-medium">Administradores del evento</h2>
        <p className="text-xs panel-label mt-0.5">
          Pueden editar todo lo de este evento: torneos, equipos, canchas y resultados. El superusuario
          lo ve siempre, aunque no figure acá.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-sm panel-label">Nadie tiene asignado este evento todavía (solo lo ve el superusuario).</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {links.map((l) => {
            const a = adminById.get(l.user_id);
            const isMe = l.user_id === me.userId;
            return (
              <li key={l.user_id} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-full grid place-items-center bg-brand-teal/10 text-brand-teal shrink-0">
                  <UsersIcon className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {displayName(a)}
                    {isMe && <span className="panel-label font-normal"> (vos)</span>}
                  </span>
                  {a?.email && a.full_name && a.full_name !== a.email && (
                    <span className="block text-xs panel-label truncate">{a.email}</span>
                  )}
                </span>
                {a?.role === "superadmin" && (
                  <span className="text-[11px] rounded-full px-2 py-0.5 font-semibold panel-chip-final">Superusuario</span>
                )}
                <form action={unshareEvent.bind(null, eventId, l.user_id)}>
                  <ConfirmSubmitButton
                    confirmMessage={
                      isMe && !me.isSuperadmin
                        ? "¿Dejar de administrar este evento? Vas a perder el acceso y solo te lo puede volver a dar otro administrador del evento o el superusuario."
                        : `¿Dejar de compartir el evento con ${displayName(a)}?`
                    }
                    className="panel-action-danger panel-action-sm"
                  >
                    Quitar
                  </ConfirmSubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg panel-surface p-3 space-y-2">
        <p className="text-sm font-medium">Compartir con otro administrador</p>
        {candidates.length === 0 ? (
          <p className="text-xs panel-label">
            No hay otros administradores para sumar.{" "}
            {me.isSuperadmin
              ? "Podés crear uno nuevo en Usuarios."
              : "Pedile al superusuario que dé de alta a la persona."}
          </p>
        ) : (
          <form action={shareEvent.bind(null, eventId)} className="flex flex-wrap gap-2">
            <select name="user_id" required defaultValue="" className="flex-1 min-w-[200px] h-9 rounded-md panel-input px-2 text-sm">
              <option value="" disabled>
                Elegí un administrador
              </option>
              {candidates.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.full_name ? `${a.full_name} (${a.email ?? "sin email"})` : (a.email ?? "Usuario")}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md panel-button-primary font-medium px-4 h-9 text-sm">
              Compartir
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
