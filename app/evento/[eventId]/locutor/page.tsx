import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow, Match, Team, TimeTrialRun } from "@/lib/database.types";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { buildCourtBoards } from "@/lib/build-court-boards";
import { computeEventStats, type StatsTeam } from "@/lib/event-stats";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineCategoryLabel, disciplineDisplayName } from "@/lib/discipline-display";
import { matchStage } from "@/lib/match-stage";
import { forfeitLabel } from "@/lib/forfeit-rules";
import { buildTimeTrialRanking, formatRunTime } from "@/lib/time-trial";
import { nationalLeagueTotals, normalizeNationalLeague } from "@/lib/national-league";
import { PublicRealtime } from "@/app/components/public-realtime";
import { BrandIcon } from "@/app/components/brand-mark";
import { MatchClock } from "@/app/components/match-clock";
import { MatchStageChip } from "@/app/components/match-stage-chip";

export const revalidate = 0;

// Mismo criterio de columnas públicas que /evento/[eventId]/pantalla.
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, is_public, created_at";

const RECENT_RESULTS = 8;

type LocutorTeam = StatsTeam & { name: string };

/** Pantalla del locutor: lo que necesita para animar el evento sin andar
 * preguntando — números generales (robots, participantes, instituciones,
 * partidos jugados, goles), qué se juega ahora en cada cancha y qué sigue,
 * los últimos resultados y los campeones. Mismo acceso que /pantalla (404
 * si el evento no es público) y se refresca sola con cada partido.
 *
 * Los equipos se leen con la service-role key: `anon` no puede ver
 * cantidad de integrantes, acreditación ni localidad (ver
 * 0011_teams_anon_column_grants.sql). Acá solo se muestran conteos y
 * nombres de equipo, que ya son públicos. */
export default async function LocutorPage({ params }: { params: Promise<{ eventId: string }> }) {
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
  const competitionIds = competitionList.map((c) => c.id);
  const competitionById = new Map(competitionList.map((c) => [c.id, c]));

  const [boards, { data: teams }, { data: matches }, { data: runs }, { data: nationalLeagueRow }] = await Promise.all([
    buildCourtBoards(supabase, eventId, competitionList, { upcomingLimit: 1 }),
    competitionIds.length
      ? createAdminClient()
          .from("teams")
          .select(
            "id, name, competition_id, institution, province, locality, member_count, member_names, robot_names, participants_present, accredited, withdrawn_at"
          )
          .in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as LocutorTeam[] }),
    competitionIds.length
      ? supabase.from("matches").select("*").in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as Match[] }),
    competitionIds.length
      ? supabase.from("time_trial_runs").select("*").in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as TimeTrialRun[] }),
    // Liga Nacional: carga manual desde el admin (0021). Con la service-role
    // porque `anon` no tiene grant de esa columna; si la migración todavía
    // no está aplicada, la consulta falla y la sección simplemente no sale.
    createAdminClient().from("events").select("national_league").eq("id", eventId).maybeSingle<{ national_league: unknown }>(),
  ]);
  const nationalLeague = normalizeNationalLeague(nationalLeagueRow?.national_league);
  const nationalTotals = nationalLeague ? nationalLeagueTotals(nationalLeague) : null;
  const teamList = (teams ?? []) as LocutorTeam[];
  const matchList = (matches ?? []) as Match[];
  const runList = (runs ?? []) as TimeTrialRun[];
  const stats = computeEventStats({
    competitions: competitionList,
    teams: teamList,
    matches: matchList,
    runs: runList,
  });

  const teamName = (id: string | null) => teamList.find((t) => t.id === id)?.name ?? "?";
  const liveBoards = boards.filter((b) => b.live);

  const recent = matchList
    .filter((m) => m.status === "completed" && m.team_a_id && m.team_b_id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, RECENT_RESULTS);

  // Campeones: finales ya jugadas (cuadro de oro y de plata por separado).
  const champions = matchList
    .filter((m) => m.status === "completed" && m.round === "F" && m.winner_id)
    .map((m) => {
      const c = competitionById.get(m.competition_id)!;
      const cup = c.format_type === "gold_silver" ? (m.bracket_type === "silver" ? " · Copa Plata" : " · Copa Oro") : "";
      return {
        id: m.id,
        label: disciplineCategoryLabel(c.disciplines, c.categories) + cup,
        winner: teamName(m.winner_id),
        colors: disciplineColor(c.disciplines),
      };
    });

  // Contrarreloj (seguidor de línea): no tiene final — el campeón es el 1º
  // del ranking (mismo criterio que el podio), recién con el torneo cerrado.
  // Un empate exacto en el 1er puesto muestra a los dos.
  for (const c of competitionList) {
    if (c.format_type !== "time_trial" || c.status !== "finished") continue;
    const ranking = buildTimeTrialRanking(
      teamList.filter((t) => t.competition_id === c.id) as unknown as Team[],
      runList.filter((r) => r.competition_id === c.id)
    );
    for (const row of ranking.filter((r) => r.position === 1)) {
      champions.push({
        id: `${c.id}-${row.team.id}`,
        label: `${disciplineCategoryLabel(c.disciplines, c.categories)} · mejor tiempo ${formatRunTime(row.bestMs)}`,
        winner: row.team.name,
        colors: disciplineColor(c.disciplines),
      });
    }
  }

  // Cada disciplina con su total y debajo una fila por categoría (infantil,
  // juvenil/adultos...): mismos números, calculados torneo por torneo.
  const disciplineRows = stats.byDiscipline
    .map((d) => {
      const discipline = competitionList.find((c) => c.discipline_id === d.disciplineId)?.disciplines ?? null;
      const categories = competitionList
        .filter((c) => c.discipline_id === d.disciplineId)
        .map((c) => {
          const own = computeEventStats({
            competitions: [c],
            teams: teamList.filter((t) => t.competition_id === c.id),
            matches: matchList.filter((m) => m.competition_id === c.id),
            runs: runList.filter((r) => r.competition_id === c.id),
          }).byDiscipline[0];
          return { ...(own ?? { teams: 0, robots: 0, participants: 0, played: 0, total: 0, runs: 0 }), id: c.id, name: c.categories?.name ?? "?" };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      return {
        ...d,
        name: discipline ? disciplineDisplayName(discipline.name) : "?",
        colors: disciplineColor(discipline),
        sortOrder: discipline?.sort_order ?? 0,
        categories,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const playedLabel = (d: { played: number; total: number; runs: number }) =>
    d.total > 0 ? `${d.played} / ${d.total}` : d.runs > 0 ? `${d.runs} intentos` : "—";

  const tiles: Tile[] = [
    { label: "Robots", value: stats.robots },
    { label: "Participantes", value: stats.participants },
    { label: "Equipos", value: stats.teams, detail: stats.accredited ? `${stats.accredited} acreditados` : undefined },
    { label: "Instituciones", value: stats.institutions },
    {
      label: "Localidades",
      value: stats.localities,
      detail: stats.provinces ? `${stats.provinces} ${stats.provinces === 1 ? "provincia" : "provincias"}` : undefined,
    },
    { label: "Partidos jugados", value: stats.played, detail: `de ${stats.total} · faltan ${stats.remaining}` },
    { label: "En juego ahora", value: stats.live },
  ];
  if (stats.goals > 0) tiles.push({ label: "Goles", value: stats.goals });
  if (stats.runs > 0) tiles.push({ label: "Intentos contrarreloj", value: stats.runs });

  // Con Liga Nacional cargada: primero la suma de las dos ligas (solo lo que
  // se puede sumar — robots, equipos y participantes; instituciones,
  // localidades y partidos la Nacional no los tiene), después cada liga.
  const sumWithNational = (provincial: number, national: number | null) => provincial + (national ?? 0);
  const splitDetail = (provincial: number, national: number | null) =>
    `${provincial} provincial · ${national ?? "—"} nacional`;
  const totalTiles: Tile[] = nationalTotals
    ? [
        { label: "Robots", value: sumWithNational(stats.robots, nationalTotals.robots), detail: splitDetail(stats.robots, nationalTotals.robots) },
        {
          label: "Participantes",
          value: sumWithNational(stats.participants, nationalTotals.participants),
          detail: splitDetail(stats.participants, nationalTotals.participants),
        },
        { label: "Equipos", value: sumWithNational(stats.teams, nationalTotals.teams), detail: splitDetail(stats.teams, nationalTotals.teams) },
      ]
    : [];
  const nationalTiles: Tile[] = nationalTotals
    ? [
        { label: "Robots", value: nationalTotals.robots ?? "—" },
        { label: "Participantes", value: nationalTotals.participants ?? "—" },
        { label: "Equipos", value: nationalTotals.teams ?? "—" },
        ...(nationalLeague?.provinces !== null && nationalLeague?.provinces !== undefined
          ? [{ label: "Provincias", value: nationalLeague.provinces }]
          : []),
      ]
    : [];

  return (
    <div className="panel-page min-h-screen">
      <PublicRealtime />
      <div className="p-4 sm:p-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3 border-b-2 border-neutral-200 dark:border-neutral-800 panel-enter">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandIcon className="h-9 w-9" priority />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">Locutor</h1>
              <p className="text-sm panel-label truncate">{event.name}</p>
            </div>
          </div>
          <p className="text-sm font-display font-semibold panel-label shrink-0">{event.event_date}</p>
        </header>

        {totalTiles.length > 0 ? (
          <>
            <TileGroup title="Total del evento · las dos ligas" tiles={totalTiles} highlight />
            <TileGroup title="Liga Provincial" tiles={tiles} />
            <TileGroup title="🇦🇷 Liga Nacional" tiles={nationalTiles} />
          </>
        ) : (
          <TileGroup tiles={tiles} />
        )}

        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-5 min-w-0">
            <section className="panel-card rounded-xl overflow-hidden">
              <SectionTitle>En juego ahora</SectionTitle>
              {liveBoards.length === 0 ? (
                <p className="p-4 panel-label">No hay ningún partido en juego en este momento.</p>
              ) : (
                <div className="p-3 grid gap-3 sm:grid-cols-2">
                  {liveBoards.map((board) => {
                    const live = board.live!;
                    const next = board.upcoming[0];
                    return (
                      <div key={board.courtId} className={`rounded-lg border-l-4 panel-surface ${board.colorBorder} ${board.colorBg} p-3 space-y-2`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs uppercase tracking-wide font-display font-semibold panel-label truncate">
                            {board.courtName}
                          </span>
                          <MatchStageChip stage={live.stage} size="xs" className="shrink-0" />
                        </div>
                        <p className={`text-sm font-display font-bold ${board.colorText}`}>{live.disciplineCategory}</p>
                        <p className="text-lg font-display font-semibold text-center leading-tight">
                          {live.teamAName} <span className="panel-label font-normal">vs</span> {live.teamBName}
                        </p>
                        <MatchClock match={live.match} competition={live.competition} size="compact" />
                        {live.competition.timer_mode === "periods" && (
                          <p className="text-2xl font-mono font-bold text-center tabular-nums">
                            {live.match.score_a ?? 0} – {live.match.score_b ?? 0}
                          </p>
                        )}
                        {next && (
                          <p className="text-xs panel-label truncate border-t border-neutral-200 dark:border-neutral-800 pt-1.5">
                            Sigue: {next.teamAName} vs {next.teamBName}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel-card rounded-xl overflow-hidden">
              <SectionTitle>Últimos resultados</SectionTitle>
              {recent.length === 0 ? (
                <p className="p-4 panel-label">Todavía no terminó ningún partido.</p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {recent.map((m) => {
                    const c = competitionById.get(m.competition_id)!;
                    const a = teamName(m.team_a_id);
                    const b = teamName(m.team_b_id);
                    return (
                      <li key={m.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className="text-[15px]">
                            <span className={m.winner_id === m.team_a_id ? "font-bold" : ""}>{a}</span>
                            {m.forfeit || m.score_a === null || m.score_b === null ? (
                              <span className="panel-label"> vs </span>
                            ) : (
                              <span className="font-mono font-bold tabular-nums"> {m.score_a} – {m.score_b} </span>
                            )}
                            <span className={m.winner_id === m.team_b_id ? "font-bold" : ""}>{b}</span>
                          </p>
                          <p className={`text-xs ${disciplineColor(c.disciplines).text}`}>
                            {disciplineCategoryLabel(c.disciplines, c.categories)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.forfeit && (
                            <span className="panel-chip-warning rounded-full px-2 py-0.5 text-xs font-medium">
                              W.O. · {forfeitLabel(m.forfeit, a, b)}
                            </span>
                          )}
                          <MatchStageChip stage={matchStage(m, { goldSilver: c.format_type === "gold_silver" })} size="xs" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-5 min-w-0">
            {champions.length > 0 && (
              <section className="panel-card rounded-xl overflow-hidden">
                <SectionTitle>🏆 Campeones</SectionTitle>
                <ul className="p-3 space-y-2">
                  {champions.map((ch) => (
                    <li key={ch.id} className={`rounded-lg border-l-4 px-3 py-2 ${ch.colors.border} ${ch.colors.bg}`}>
                      <p className="text-lg font-display font-bold">{ch.winner}</p>
                      <p className={`text-xs ${ch.colors.text}`}>{ch.label}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="panel-card rounded-xl overflow-hidden">
              <SectionTitle>Por disciplina y categoría</SectionTitle>
              {disciplineRows.length === 0 ? (
                <p className="p-4 panel-label">Todavía no hay torneos cargados.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide panel-label text-right">
                      <th className="text-left font-semibold px-4 py-2">Disciplina</th>
                      <th className="font-semibold px-1.5 py-2">Equipos</th>
                      <th className="font-semibold px-1.5 py-2">Robots</th>
                      <th className="font-semibold px-1.5 py-2">Personas</th>
                      <th className="font-semibold px-4 py-2">Jugados</th>
                    </tr>
                  </thead>
                  {disciplineRows.map((d) => (
                    <tbody key={d.disciplineId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <tr className="text-right tabular-nums font-semibold">
                        <td className="text-left px-4 pt-2 pb-1">
                          <span className="inline-flex items-center gap-2 font-display">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.colors.dot}`} aria-hidden="true" />
                            {d.name}
                          </span>
                        </td>
                        <td className="px-1.5 pt-2 pb-1">{d.teams}</td>
                        <td className="px-1.5 pt-2 pb-1">{d.robots}</td>
                        <td className="px-1.5 pt-2 pb-1">{d.participants}</td>
                        <td className="px-4 pt-2 pb-1">{playedLabel(d)}</td>
                      </tr>
                      {d.categories.map((cat) => (
                        <tr key={cat.id} className="text-right tabular-nums text-[13px] panel-label">
                          <td className="text-left pl-9 pr-4 py-1 whitespace-nowrap">↳ {cat.name}</td>
                          <td className="px-1.5 py-1">{cat.teams}</td>
                          <td className="px-1.5 py-1">{cat.robots}</td>
                          <td className="px-1.5 py-1">{cat.participants}</td>
                          <td className="px-4 py-1">{playedLabel(cat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
                </div>
              )}
            </section>

            {nationalLeague && nationalTotals && (
              <section className="panel-card rounded-xl overflow-hidden">
                <SectionTitle>🇦🇷 Liga Nacional</SectionTitle>
                {nationalLeague.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide panel-label text-right">
                          <th className="text-left font-semibold px-4 py-2">Disciplina</th>
                          <th className="font-semibold px-1.5 py-2">Equipos</th>
                          <th className="font-semibold px-1.5 py-2">Robots</th>
                          <th className="font-semibold px-4 py-2">Personas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                        {nationalLeague.rows.map((r, i) => (
                          <tr key={i} className="text-right tabular-nums">
                            <td className="text-left px-4 py-2 font-display font-semibold">{r.label}</td>
                            <td className="px-1.5 py-2">{r.teams ?? "—"}</td>
                            <td className="px-1.5 py-2">{r.robots ?? "—"}</td>
                            <td className="px-4 py-2">{r.participants ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      {nationalLeague.rows.length > 1 && (
                        <tfoot>
                          <tr className="text-right tabular-nums font-bold border-t border-neutral-200 dark:border-neutral-800">
                            <td className="text-left px-4 py-2">Total</td>
                            <td className="px-1.5 py-2">{nationalTotals.teams ?? "—"}</td>
                            <td className="px-1.5 py-2">{nationalTotals.robots ?? "—"}</td>
                            <td className="px-4 py-2">{nationalTotals.participants ?? "—"}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
                {(nationalLeague.provinces !== null || nationalLeague.note) && (
                  <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800/60 space-y-0.5">
                    {nationalLeague.provinces !== null && (
                      <p className="text-sm">
                        <span className="font-display font-bold text-lg tabular-nums">{nationalLeague.provinces}</span>{" "}
                        {nationalLeague.provinces === 1 ? "provincia" : "provincias"}
                      </p>
                    )}
                    {nationalLeague.note && <p className="text-sm panel-label">{nationalLeague.note}</p>}
                  </div>
                )}
              </section>
            )}

            {stats.withdrawn + stats.forfeits > 0 && (
              <p className="text-xs panel-label px-1">
                {stats.withdrawn > 0 && `${stats.withdrawn} ${stats.withdrawn === 1 ? "equipo dado de baja" : "equipos dados de baja"}. `}
                {stats.forfeits > 0 && `${stats.forfeits} ${stats.forfeits === 1 ? "partido ganado" : "partidos ganados"} por W.O. (no cuentan como jugados).`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Tile = { label: string; value: number | string; detail?: string };

/** Fila de números grandes. `highlight`: la suma de las dos ligas, más
 * grande y con el color de marca, porque es la que se dice al micrófono. */
function TileGroup({ title, tiles, highlight = false }: { title?: string; tiles: Tile[]; highlight?: boolean }) {
  return (
    <section className="space-y-2">
      {title && (
        <h2 className={`text-xs uppercase tracking-wide font-display font-bold ${highlight ? "text-brand-teal-dark" : "panel-label"}`}>
          {title}
        </h2>
      )}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 panel-enter-stagger">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`rounded-xl px-4 py-3 ${highlight ? "panel-card border-2 border-brand-teal bg-brand-teal/8" : "panel-card"}`}
          >
            <p className="text-xs uppercase tracking-wide font-display font-semibold panel-label">{t.label}</p>
            <p className={`font-display font-bold tabular-nums leading-tight ${highlight ? "text-5xl text-brand-teal-dark" : "text-4xl"}`}>
              {t.value}
            </p>
            {t.detail && <p className="text-xs panel-label">{t.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-wide text-white bg-brand-teal-dark font-display font-bold px-4 py-2">
      {children}
    </h2>
  );
}
