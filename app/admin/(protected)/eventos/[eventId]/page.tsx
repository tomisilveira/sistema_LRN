import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Court, Discipline, Category, EventRow } from "@/lib/database.types";
import { addCourt, createCompetition, setCourtDiscipline, setEventStatusAction } from "./actions";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TabbedLayout, type TabItem } from "@/app/components/tabbed-layout";
import { ModalFormButton } from "@/app/components/modal-form";
import { formatLabel, competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { disciplineColor } from "@/lib/discipline-colors";

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
      supabase.from("courts").select("*").eq("event_id", eventId).order("sort_order"),
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
  const addCourtAction = addCourt.bind(null, eventId);
  const createCompetitionAction = createCompetition.bind(null, eventId);
  const hasCourts = (courts ?? []).length > 0;

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
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </ModalFormButton>
            )}
          </div>
          {hasCourts ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {(courts ?? []).map((court: Court) => {
                const discipline = court.discipline_id ? disciplinesById.get(court.discipline_id) : null;
                const colors = disciplineColor(discipline);
                const setDisciplineAction = setCourtDiscipline.bind(null, eventId, court.id);
                return (
                  <div
                    key={court.id}
                    className={`rounded-md border-l-4 ${colors.border} ${colors.bg} px-3 py-2 space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{court.name}</span>
                      <CopyLinkButton path={`/juez/${court.access_token}`} label="Link de juez" />
                    </div>
                    <form action={setDisciplineAction} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
                      <select
                        name="discipline_id"
                        defaultValue={court.discipline_id ?? ""}
                        className="flex-1 rounded panel-input px-1.5 py-1 text-xs"
                      >
                        <option value="">Sin disciplina asignada</option>
                        {(disciplines ?? []).map((d: Discipline) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs panel-label hover:opacity-80 shrink-0">
                        Guardar
                      </button>
                    </form>
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
                        {d.name}
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
          <div className="space-y-2">
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
                  <Link
                    key={c.id}
                    href={`/admin/competencias/${c.id}`}
                    className={`flex items-center justify-between rounded-md border-l-4 ${colors.border} ${colors.bg} px-3 py-2 transition hover:brightness-95 dark:hover:brightness-125`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.disciplines?.name} — {c.categories?.name}
                      </p>
                      <p className="text-xs panel-label">{formatLabel[c.format_type]}</p>
                    </div>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[c.status]}`}
                    >
                      {competitionStatusLabel[c.status]}
                    </span>
                  </Link>
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
            <h1 className="text-lg font-semibold">{event.name}</h1>
            <p className="text-sm panel-label">{event.event_date}</p>
          </div>
          <div className="flex items-center gap-2">
            {event.accreditation_token && (
              <CopyLinkButton
                path={`/acreditacion/${event.accreditation_token}`}
                label="Copiar link de acreditación"
              />
            )}
            <a
              href={`/api/eventos/${eventId}/export`}
              className="panel-chip text-xs rounded-full px-3 py-1.5 transition-colors"
            >
              📊 Exportar a Excel
            </a>
            <form action={setStatus.bind(null, event.status === "active" ? "finished" : "active")}>
              <button type="submit" className="panel-chip text-xs rounded-full px-3 py-1.5 transition-colors">
                {event.status === "active" ? "Marcar finalizado" : "Marcar activo"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <TabbedLayout items={tabs} />
    </div>
  );
}
