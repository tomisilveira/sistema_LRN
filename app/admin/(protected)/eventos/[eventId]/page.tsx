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
import { EventDashboard } from "./event-dashboard";
import { EventRealtime } from "./event-realtime";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { canManageEvent, getAdminContext } from "@/lib/admin-auth";
import { EventAdminsPanel } from "./event-admins-panel";
import { InscriptionPanel } from "./inscription-panel";
import {
  DownloadIcon,
  ExternalIcon,
  FlagIcon,
  GlobeIcon,
  LockIcon,
  MonitorIcon,
  PlayCircleIcon,
  TrashIcon,
} from "@/app/components/action-icons";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TabbedLayout, type TabItem } from "@/app/components/tabbed-layout";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { formatLabel, competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { disciplineColor } from "@/lib/discipline-colors";
import { courtDisplayName } from "@/lib/court-display";
import { disciplineDisplayName, disciplineCategoryLabel } from "@/lib/discipline-display";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { eventId } = await params;
  // `?tab=inscripcion` abre directo esa pestaña (lo usa el link "Manejar
  // inscripción" de la página de cada torneo).
  const { tab: requestedTab } = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Una sola tanda (sep 2026): todo depende solo del id del evento. Antes
  // eran 4 viajes en fila (evento → usuario → permiso → resto), ~75 ms c/u.
  const [
    { data: event },
    me,
    allowed,
    { data: courts },
    { data: competitions },
    { data: disciplines },
    { data: categories },
  ] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle<EventRow>(),
    getAdminContext(),
    // Un evento PÚBLICO ajeno se lee igual por RLS, pero no es de este
    // administrador — para él no existe en el panel.
    canManageEvent(supabase, eventId),
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
  if (!event || !me || !allowed) notFound();

  const disciplinesById = new Map((disciplines ?? []).map((d: Discipline) => [d.id, d]));

  const setStatus = setEventStatusAction.bind(null, eventId);
  const setPublic = setEventPublicAction.bind(null, eventId);
  const addCourtAction = addCourt.bind(null, eventId);
  const createCompetitionAction = createCompetition.bind(null, eventId);
  const hasCourts = (courts ?? []).length > 0;
  const openRegistrationCount = (competitions ?? []).filter((c: Competition) => c.registration_open).length;

  const tabs: TabItem[] = [
    {
      id: "resumen",
      label: "Resumen",
      content: (
        <EventDashboard
          supabase={supabase}
          event={event}
          competitions={(competitions ?? []) as CompetitionWithNames[]}
          courts={courts ?? []}
        />
      ),
    },
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
            <div className="grid sm:grid-cols-2 gap-3 panel-enter-stagger">
              {(courts ?? []).map((court: Court) => {
                const discipline = court.discipline_id ? disciplinesById.get(court.discipline_id) : null;
                const colors = disciplineColor(discipline);
                return (
                  <div
                    key={court.id}
                    className={`rounded-lg border-l-4 ${colors.border} ${colors.bg} p-3 flex flex-col gap-2.5`}
                  >
                    {/* Nombre arriba, a todo el ancho (antes compartía la fila
                        con los botones y se partía en 3 renglones); disciplina
                        con su etiqueta; acciones abajo, lo destructivo a la
                        derecha y separado. */}
                    <p className="font-display font-semibold leading-snug">
                      {courtDisplayName(court.name, discipline)}
                    </p>
                    <label className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide panel-label font-semibold">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
                        Disciplina
                      </span>
                      <CourtDisciplineSelect
                        eventId={eventId}
                        courtId={court.id}
                        disciplineId={court.discipline_id}
                        disciplines={disciplines ?? []}
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
                      <CopyLinkButton variant="toolbar" compact path={`/juez/${court.access_token}`} label="Link del juez" />
                      <form action={deleteCourt.bind(null, eventId, court.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`¿Eliminar "${courtDisplayName(court.name, discipline)}"? Los partidos que la tenían asignada quedan sin cancha.`}
                          className="panel-action-danger panel-action-sm"
                        >
                          <TrashIcon />
                          Eliminar
                        </ConfirmSubmitButton>
                      </form>
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
    {
      id: "inscripcion",
      label: "Inscripción",
      badge: openRegistrationCount
        ? `${openRegistrationCount} ${openRegistrationCount === 1 ? "abierto" : "abiertos"}`
        : undefined,
      content: (
        <InscriptionPanel
          supabase={supabase}
          eventId={eventId}
          competitions={(competitions ?? []) as CompetitionWithNames[]}
        />
      ),
    },
    {
      id: "administradores",
      label: "Administradores",
      content: <EventAdminsPanel supabase={supabase} eventId={eventId} me={me} />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Eventos", href: "/admin" }, { label: event.name }]} />
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-display font-bold leading-tight text-balance">{event.name}</h1>
            <p className="text-sm panel-label mt-0.5">{event.event_date}</p>
          </div>

          {/* Barra de acciones: a la izquierda lo que se usa en la jornada
              (compartir links, pantalla, Excel); a la derecha el estado del
              evento como controles segmentados — muestran el valor actual y
              la alternativa, en vez de un chip "Público" suelto más un botón
              "Hacer privado" que dice lo contrario — y al final, separada,
              la acción destructiva. */}
          <div className="panel-card rounded-xl p-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {event.accreditation_token && (
                <CopyLinkButton
                  variant="toolbar"
                  path={`/acreditacion/${event.accreditation_token}`}
                  label="Link de acreditación"
                />
              )}
              {event.is_public && (
                <a
                  href={`/evento/${eventId}/pantalla`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="panel-action"
                  title="Vista para proyector/TV — todas las canchas en vivo, sin navegación (se abre en otra pestaña)"
                >
                  <MonitorIcon />
                  Modo pantalla
                  <ExternalIcon className="w-3.5 h-3.5 opacity-60" />
                </a>
              )}
              <a href={`/api/eventos/${eventId}/export`} className="panel-action">
                <DownloadIcon />
                Exportar a Excel
              </a>
              <form action={deleteEvent.bind(null, eventId)} className="ml-auto">
                <ConfirmSubmitButton
                  confirmMessage={`¿Eliminar el evento "${event.name}"? Se borran TODOS sus torneos, canchas, equipos, grupos y partidos. No se puede deshacer.`}
                  className="panel-action-danger"
                >
                  <TrashIcon />
                  Eliminar
                </ConfirmSubmitButton>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-2 px-1">
              <div className="flex items-center gap-2">
              <span className="text-xs font-medium panel-label">Visibilidad</span>
              <div
                className="panel-segmented"
                role="group"
                aria-label="Visibilidad del evento"
                title="Público: aparece en /publico y en el inicio. Privado: no aparece listado en ningún lado."
              >
                {event.is_public ? (
                  <span className="panel-segment panel-segment-on" aria-current="true">
                    <GlobeIcon className="w-4 h-4 text-brand-green" />
                    Público
                  </span>
                ) : (
                  <form action={setPublic.bind(null, true)} className="h-full">
                    <button type="submit" className="panel-segment">
                      <GlobeIcon />
                      Público
                    </button>
                  </form>
                )}
                {!event.is_public ? (
                  <span className="panel-segment panel-segment-on" aria-current="true">
                    <LockIcon className="w-4 h-4 text-brand-orange" />
                    Privado
                  </span>
                ) : (
                  <form action={setPublic.bind(null, false)} className="h-full">
                    <button type="submit" className="panel-segment">
                      <LockIcon />
                      Privado
                    </button>
                  </form>
                )}
              </div>

              </div>
              <div className="flex items-center gap-2">
              <span className="text-xs font-medium panel-label">Estado</span>
              <div className="panel-segmented" role="group" aria-label="Estado del evento">
                {/* Borrador no se elige desde acá (es el estado de un evento
                    recién creado), pero si lo está se muestra como el valor
                    actual — si no, ningún segmento quedaría marcado. */}
                {event.status === "draft" && (
                  <span className="panel-segment panel-segment-on" aria-current="true">
                    <span className="w-2 h-2 rounded-full bg-neutral-400" aria-hidden="true" />
                    Borrador
                  </span>
                )}
                {event.status === "active" ? (
                  <span className="panel-segment panel-segment-on" aria-current="true">
                    <PlayCircleIcon className="w-4 h-4 text-brand-teal" />
                    Activo
                  </span>
                ) : (
                  <form action={setStatus.bind(null, "active")} className="h-full">
                    <button type="submit" className="panel-segment">
                      <PlayCircleIcon />
                      Activo
                    </button>
                  </form>
                )}
                {event.status === "finished" ? (
                  <span className="panel-segment panel-segment-on" aria-current="true">
                    <FlagIcon className="w-4 h-4 text-neutral-600" />
                    Finalizado
                  </span>
                ) : (
                  <form action={setStatus.bind(null, "finished")} className="h-full">
                    <button type="submit" className="panel-segment">
                      <FlagIcon />
                      Finalizado
                    </button>
                  </form>
                )}
              </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Arranca en el Resumen: estado general del evento de un vistazo, y
          su lista "Avance por torneo" lleva directo a cada torneo (lo que
          antes se buscaba entrando por la pestaña Torneos). */}
      <EventRealtime eventId={eventId} />
      <TabbedLayout items={tabs} defaultTabId={tabs.some((t) => t.id === requestedTab) ? requestedTab : "resumen"} sectionTitle={event.name} sectionEventId={event.id} />
    </div>
  );
}
