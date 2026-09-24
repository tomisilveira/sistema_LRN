import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Court, EventRow, Group, GroupStandingRow, Match, Team } from "@/lib/database.types";
import { buildPodium, type PodiumBoard } from "@/lib/podium";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { buildCourtBoards } from "@/lib/build-court-boards";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineCategoryLabel } from "@/lib/discipline-display";
import { competitionStatusChipClass, competitionStatusLabel } from "@/lib/labels";
import { CourtBoards } from "@/app/components/court-boards";
import {
  ActivityIcon,
  AlertIcon,
  BadgeCheckIcon,
  ChevronRightIcon,
  InfoIcon,
  TrophyIcon,
  UsersIcon,
} from "@/app/components/action-icons";
import { GoToTabButton } from "./go-to-tab-button";

interface Pending {
  tone: "warning" | "info";
  text: string;
  action?: { tabId: string; label: string };
}

/** Pestaña "Resumen" del evento: el estado general de un vistazo — KPIs
 * (equipos, acreditación, partidos, participantes), las canchas que están
 * jugando ahora, el avance de cada torneo y una lista de pendientes con
 * atajo a la pestaña donde se resuelven. Solo lectura: todo lo que se edita
 * sigue estando en su pestaña. */
export async function EventDashboard({
  supabase,
  event,
  competitions,
  courts,
}: {
  supabase: SupabaseClient;
  event: EventRow;
  competitions: CompetitionWithNames[];
  courts: Pick<Court, "id" | "discipline_id">[];
}) {
  const competitionIds = competitions.map((c) => c.id);
  const [{ data: teamsData }, { data: matchesData }, { data: groupsData }, boards] = await Promise.all([
    competitionIds.length
      ? supabase.from("teams").select("*").in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as Team[] }),
    competitionIds.length
      ? supabase.from("matches").select("*").in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as Match[] }),
    competitionIds.length
      ? supabase.from("groups").select("*").in("competition_id", competitionIds)
      : Promise.resolve({ data: [] as Group[] }),
    buildCourtBoards(supabase, event.id, competitions),
  ]);
  const teams = (teamsData ?? []) as Team[];
  const matches = (matchesData ?? []) as Match[];
  const groups = (groupsData ?? []) as Group[];
  const liveBoards = boards.filter((b) => b.live);

  const accredited = teams.filter((t) => t.accredited).length;
  const homologated = teams.filter((t) => t.homologated).length;
  const participants = teams.reduce((sum, t) => sum + (t.member_count ?? 0), 0);
  const present = teams.reduce((sum, t) => sum + (t.accredited ? (t.participants_present ?? 0) : 0), 0);
  // "pending_teams" = partidos del cuadro que todavía no tienen rivales
  // definidos: cuentan para el total (se van a jugar) igual que el resto.
  const completed = matches.filter((m) => m.status === "completed").length;
  const inProgress = matches.filter((m) => m.status === "in_progress").length;

  const perCompetition = competitions
    .map((c) => {
      const cTeams = teams.filter((t) => t.competition_id === c.id);
      const cMatches = matches.filter((m) => m.competition_id === c.id);
      return {
        competition: c,
        teams: cTeams.length,
        accredited: cTeams.filter((t) => t.accredited).length,
        matchesTotal: cMatches.length,
        matchesDone: cMatches.filter((m) => m.status === "completed").length,
        live: cMatches.some((m) => m.status === "in_progress"),
      };
    })
    .sort(
      (a, b) =>
        (a.competition.disciplines?.sort_order ?? 99) - (b.competition.disciplines?.sort_order ?? 99) ||
        disciplineCategoryLabel(a.competition.disciplines, a.competition.categories).localeCompare(
          disciplineCategoryLabel(b.competition.disciplines, b.competition.categories)
        )
    );

  const winners = await buildWinners(supabase, perCompetition.map((p) => p.competition), teams, matches, groups);

  const pending: Pending[] = [];
  if (competitions.length === 0)
    pending.push({ tone: "warning", text: "Todavía no hay torneos creados.", action: { tabId: "torneos", label: "Crear torneo" } });
  if (courts.length === 0 && competitions.length > 0)
    pending.push({ tone: "warning", text: "No hay canchas cargadas.", action: { tabId: "canchas", label: "Ir a Canchas" } });
  const courtsWithoutDiscipline = courts.filter((c) => !c.discipline_id).length;
  if (courtsWithoutDiscipline > 0)
    pending.push({
      tone: "warning",
      text: `${courtsWithoutDiscipline} ${courtsWithoutDiscipline === 1 ? "cancha no tiene" : "canchas no tienen"} disciplina asignada.`,
      action: { tabId: "canchas", label: "Asignar" },
    });
  const emptyCompetitions = perCompetition.filter((p) => p.teams === 0).length;
  if (emptyCompetitions > 0)
    pending.push({
      tone: "warning",
      text: `${emptyCompetitions} ${emptyCompetitions === 1 ? "torneo no tiene" : "torneos no tienen"} equipos inscriptos.`,
    });
  const notStarted = competitions.filter((c) => c.status === "setup").length;
  if (notStarted > 0 && emptyCompetitions < notStarted)
    pending.push({
      tone: "info",
      text: `${notStarted} ${notStarted === 1 ? "torneo sin iniciar" : "torneos sin iniciar"} (armando grupos o formato).`,
    });
  if (teams.length > 0 && accredited < teams.length && event.status === "active")
    pending.push({ tone: "warning", text: `${teams.length - accredited} equipos todavía sin acreditar.` });
  const openRegistration = competitions.filter((c) => c.registration_open).length;
  if (openRegistration > 0)
    pending.push({
      tone: "info",
      text: `Inscripción abierta en ${openRegistration} ${openRegistration === 1 ? "torneo" : "torneos"}.`,
    });
  if (!event.is_public)
    pending.push({ tone: "info", text: "El evento es privado: no aparece en el sitio público." });

  return (
    <div className="space-y-4">
      {/* KPIs — número grande + contexto en texto (no solo la barra), como
          pide la guía de accesibilidad de gráficos de avance. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<UsersIcon />}
          label="Equipos inscriptos"
          value={teams.length}
          hint={`en ${competitions.length} ${competitions.length === 1 ? "torneo" : "torneos"}`}
        />
        <StatTile
          icon={<BadgeCheckIcon />}
          label="Acreditados"
          value={accredited}
          total={teams.length}
          hint={`${homologated} homologados`}
        />
        <StatTile
          icon={<TrophyIcon />}
          label="Partidos jugados"
          value={completed}
          total={matches.length}
          hint={inProgress > 0 ? `${inProgress} en juego ahora` : "ninguno en juego ahora"}
          live={inProgress > 0}
        />
        <StatTile
          icon={<ActivityIcon />}
          label="Participantes"
          value={participants}
          hint={present > 0 ? `${present} presentes (acreditación)` : "según inscripción"}
        />
      </div>

      {liveBoards.length > 0 && <CourtBoards boards={liveBoards} />}

      {winners.length > 0 && (
        <section className="panel-card rounded-xl p-4 space-y-3">
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <TrophyIcon className="w-5 h-5 text-brand-orange" />
            Ganadores
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {winners.map(({ competition, boards: podiums }) => {
              const colors = disciplineColor(competition.disciplines);
              return (
                <Link
                  key={competition.id}
                  href={`/admin/competencias/${competition.id}`}
                  className={`block rounded-lg border-l-4 ${colors.border} ${colors.bg} p-3 space-y-2.5 hover:brightness-[0.97] transition focus-visible:outline-2 focus-visible:outline-brand-teal`}
                >
                  <p className={`text-sm font-display font-bold leading-snug ${colors.text}`}>
                    {disciplineCategoryLabel(competition.disciplines, competition.categories)}
                  </p>
                  {podiums.map((podium) => (
                    <div key={podium.label} className="space-y-1.5">
                      {podiums.length > 1 && (
                        <p className="text-[11px] font-semibold uppercase tracking-wide panel-label">
                          {podium.label.replace(/^\S+\s/, "")}
                        </p>
                      )}
                      <ol className="space-y-1.5">
                        {podium.entries.map((entry) => (
                          <li key={entry.position} className="flex items-start gap-2">
                            <span
                              className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs font-bold tabular-nums ${medalClass[entry.position]}`}
                              aria-label={`${entry.position}º puesto`}
                            >
                              {entry.position}
                            </span>
                            <span className="min-w-0">
                              <span className={`block leading-snug ${entry.position === 1 ? "font-semibold" : "text-sm"}`}>
                                {entry.team.name}
                                {entry.participantCount > 0 && (
                                  <span
                                    className="font-normal panel-label tabular-nums"
                                    title={`${entry.participantCount} ${entry.participantCount === 1 ? "participante" : "participantes"}`}
                                  >
                                    {" "}({entry.participantCount})
                                  </span>
                                )}
                              </span>
                              {(entry.team.institution || entry.participantNames.length > 0) && (
                                <span className="block text-[11px] panel-label leading-snug">
                                  {[entry.team.institution, entry.participantNames.join(" · ")].filter(Boolean).join(" — ")}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {podium.entries.length < 3 && podium.note && (
                        <p className="text-[11px] panel-label italic">{podium.note}</p>
                      )}
                    </div>
                  ))}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <section className="panel-card rounded-xl p-4 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold">Avance por torneo</h2>
            <GoToTabButton tabId="torneos">Ver torneos</GoToTabButton>
          </div>
          {perCompetition.length === 0 ? (
            <p className="text-sm panel-label">Todavía no hay torneos en este evento.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 -mx-1">
              {perCompetition.map((p) => {
                const colors = disciplineColor(p.competition.disciplines);
                return (
                  <li key={p.competition.id}>
                    <Link
                      href={`/admin/competencias/${p.competition.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-teal/5 transition-colors focus-visible:outline-2 focus-visible:outline-brand-teal"
                    >
                      <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <span className="sm:w-1/2 min-w-0 space-y-1">
                          <span className="flex items-start gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${colors.dot}`} aria-hidden="true" />
                            <span className="text-sm font-medium leading-snug">
                              {disciplineCategoryLabel(p.competition.disciplines, p.competition.categories)}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 pl-4.5">
                            <span
                              className={`text-[11px] rounded-full px-2 py-px font-medium ${competitionStatusChipClass[p.competition.status]}`}
                            >
                              {competitionStatusLabel[p.competition.status]}
                            </span>
                            {p.live && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                                <span className="panel-live-dot" aria-hidden="true" />
                                En vivo
                              </span>
                            )}
                            {p.competition.registration_open && (
                              <span className="text-[11px] panel-label">Inscripción abierta</span>
                            )}
                          </span>
                        </span>
                        <span className="sm:flex-1 pl-4.5 sm:pl-0 space-y-1">
                          <ProgressBar value={p.matchesDone} total={p.matchesTotal} label="Partidos jugados" />
                          <span className="block text-[11px] panel-label">
                            {p.teams} equipos · {p.accredited} acreditados
                          </span>
                        </span>
                      </span>
                      <ChevronRightIcon className="w-4 h-4 text-neutral-400 group-hover:text-brand-teal transition-colors" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel-card rounded-xl p-4 space-y-3">
          <h2 className="font-display font-semibold">Pendientes</h2>
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-brand-green font-medium">
              <BadgeCheckIcon /> Todo en orden.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((item, i) => (
                <li
                  key={i}
                  className={`flex gap-2.5 rounded-lg border p-2.5 text-sm ${
                    item.tone === "warning"
                      ? "border-brand-orange/30 bg-brand-orange/8"
                      : "border-neutral-200 bg-neutral-50"
                  }`}
                >
                  {item.tone === "warning" ? (
                    <AlertIcon className="w-4 h-4 mt-0.5 text-brand-orange" />
                  ) : (
                    <InfoIcon className="w-4 h-4 mt-0.5 text-neutral-400" />
                  )}
                  <span className="space-y-1 min-w-0">
                    <span className="block leading-snug">{item.text}</span>
                    {item.action && <GoToTabButton tabId={item.action.tabId}>{item.action.label}</GoToTabButton>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  total,
  hint,
  live = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  hint: string;
  live?: boolean;
}) {
  return (
    <div className="panel-card rounded-xl p-4 flex flex-col gap-2">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide panel-label">{label}</span>
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-brand-teal/10 text-brand-teal">{icon}</span>
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-3xl font-display font-bold tabular-nums leading-none">{value}</span>
        {total !== undefined && <span className="text-sm panel-label tabular-nums">/ {total}</span>}
      </span>
      {total !== undefined && <ProgressBar value={value} total={total} label={label} hideText />}
      <span className={`text-xs flex items-center gap-1.5 ${live ? "text-red-600 font-medium" : "panel-label"}`}>
        {live && <span className="panel-live-dot" aria-hidden="true" />}
        {hint}
      </span>
    </div>
  );
}

function ProgressBar({
  value,
  total,
  label,
  hideText = false,
}: {
  value: number;
  total: number;
  label: string;
  hideText?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const done = total > 0 && value >= total;
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        className="relative flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${done ? "bg-brand-green" : "bg-brand-teal"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      {!hideText && (
        <span className="text-[11px] panel-label tabular-nums whitespace-nowrap">
          {total > 0 ? `${value}/${total}` : "sin fixture"}
        </span>
      )}
    </span>
  );
}

const medalClass: Record<1 | 2 | 3, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-neutral-300 text-neutral-800",
  3: "bg-orange-300 text-orange-950",
};

type WinnersEntry = { competition: CompetitionWithNames; boards: PodiumBoard[] };

/** Podio de cada torneo que ya tenga ganadores definidos — misma lógica que
 * el panel Podio del torneo (lib/podium.ts). Solo fase de grupos con un
 * grupo: se toma la tabla recién con los grupos cerrados (antes sería el
 * líder parcial, no el ganador). Torneos sin ningún puesto definido no
 * aparecen. */
async function buildWinners(
  supabase: SupabaseClient,
  competitions: CompetitionWithNames[],
  teams: Team[],
  matches: Match[],
  groups: Group[]
): Promise<WinnersEntry[]> {
  const results = await Promise.all(
    competitions.map(async (competition): Promise<WinnersEntry | null> => {
      const cGroups = groups.filter((g) => g.competition_id === competition.id);
      const groupsClosed = competition.status === "groups_done" || competition.status === "finished";
      if (competition.format_type === "groups_only" && !groupsClosed) return null;

      let standingsByGroup: { group: Group; rows: GroupStandingRow[] }[] = [];
      if (competition.format_type === "groups_only" && cGroups.length === 1) {
        const { data } = await supabase.rpc("get_group_standings", { p_group_id: cGroups[0].id });
        standingsByGroup = [{ group: cGroups[0], rows: (data ?? []) as GroupStandingRow[] }];
      }

      const boards = buildPodium({
        competition,
        teams: teams.filter((t) => t.competition_id === competition.id),
        groups: cGroups,
        standingsByGroup,
        bracketMatches: matches.filter((m) => m.competition_id === competition.id && m.phase === "bracket"),
      }).filter((b) => b.entries.length > 0);
      return boards.length > 0 ? { competition, boards } : null;
    })
  );
  return results.filter((r): r is WinnersEntry => r !== null);
}
