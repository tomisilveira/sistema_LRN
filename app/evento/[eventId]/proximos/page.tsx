import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { buildCourtBoards } from "@/lib/build-court-boards";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineDisplayName } from "@/lib/discipline-display";
import { PublicRealtime } from "@/app/components/public-realtime";
import { BrandIcon } from "@/app/components/brand-mark";
import { MatchStageChip } from "@/app/components/match-stage-chip";

export const revalidate = 0;

// Mismo criterio de columnas públicas que /evento/[eventId]/pantalla.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

// Cuántos partidos por cancha: el siguiente (destacado) + los que vienen.
const UPCOMING_PER_COURT = 6;

/** "Próximos partidos": pantalla para TV/proyector que responde solo "¿qué
 * se juega ahora y qué viene, en qué cancha?" — una columna por cancha, de
 * todas las disciplinas a la vez, con el color de cada disciplina. Sin
 * posiciones ni cuadros (eso queda en Modo pantalla). Mismo acceso que
 * /pantalla: 404 si el evento no es público; se refresca sola con cada
 * cambio de partido (PublicRealtime). */
export default async function ProximosPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: event }, { data: competitions }] = await Promise.all([
    supabase.from("events").select(EVENT_PUBLIC_COLUMNS).eq("id", eventId).maybeSingle<EventRow>(),
    supabase
      .from("competitions")
      .select("*, disciplines(name, sort_order), categories(name)")
      .eq("event_id", eventId)
      .order("created_at"),
  ]);
  if (!event || !event.is_public) notFound();
  const competitionList = (competitions ?? []) as CompetitionWithNames[];

  const boards = await buildCourtBoards(supabase, eventId, competitionList, { upcomingLimit: UPCOMING_PER_COURT });

  // Leyenda: una entrada por disciplina que tiene algo en alguna cancha.
  const legend = new Map<string, { name: string; dot: string; sortOrder: number }>();
  for (const board of boards) {
    for (const m of [board.live, ...board.upcoming]) {
      const d = m?.competition.disciplines;
      if (d && !legend.has(d.name)) {
        legend.set(d.name, { name: disciplineDisplayName(d.name), dot: disciplineColor(d).dot, sortOrder: d.sort_order });
      }
    }
  }
  const legendItems = [...legend.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const cols =
    boards.length >= 4 ? "lg:grid-cols-4" : boards.length === 3 ? "lg:grid-cols-3" : boards.length === 2 ? "lg:grid-cols-2" : "";

  return (
    <div className="panel-page min-h-screen">
      <PublicRealtime />
      <div className="p-4 sm:p-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3 border-b-2 border-neutral-200 dark:border-neutral-800 panel-enter">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandIcon className="h-9 w-9" priority />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">Próximos partidos</h1>
              <p className="text-sm panel-label truncate">{event.name}</p>
            </div>
          </div>
          {legendItems.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {legendItems.map((d) => (
                <li key={d.name} className="flex items-center gap-1.5 text-sm font-display font-semibold">
                  <span className={`w-3 h-3 rounded-full ${d.dot}`} aria-hidden="true" />
                  {d.name}
                </li>
              ))}
            </ul>
          )}
        </header>

        {boards.length === 0 ? (
          <p className="panel-card rounded-2xl p-10 text-center text-xl panel-label">
            No hay partidos programados por ahora.
          </p>
        ) : (
          <div className={`grid gap-4 sm:grid-cols-2 ${cols} panel-enter-stagger`}>
            {boards.map((board) => {
              const [next, ...later] = board.upcoming;
              return (
                <section key={board.courtId} className="panel-card rounded-2xl overflow-hidden flex flex-col">
                  <h2 className={`${board.colorDot} text-white px-4 py-2.5 text-xl font-display font-bold truncate`}>
                    {board.courtName}
                  </h2>

                  {board.live && (
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-red-500/30 bg-red-500/5 min-w-0">
                      <span className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase text-red-600 dark:text-red-400 shrink-0">
                        <span className="panel-live-dot" aria-hidden="true" />
                        Jugando
                      </span>
                      <span className="text-sm truncate">
                        {board.live.teamAName} <span className="panel-label">vs</span> {board.live.teamBName}
                      </span>
                    </div>
                  )}

                  {next ? (
                    <div className={`px-4 py-4 space-y-2 ${board.colorBg}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs uppercase tracking-wide font-display font-bold ${board.colorText}`}>
                          {board.live ? "Sigue" : "Próximo"}
                          {next.match.turno !== null ? ` · Turno ${next.match.turno}` : ""}
                        </span>
                        <MatchStageChip stage={next.stage} size="xs" className="shrink-0" />
                      </div>
                      <p className="text-2xl font-display font-bold leading-tight">
                        {next.teamAName}
                        <span className="block text-base panel-label font-normal">vs</span>
                        {next.teamBName}
                      </p>
                      <p className="text-sm panel-label">{next.disciplineCategory}</p>
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-center panel-label">No hay más partidos en esta cancha.</p>
                  )}

                  {later.length > 0 && (
                    <ol className="border-t border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800/60">
                      {later.map((m, i) => (
                        <li key={m.match.id} className="px-4 py-2 flex items-start gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full panel-surface text-xs font-display font-bold flex items-center justify-center shrink-0">
                            {i + 2}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold truncate">
                              {m.teamAName} <span className="panel-label font-normal">vs</span> {m.teamBName}
                            </p>
                            <p className="text-xs panel-label truncate">
                              {m.competition.categories?.name ?? "?"} · {m.stage.label}
                              {m.match.turno !== null ? ` · Turno ${m.match.turno}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
