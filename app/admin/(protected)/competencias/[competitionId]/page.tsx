import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Competition,
  Court,
  Discipline,
  Category,
  Team,
  Group,
  GroupTeam,
  Match,
  GroupStandingRow,
} from "@/lib/database.types";
import {
  addTeam,
  removeTeam,
  createGroup,
  randomDraw,
  generateGroupMatches,
  assignSchedule,
  submitResult,
  generateBracket,
} from "./actions";
import { GroupAssignSelect } from "./group-assign-select";
import { StandingsTable } from "./standings-table";
import { BracketView, type BracketDisplayMatch } from "./bracket-view";
import { RealtimeRefresh } from "./realtime-refresh";

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .maybeSingle<Competition>();
  if (!competition) notFound();

  const [
    { data: discipline },
    { data: category },
    { data: event },
    { data: teams },
    { data: groups },
    { data: groupTeams },
    { data: groupMatches },
    { data: bracketMatches },
  ] = await Promise.all([
    supabase.from("disciplines").select("*").eq("id", competition.discipline_id).single<Discipline>(),
    supabase.from("categories").select("*").eq("id", competition.category_id).single<Category>(),
    supabase.from("events").select("id, name").eq("id", competition.event_id).single(),
    supabase.from("teams").select("*").eq("competition_id", competitionId).order("name"),
    supabase.from("groups").select("*").eq("competition_id", competitionId).order("sort_order"),
    supabase
      .from("group_teams")
      .select("*, groups!inner(competition_id)")
      .eq("groups.competition_id", competitionId),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competitionId)
      .eq("phase", "group")
      .order("turno"),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competitionId)
      .eq("phase", "bracket")
      .order("bracket_slot"),
  ]);

  const { data: courts } = await supabase
    .from("courts")
    .select("*")
    .eq("event_id", event?.id ?? "")
    .order("sort_order");

  const teamsById = new Map((teams ?? []).map((t: Team) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];
  const groupTeamsList = (groupTeams ?? []) as GroupTeam[];
  const groupIdByTeamId = new Map(groupTeamsList.map((gt) => [gt.team_id, gt.group_id]));

  const standingsByGroup = await Promise.all(
    groupsList.map(async (g) => {
      const { data } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
      return { group: g, rows: (data ?? []) as GroupStandingRow[] };
    })
  );

  const addTeamAction = addTeam.bind(null, competitionId);
  const createGroupAction = createGroup.bind(null, competitionId);
  const randomDrawAction = randomDraw.bind(null, competitionId);
  const generateMatchesAction = generateGroupMatches.bind(null, competitionId);
  const assignScheduleAction = assignSchedule.bind(null, competitionId);
  const submitResultAction = submitResult.bind(null, competitionId);
  const generateBracketAction = generateBracket.bind(null, competitionId);

  const bracketDisplayMatches: BracketDisplayMatch[] = (bracketMatches ?? []).map((m: Match) => ({
    ...m,
    team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
    team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <RealtimeRefresh competitionId={competitionId} />

      <div>
        <h1 className="text-lg font-semibold">
          {discipline?.name} — {category?.name}
        </h1>
        <p className="text-sm text-neutral-500">
          {event?.name} · {competition.status}
        </p>
      </div>

      {/* Equipos */}
      <section className="rounded-lg border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Equipos ({(teams ?? []).length})</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {(teams ?? []).map((t: Team) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-2 text-sm"
            >
              <div>
                <p>{t.name}</p>
                {t.institution && <p className="text-xs text-neutral-500">{t.institution}</p>}
              </div>
              <div className="flex items-center gap-2">
                {groupsList.length > 0 && (
                  <GroupAssignSelect
                    competitionId={competitionId}
                    teamId={t.id}
                    groups={groupsList}
                    currentGroupId={groupIdByTeamId.get(t.id) ?? null}
                  />
                )}
                <form action={removeTeam.bind(null, competitionId, t.id)}>
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                    Quitar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
        <form action={addTeamAction} className="flex flex-wrap gap-2">
          <input
            name="name"
            required
            placeholder="Nombre del equipo"
            className="flex-1 min-w-[150px] rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
          />
          <input
            name="institution"
            placeholder="Institución (opcional)"
            className="flex-1 min-w-[150px] rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-100 text-neutral-900 font-medium px-4 py-2 text-sm hover:bg-white transition-colors"
          >
            Agregar
          </button>
        </form>
      </section>

      {/* Grupos */}
      <section className="rounded-lg border border-neutral-800 p-4 space-y-3">
        <h2 className="font-medium">Grupos</h2>
        <div className="flex flex-wrap gap-2">
          {groupsList.map((g) => (
            <span key={g.id} className="text-xs rounded-full px-3 py-1 bg-neutral-800">
              {g.name}
            </span>
          ))}
          {groupsList.length === 0 && <p className="text-sm text-neutral-500">Sin grupos todavía.</p>}
        </div>
        <div className="flex flex-wrap gap-4 pt-2 border-t border-neutral-800">
          <form action={createGroupAction} className="flex gap-2">
            <input
              name="name"
              placeholder="Grupo C"
              required
              className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm w-32"
            />
            <button
              type="submit"
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              + Grupo manual
            </button>
          </form>
          <form action={randomDrawAction} className="flex gap-2 items-center">
            <label className="text-sm text-neutral-400">Sorteo aleatorio en</label>
            <input
              name="num_groups"
              type="number"
              min={1}
              defaultValue={2}
              className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm w-16"
            />
            <button
              type="submit"
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              grupos
            </button>
          </form>
        </div>
        <p className="text-xs text-neutral-600">
          El sorteo aleatorio borra y vuelve a repartir todas las asignaciones actuales.
        </p>
      </section>

      {/* Posiciones */}
      {standingsByGroup.length > 0 && (
        <section className="rounded-lg border border-neutral-800 p-4 space-y-6">
          <h2 className="font-medium">Tabla de posiciones</h2>
          {standingsByGroup.map(({ group, rows }) => (
            <StandingsTable
              key={group.id}
              competitionId={competitionId}
              groupId={group.id}
              groupName={group.name}
              rows={rows}
              editable
            />
          ))}
        </section>
      )}

      {/* Fixture / cronograma / resultados de grupo */}
      <section className="rounded-lg border border-neutral-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Partidos de fase de grupos</h2>
          <form action={generateMatchesAction}>
            <button
              type="submit"
              className="text-xs rounded-md border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800"
            >
              Generar todos-contra-todos
            </button>
          </form>
        </div>
        <div className="space-y-2">
          {(groupMatches ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no se generaron partidos.</p>
          )}
          {(groupMatches ?? []).map((m: Match) => (
            <MatchRow
              key={m.id}
              match={m}
              teamAName={m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? "?" : "?"}
              teamBName={m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? "?" : "?"}
              courts={(courts ?? []) as Court[]}
              onSchedule={assignScheduleAction.bind(null, m.id)}
              onResult={submitResultAction.bind(null, m.id)}
            />
          ))}
        </div>
      </section>

      {/* Cuadro eliminatorio */}
      {competition.format_type === "single_elimination" && (
        <section className="rounded-lg border border-neutral-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Cuadro de eliminatoria simple</h2>
            {bracketDisplayMatches.length === 0 && (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md bg-neutral-100 text-neutral-900 px-3 py-1.5 font-medium hover:bg-white"
                >
                  Generar cuadro desde posiciones
                </button>
              </form>
            )}
          </div>
          {bracketDisplayMatches.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Se genera con los clasificados de cada grupo ({competition.qualifiers_per_group} por grupo)
              una vez que la fase de grupos esté cerrada.
            </p>
          ) : (
            <BracketView competitionId={competitionId} matches={bracketDisplayMatches} />
          )}
        </section>
      )}
    </div>
  );
}

function MatchRow({
  match,
  teamAName,
  teamBName,
  courts,
  onSchedule,
  onResult,
}: {
  match: Match;
  teamAName: string;
  teamBName: string;
  courts: Court[];
  onSchedule: (formData: FormData) => Promise<void>;
  onResult: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-md bg-neutral-900 px-3 py-2 flex flex-wrap items-center gap-3 text-sm">
      <div className="min-w-[180px] flex-1">
        <span className={match.winner_id === match.team_a_id ? "font-semibold" : ""}>{teamAName}</span>
        {" vs "}
        <span className={match.winner_id === match.team_b_id ? "font-semibold" : ""}>{teamBName}</span>
        {match.status === "completed" && match.score_a !== null && match.score_b !== null && (
          <span className="text-neutral-500"> · {match.score_a}-{match.score_b}</span>
        )}
      </div>

      {match.status !== "completed" && (
        <>
          <form action={onSchedule} className="flex items-center gap-1">
            <select
              name="court_id"
              defaultValue={match.court_id ?? ""}
              className="rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs"
            >
              <option value="">Sin cancha</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="turno"
              type="number"
              placeholder="Turno"
              defaultValue={match.turno ?? ""}
              className="w-16 rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs"
            />
            <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-100">
              Guardar
            </button>
          </form>

          <form action={onResult} className="flex items-center gap-1">
            <input
              name="score_a"
              type="number"
              placeholder="A"
              className="w-12 rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs"
            />
            <input
              name="score_b"
              type="number"
              placeholder="B"
              className="w-12 rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs"
            />
            <select
              name="winner_id"
              defaultValue=""
              className="rounded bg-neutral-950 border border-neutral-700 px-1.5 py-1 text-xs"
            >
              <option value="">(o ganador directo)</option>
              <option value={match.team_a_id ?? ""}>{teamAName}</option>
              <option value={match.team_b_id ?? ""}>{teamBName}</option>
            </select>
            <button type="submit" className="text-xs rounded bg-neutral-100 text-neutral-900 px-2 py-1">
              Cargar resultado
            </button>
          </form>
        </>
      )}
    </div>
  );
}
