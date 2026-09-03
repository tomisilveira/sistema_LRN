import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Court, Discipline, Category, EventRow } from "@/lib/database.types";
import {
  addCourt,
  createCompetition,
  setEventStatusAction,
  setEventPublicAction,
  deleteCourt,
  deleteEvent,
} from "./actions";
import { deleteCompetition } from "@/app/admin/(protected)/competencias/[competitionId]/actions";
import { CourtDisciplineSelect } from "./court-discipline-select";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TabbedLayout, type TabItem } from "@/app/components/tabbed-layout";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { formatLabel, competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { disciplineColor } from "@/lib/discipline-colors";
import { courtDisplayName } from "@/lib/court-display";
import { disciplineDisplayName, disciplineCategoryLabel } from "@/lib/discipline-display";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [{ data: courts }, { data: competitions }, { data: disciplines }, { data: categories }] =
    await Promise.all([
      // `access_token` sí hace falta acá: esta pestaña muestra el link del
      // juez de cada cancha (CopyLinkButton). Es la única página que lo expone.
      supabase
        .from("courts")
        .select("id, name, access_token, discipline_id, sort_order, event_id")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabase
        .from("competitions")
        .select("*, disciplines(name, sort_order), categories(name)")
        .eq("event_id", eventId)
        .order("created_at"),
      supabase.from("disciplines").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

  const disciplinesById = new Map((disciplines ?? []).map((d: Discipline) => [d.id, d]));

  const setStatus = setEventStatusAction.bind(null, eventId);
  const setPublic = setEventPublicAction.bind(null, eventId);
  const addCourtAction = addCourt.bind(null, eventId);
  const createCompetitionAction = createCompetition.bind(null, eventId);
  const hasCourts = (courts ?? []).length > 0;
  const hasOpenRegistration = (competitions ?? []).some((c: Competition) => c.registration_open);

  const tabs: TabItem[] = [
    {
      id: "canchas",
      label: "Canchas",
      badge: (courts ?? []).length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Canchas</h2>
              <p className="text-xs panel-label mt-0.5">
                Se comparten entre torneos de una misma disciplina — cada una lleva un color según
                para qué disciplina está armada.
              </p>
            </div>
            {hasCourts && (
              <ModalFormButton
                buttonLabel="+ Agregar cancha"
                buttonClassName="rounded-md panel-button-primary font-medium px-4 py-2 text-sm shrink-0 whitespace-nowrap"
                title="Agregar cancha"
                action={addCourtAction}
              >
                <div>
                  <label className="block text-sm panel-label mb-1">Nombre</label>
                  <input
                    name="name"
                    required
                    placeholder="Cancha extra"
                    className="w-full rounded-md panel-input px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm panel-label mb-1">Disciplina</label>
                  <select name="discipline_id" defaultValue="" className="w-full rounded-md panel-input px-3 py-2 text-sm">
                    <option value="">Sin disciplina asignada</option>
                    {(disciplines ?? []).map((d: Discipline) => (
                      <option key={d.id} value={d.id}>
                        {disciplineDisplayName(d.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </ModalFormButton>
            )}
          </div>
          {hasCourts ? (
            <div className="grid sm:grid-cols-2 gap-2 panel-enter-stagger">
              {(courts ?? []).map((court: Court) => {
                const discipline = court.discipline_id ? disciplinesById.get(court.discipline_id) : null;
                const colors = disciplineColor(discipline);
                return (
                  <div
                    key={court.id}
                    className={`rounded-md border-l-4 transition-colors hover:brightness-95 ${colors.border} ${colors.bg} px-3 py-2 space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{courtDisplayName(court.name, discipline)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopyLinkButton path={`/juez/${court.access_token}`} label="Link de juez" compact />
                        <form action={deleteCourt.bind(null, eventId, court.id)}>
                          <ConfirmSubmitButton
                            confirmMessage={`¿Eliminar "${courtDisplayName(court.name, discipline)}"? Los partidos que la tenían asignada quedan sin cancha.`}
                            className="text-xs rounded-md px-2 py-1 panel-button-danger"
                          >
                            Eliminar
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
                      <CourtDisciplineSelect
                        eventId={eventId}
                        courtId={court.id}
                        disciplineId={court.discipline_id}
                        disciplines={disciplines ?? []}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm panel-label">
              Se comparten entre torneos de la misma disciplina del evento. Todavía no hay ninguna
              cargada — te las vamos a pedir al crear el primer torneo, en la pestaña Torneos.
            </p>
          )}
        </section>
      ),
    },
    {
      id: "torneos",
      label: "Torneos",
      badge: (competitions ?? []).length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium">Torneos (disciplina × categoría)</h2>
            <ModalFormButton
              buttonLabel="+ Nuevo torneo"
              buttonClassName="rounded-md panel-button-primary font-medium px-4 py-2 text-sm shrink-0 whitespace-nowrap"
              title="Nuevo torneo"
              description="Una disciplina × categoría dentro de este evento (ej. Fútbol Robótico — Infantil)."
              action={createCompetitionAction}
              submitLabel="Crear torneo"
            >
              {!hasCourts && (
                <div className="rounded-md border border-brand-orange/40 bg-brand-orange/10 p-3 space-y-2">
                  <label className="block text-sm font-medium">¿Cuántas canchas hay hoy?</label>
                  <p className="text-xs panel-label">
                    Se comparten entre torneos de la misma disciplina — se cargan acá, al crear
                    este primer torneo, con la disciplina que elijas abajo. Después podés sumar
                    más o recolorear cada una desde la pestaña Canchas.
                  </p>
                  <input
                    name="court_count"
                    type="number"
                    min={1}
                    max={20}
                    required
                    placeholder="Ej: 3"
                    className="w-24 rounded-md panel-input px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm panel-label mb-1">Disciplina</label>
                  <select
                    name="discipline_id"
                    required
                    className="w-full rounded-md panel-input px-3 py-2 text-sm"
                  >
                    {(disciplines ?? []).map((d: Discipline) => (
                      <option key={d.id} value={d.id}>
                        {disciplineDisplayName(d.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm panel-label mb-1">Categoría</label>
                  <select
                    name="category_id"
                    required
                    className="w-full rounded-md panel-input px-3 py-2 text-sm"
                  >
                    {(categories ?? []).map((c: Category) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm panel-label mb-1">Formato</label>
                <select
                  name="format_type"
                  defaultValue="single_elimination"
                  className="w-full rounded-md panel-input px-3 py-2 text-sm"
                >
                  <option value="groups_only">Solo fase de grupos (sin eliminatoria)</option>
                  <option value="single_elimination">Grupos + eliminatoria simple</option>
                  <option value="gold_silver">Grupos + oro/plata</option>
                  <option value="bracket_only">Solo cuadro de eliminación (sin grupos)</option>
                </select>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs panel-label mb-1">Pts. victoria</label>
                  <input
                    name="points_win"
                    type="number"
                    defaultValue={3}
                    className="w-full rounded-md panel-input px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs panel-label mb-1">Pts. empate</label>
                  <input
                    name="points_draw"
                    type="number"
                    defaultValue={1}
                    className="w-full rounded-md panel-input px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs panel-label mb-1">Pts. derrota</label>
                  <input
                    name="points_loss"
                    type="number"
                    defaultValue={0}
                    className="w-full rounded-md panel-input px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs panel-label mb-1">Clasif./grupo</label>
                  <input
                    name="qualifiers_per_group"
                    type="number"
                    defaultValue={2}
                    className="w-full rounded-md panel-input px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="allow_draws" type="checkbox" defaultChecked className="rounded" />
                Esta disciplina admite empates (desmarcar para sumo)
              </label>
            </ModalFormButton>
          </div>
          <div className="space-y-2 panel-enter-stagger">
            {(competitions ?? []).length === 0 && (
              <p className="text-sm panel-label">Todavía no hay torneos creados.</p>
            )}
            {(competitions ?? []).map(
              (
                c: Competition & {
                  disciplines: { name: string; sort_order: number } | null;
                  categories: { name: string } | null;
                }
              ) => {
                const colors = disciplineColor(c.disciplines);
                return (
                  // Una sola tarjeta redondeada (antes el link y el botón
                  // Eliminar eran dos cajas pegadas de distinta altura, con
                  // el botón estirado a h-full — se veía como un recorte
                  // aparte en vez de una acción más de la misma fila).
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-lg border-l-4 ${colors.border} ${colors.bg} pr-2 shadow-sm transition duration-200 hover:shadow-lg hover:-translate-y-0.5`}
                  >
                    <Link
                      href={`/admin/competencias/${c.id}`}
                      className="flex-1 min-w-0 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg hover:brightness-95 active:scale-[0.99] transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {disciplineCategoryLabel(c.disciplines, c.categories)}
                        </p>
                        <p className="text-xs panel-label">{formatLabel[c.format_type]}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[c.status]}`}
                        >
                          {competitionStatusLabel[c.status]}
                        </span>
                        <span
                          className="panel-label text-lg leading-none transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </div>
                    </Link>
                    <form action={deleteCompetition.bind(null, c.id)} className="shrink-0">
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar el torneo "${disciplineCategoryLabel(c.disciplines, c.categories)}"? Se borran sus equipos, grupos y partidos. No se puede deshacer.`}
                        className="text-xs rounded-full px-3 py-1.5 panel-button-danger whitespace-nowrap"
                      >
                        Eliminar
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                );
              }
            )}
          </div>
        </section>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Eventos", href: "/admin" }, { label: event.name }]} />
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{event.name}</h1>
              <span
                className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                  event.is_public ? "panel-chip-success" : "panel-chip-warning"
                }`}
                title={
                  event.is_public
                    ? "Visible en /publico y en el inicio."
                    : "Oculto: no aparece en /publico ni en el inicio, aunque tenga link directo alguien no lo ve listado."
                }
              >
                {event.is_public ? "🌐 Público" : "🔒 Privado"}
              </span>
            </div>
            <p className="text-sm panel-label">{event.event_date}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Acciones de uso frecuente, no destructivas — mismo estilo
                (pill con borde teal) para que se lean como un solo grupo en
                vez de tres formas distintas (antes "Copiar link" tenía su
                propio look de outline y el resto eran chips grises lisos). */}
            {event.accreditation_token && (
              <CopyLinkButton
                path={`/acreditacion/${event.accreditation_token}`}
                label="Copiar link de acreditación"
              />
            )}
            {hasOpenRegistration && (
              <CopyLinkButton path={`/inscripcion/${eventId}`} label="Copiar link de inscripción" />
            )}
            {event.is_public && (
              <a
                href={`/evento/${eventId}/pantalla`}
                target="_blank"
                rel="noopener noreferrer"
                className="panel-button-secondary text-xs rounded-full px-3 py-1.5 whitespace-nowrap"
                title="Vista para proyector/TV — todas las canchas en vivo, sin navegación"
              >
                🖥️ Abrir modo pantalla
              </a>
            )}
            <a
              href={`/api/eventos/${eventId}/export`}
              className="panel-button-secondary text-xs rounded-full px-3 py-1.5 whitespace-nowrap"
            >
              📊 Exportar a Excel
            </a>

            {/* Cambios de estado del evento — chip neutro a propósito, para
                que no compitan visualmente con las acciones de arriba. */}
            <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-700 mx-0.5" aria-hidden="true" />
            <form action={setPublic.bind(null, !event.is_public)}>
              <button
                type="submit"
                className="panel-chip text-xs rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
                title="Mostrar/ocultar este evento en /publico y en el inicio"
              >
                {event.is_public ? "🔒 Hacer privado" : "🌐 Hacer público"}
              </button>
            </form>
            <form action={setStatus.bind(null, event.status === "active" ? "finished" : "active")}>
              <button
                type="submit"
                className="panel-chip text-xs rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                {event.status === "active" ? "Marcar finalizado" : "Marcar activo"}
              </button>
            </form>

            {/* Destructiva: separada del resto y con fondo rojo suave ya en
                reposo (no solo al pasar el mouse) para que se note que es
                zona de peligro antes de tocarla. */}
            <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-700 mx-0.5" aria-hidden="true" />
            <form action={deleteEvent.bind(null, eventId)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar el evento "${event.name}"? Se borran TODOS sus torneos, canchas, equipos, grupos y partidos. No se puede deshacer.`}
                className="text-xs rounded-full panel-button-danger px-3 py-1.5 whitespace-nowrap"
              >
                🗑️ Eliminar evento
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      </div>

      {/* Arranca en Torneos (no en Canchas): es adonde se vuelve casi siempre
          después de entrar a un torneo puntual, para elegir otra
          disciplina/categoría del mismo evento. */}
      <TabbedLayout items={tabs} defaultTabId="torneos" sectionTitle={event.name} sectionEventId={event.id} />
    </div>
  );
}
