import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { buildCourtBoards, type CourtBoardMatch } from "@/lib/build-court-boards";
import { buildPantallaFallback } from "@/lib/build-pantalla-fallback";
import { disciplineColor, type DisciplineColorSet } from "@/lib/discipline-colors";
import { PublicRealtime } from "@/app/components/public-realtime";
import { ScreenBoards } from "./screen-boards";
import { ScreenFallback } from "./screen-fallback";

interface UpcomingDisciplineGroup {
  key: string;
  name: string;
  colors: DisciplineColorSet;
  matches: CourtBoardMatch[];
}

/** Agrupa "próximos partidos" por disciplina (no por cancha) para que la
 * pantalla las distinga de un vistazo — mismo color por disciplina que ya
 * se usa en canchas/torneos (ver disciplineColor), ordenado por
 * disciplines.sort_order. */
function groupUpcomingByDiscipline(upcoming: CourtBoardMatch[]): UpcomingDisciplineGroup[] {
  const groups = new Map<string, UpcomingDisciplineGroup>();
  for (const m of upcoming) {
    const discipline = m.competition.disciplines;
    const key = discipline?.name ?? "?";
    let group = groups.get(key);
    if (!group) {
      group = { key, name: key, colors: disciplineColor(discipline), matches: [] };
      groups.set(key, group);
    }
    group.matches.push(m);
  }
  return [...groups.values()].sort(
    (a, b) => (a.matches[0]?.competition.disciplines?.sort_order ?? 0) - (b.matches[0]?.competition.disciplines?.sort_order ?? 0)
  );
}

export const revalidate = 0;

// Mismo criterio de columnas públicas que /publico (ver comentario
// equivalente en app/page.tsx): `anon` solo tiene grant de columnas
// puntuales sobre `events`.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

/** "Modo pantalla": vista standalone para proyector/TV en el evento — sin
 * header ni navegación, solo la cancha. Deliberadamente NO reusa
 * PublicShell (esa navegación es para alguien mirando desde el celular, acá
 * nadie va a tocar nada). Mismo criterio de acceso que /publico/[eventId]:
 * 404 si el evento no es público.
 *
 * Dos estados, sin ningún paso manual — `PublicRealtime` dispara
 * `router.refresh()` en cualquier cambio de `matches` y el paso de uno a
 * otro ocurre solo:
 * - Hay algún partido en vivo en el evento → se muestra ÚNICAMENTE eso
 *   (ScreenBoards, filtrado a las canchas con partido en curso), con los
 *   próximos partidos de esa cancha debajo.
 * - Nadie está jugando ahora mismo → una tarjeta por torneo con su fase
 *   actual (tabla de posiciones o cuadro, ver ScreenFallback) y, si hay
 *   algo programado, los próximos partidos del evento abajo. */
export default async function PantallaPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event || !event.is_public) notFound();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("*, disciplines(name, sort_order), categories(name)")
    .eq("event_id", eventId)
    .order("created_at");
  const competitionList = (competitions ?? []) as CompetitionWithNames[];

  const boards = await buildCourtBoards(supabase, eventId, competitionList);
  const liveBoards = boards.filter((b) => b.live !== null);
  const hasLive = liveBoards.length > 0;
  const upcoming = hasLive ? [] : boards.flatMap((b) => b.upcoming);

  const fallbackBoards = hasLive ? [] : await buildPantallaFallback(supabase, eventId, competitionList);
  const upcomingGroups = groupUpcomingByDiscipline(upcoming);

  return (
    <div className="panel-page min-h-screen">
      <PublicRealtime />
      <div className="p-4 sm:p-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3 border-b-2 border-neutral-200 dark:border-neutral-800 panel-enter">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex gap-1 panel-brand-dots shrink-0" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-teal" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-orange" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-pink" />
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">{event.name}</h1>
          </div>
          <p className="text-sm font-display font-semibold panel-label shrink-0">{event.event_date}</p>
        </header>

        {hasLive ? <ScreenBoards boards={liveBoards} /> : <ScreenFallback boards={fallbackBoards} />}

        {upcomingGroups.length > 0 && (
          <section className="panel-card rounded-xl overflow-hidden panel-enter">
            <p className="text-xs uppercase tracking-wide text-white bg-brand-teal-dark font-display font-bold px-4 py-2">
              Próximos partidos
            </p>
            <div className="p-3 space-y-4">
              {upcomingGroups.map((group) => (
                <div key={group.key}>
                  <div className={`flex items-center gap-2 mb-2 pl-2.5 border-l-4 ${group.colors.border}`}>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${group.colors.dot}`} aria-hidden="true" />
                    <h3 className={`text-xl sm:text-2xl font-display font-extrabold tracking-tight truncate ${group.colors.text}`}>
                      {group.name}
                    </h3>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.matches.map((m) => (
                      <div
                        key={m.match.id}
                        className={`panel-surface rounded-lg pl-3 pr-3 py-2 border-l-4 ${group.colors.border} ${group.colors.bg}`}
                      >
                        <p className="text-sm truncate">
                          <span className="font-semibold">{m.teamAName}</span>{" "}
                          <span className="panel-label">vs</span>{" "}
                          <span className="font-semibold">{m.teamBName}</span>
                        </p>
                        <p className="panel-label text-xs mt-0.5 truncate">{m.competition.categories?.name ?? "?"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
