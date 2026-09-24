import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-auth";
import type { AdminRole, AdminRow, EventAdmin, EventRow } from "@/lib/database.types";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { TrashIcon, UsersIcon } from "@/app/components/action-icons";
import { createAdminUser, removeAdminUser, setAdminPassword, updateAdminUser } from "./actions";

type EventOption = Pick<EventRow, "id" | "name" | "event_date">;

const roleLabel: Record<AdminRole, string> = {
  superadmin: "Superusuario",
  event_admin: "Administrador de eventos",
};

/** Usuarios del panel — solo el superusuario. Alta con contraseña inicial
 * (se la pasás vos a la persona), rol, qué eventos administra, cambio de
 * contraseña y baja. */
export default async function UsuariosPage() {
  const me = await getAdminContext();
  if (!me?.isSuperadmin) notFound();

  const supabase = await createServerSupabaseClient();
  const [{ data: adminsData }, { data: linksData }, { data: eventsData }] = await Promise.all([
    supabase.from("admins").select("*").order("created_at"),
    supabase.from("event_admins").select("*"),
    supabase.from("events").select("id, name, event_date").order("event_date", { ascending: false }),
  ]);
  const admins = (adminsData ?? []) as AdminRow[];
  const links = (linksData ?? []) as EventAdmin[];
  const events = (eventsData ?? []) as EventOption[];
  const eventName = new Map(events.map((e) => [e.id, e.name]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Usuarios</h1>
          <p className="text-sm panel-label">
            Quién puede entrar al panel. El superusuario ve todo; un administrador de eventos ve solo
            los eventos que tiene asignados o que creó él.
          </p>
        </div>
        <ModalFormButton
          buttonLabel="+ Nuevo usuario"
          buttonClassName="rounded-md panel-button-primary font-medium px-4 py-2 text-sm shrink-0 whitespace-nowrap"
          title="Nuevo usuario"
          description="Se crea con la contraseña que pongas acá: pasásela a la persona por otro medio (WhatsApp, en mano). Si la olvida, se la cambiás desde esta misma pantalla."
          action={createAdminUser}
          submitLabel="Crear usuario"
        >
          <UserFields events={events} />
          <div>
            <label className="block text-sm panel-label mb-1" htmlFor="new-password">
              Contraseña inicial
            </label>
            <input
              id="new-password"
              name="password"
              type="text"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-md panel-input px-3 py-2 text-sm font-mono"
            />
          </div>
        </ModalFormButton>
      </div>

      <ul className="space-y-3">
        {admins.map((a) => {
          const isMe = a.user_id === me.userId;
          const myLinks = links.filter((l) => l.user_id === a.user_id);
          return (
            <li key={a.user_id} className="panel-card rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full grid place-items-center bg-brand-teal/10 text-brand-teal shrink-0">
                  <UsersIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {a.full_name || a.email || "Sin nombre"}
                    {isMe && <span className="panel-label font-normal text-sm"> (vos)</span>}
                  </p>
                  {a.email && a.full_name && a.full_name !== a.email && (
                    <p className="text-sm panel-label truncate">{a.email}</p>
                  )}
                </div>
                <span
                  className={`text-xs rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap ${
                    a.role === "superadmin" ? "panel-chip-final" : "panel-chip-brand"
                  }`}
                >
                  {roleLabel[a.role] ?? a.role}
                </span>
              </div>

              <div className="text-sm">
                {a.role === "superadmin" ? (
                  <p className="panel-label">Ve y administra todos los eventos.</p>
                ) : myLinks.length === 0 ? (
                  <p className="text-brand-orange">Todavía no administra ningún evento.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {myLinks.map((l) => (
                      <span key={l.event_id} className="panel-chip text-xs rounded-full px-2 py-0.5">
                        {eventName.get(l.event_id) ?? "Evento borrado"}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                <ModalFormButton
                  buttonLabel="Editar"
                  buttonClassName="panel-action panel-action-sm"
                  title={`Editar ${a.full_name || a.email || "usuario"}`}
                  action={updateAdminUser.bind(null, a.user_id)}
                >
                  <UserFields
                    events={events}
                    lockRole={isMe}
                    defaults={{
                      fullName: a.full_name ?? "",
                      email: a.email ?? "",
                      role: a.role,
                      eventIds: myLinks.map((l) => l.event_id),
                    }}
                  />
                </ModalFormButton>
                <ModalFormButton
                  buttonLabel="Cambiar contraseña"
                  buttonClassName="panel-action panel-action-sm"
                  title="Cambiar contraseña"
                  description={`Nueva contraseña para ${a.email ?? "este usuario"}. La anterior deja de funcionar.`}
                  action={setAdminPassword.bind(null, a.user_id)}
                >
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    aria-label="Nueva contraseña"
                    className="w-full rounded-md panel-input px-3 py-2 text-sm font-mono"
                  />
                </ModalFormButton>
                {!isMe && (
                  <form action={removeAdminUser.bind(null, a.user_id)} className="ml-auto">
                    <ConfirmSubmitButton
                      confirmMessage={`¿Quitarle el acceso al panel a ${a.email ?? "este usuario"}? Deja de ver todos sus eventos (los eventos NO se borran).`}
                      className="panel-action-danger panel-action-sm"
                    >
                      <TrashIcon />
                      Quitar acceso
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Campos compartidos entre "Nuevo usuario" y "Editar": nombre, email (solo
 * en el alta), rol y eventos que administra. */
function UserFields({
  events,
  defaults,
  lockRole = false,
}: {
  events: EventOption[];
  defaults?: { fullName: string; email: string; role: AdminRole; eventIds: string[] };
  lockRole?: boolean;
}) {
  const isNew = !defaults;
  return (
    <>
      <div>
        <label className="block text-sm panel-label mb-1">Nombre</label>
        <input
          name="full_name"
          defaultValue={defaults?.fullName}
          placeholder="Nombre y apellido"
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      {isNew && (
        <div>
          <label className="block text-sm panel-label mb-1">Email (con el que va a entrar)</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="nombre@ejemplo.com"
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
        </div>
      )}
      <fieldset className="space-y-1.5">
        <legend className="block text-sm panel-label mb-1">Rol</legend>
        {(["event_admin", "superadmin"] as AdminRole[]).map((r) => (
          <label key={r} className={`flex items-start gap-2 text-sm ${lockRole ? "opacity-60" : "cursor-pointer"}`}>
            <input
              type="radio"
              name="role"
              value={r}
              defaultChecked={(defaults?.role ?? "event_admin") === r}
              disabled={lockRole}
              className="mt-1 accent-brand-teal"
            />
            <span>
              <span className="font-medium">{roleLabel[r]}</span>
              <span className="block text-xs panel-label">
                {r === "superadmin"
                  ? "Ve todo, crea usuarios y maneja disciplinas y categorías."
                  : "Solo los eventos que le asignes o que cree él. Puede compartirlos con otros administradores."}
              </span>
            </span>
          </label>
        ))}
        {lockRole && <p className="text-xs panel-label">Tu propio rol no se puede cambiar desde acá.</p>}
      </fieldset>
      <fieldset>
        <legend className="block text-sm panel-label mb-1">Eventos que administra</legend>
        {events.length === 0 ? (
          <p className="text-xs panel-label">Todavía no hay eventos.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-md panel-surface p-2 space-y-1">
            {events.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1.5 py-1 hover:bg-white">
                <input
                  type="checkbox"
                  name="event_ids"
                  value={e.id}
                  defaultChecked={defaults?.eventIds.includes(e.id)}
                  className="accent-brand-teal"
                />
                <span className="flex-1 min-w-0 truncate">{e.name}</span>
                <span className="text-xs panel-label tabular-nums">{e.event_date}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs panel-label mt-1">Para un superusuario no hace falta: ve todos igual.</p>
      </fieldset>
    </>
  );
}
