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
  setRegistrationOpen,
} from "./actions";
import { GroupAssignSelect } from "./group-assign-select";
import { StandingsTable } from "./standings-table";
import { BracketView, type BracketDisplayMatch } from "./bracket-view";
import { RealtimeRefresh } from "./realtime-refresh";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { FormatAdvisory } from "./format-advisory";
import { EditFormatForm } from "./edit-format-form";

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
  const setRegistrationOpenAction = setRegistrationOpen.bind(null, competitionId);

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
        <p className="text-sm panel-label">
          {event?.name} · {competition.status}
        </p>
      </div>

      {/* Formato del torneo */}
      <section className="panel-card rounded-lg p-4 space-y-4">
        <h2 className="font-medium">Formato del torneo</h2>
        <FormatAdvisory teamCount={(teams ?? []).length} courtCount={(courts ?? []).length} />
        {competition.status === "setup" ? (
          <EditFormatForm competitionId={competitionId} competition={competition} />
        ) : (
          <p className="text-xs panel-label">
            Ya se generaron los partidos de grupo, así que el formato quedó fijo para este
            torneo.
          </p>
        )}
      </section>

      {/* Inscripción pública */}
      <section className="panel-card rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Inscripción pública de equipos</h2>
          <p className="text-xs panel-label mt-0.5">
            {competition.registration_open
              ? "Abierta — compartí el link para que los equipos se carguen solos."
              : "Cerrada — los equipos no pueden auto-registrarse."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {competition.registration_open && (
            <CopyLinkButton path={`/inscripcion/${competitionId}`} label="Copiar link de inscripción" />
          )}
          <form action={setRegistrationOpenAction.bind(null, !competition.registration_open)}>
            <button
              type="submit"
              className={`text-xs rounded-full px-3 py-1.5 transition-colors ${
                competition.registration_open ? "panel-chip" : "panel-button-primary"
              }`}
            >
              {competition.registration_open ? "Cerrar inscripción" : "Abrir inscripción"}
            </button>
          </form>
        </div>
      </section>

      {/* Equipos */}
      <section className="panel-card rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Equipos ({(teams ?? []).length})</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {(teams ?? []).map((t: Team) => (
            <div
              key={t.id}
              className="panel-surface flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <div>
                <p>{t.name}</p>
                {t.institution && <p className="text-xs panel-label">{t.institution}</p>}
                {t.mentor_name && (
                  <p className="text-xs panel-label opacity-80">
                    {t.mentor_name} · {t.mentor_contact}
                  </p>
                )}
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
            className="flex-1 min-w-[150px] rounded-md panel-input px-3 py-2 text-sm"
          />
          <input
            name="institution"
            placeholder="Institución (opcional)"
            className="flex-1 min-w-[150px] rounded-md panel-input px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">
            Agregar
          </button>
        </form>
      </section>

      {/* Grupos */}
      <section className="panel-card rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Grupos</h2>
        <div className="flex flex-wrap gap-2">
          {groupsList.map((g) => (
            <span key={g.id} className="panel-chip text-xs rounded-full px-3 py-1">
              {g.name}
            </span>
          ))}
          {groupsList.length === 0 && <p className="text-sm panel-label">Sin grupos todavía.</p>}
        </div>
        <div className="flex flex-wrap gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <form action={createGroupAction} className="flex gap-2">
            <input
              name="name"
              placeholder="Grupo C"
              required
              className="rounded-md panel-input px-3 py-2 text-sm w-32"
            />
            <button type="submit" className="rounded-md panel-button-secondary px-3 py-2 text-sm">
              + Grupo manual
            </button>
          </form>
          <form action={randomDrawAction} className="flex gap-2 items-center">
            <label className="text-sm panel-label">Sorteo aleatorio en</label>
            <input
              name="num_groups"
              type="number"
              min={1}
              defaultValue={2}
              className="rounded-md panel-input px-2 py-2 text-sm w-16"
            />
            <button type="submit" className="rounded-md panel-button-secondary px-3 py-2 text-sm">
              grupos
            </button>
          </form>
        </div>
        <p className="text-xs panel-label opacity-80">
          El sorteo aleatorio borra y vuelve a repartir todas las asignaciones actuales.
        </p>
      </section>

      {/* Posiciones */}
      {standingsByGroup.length > 0 && (
        <section className="panel-card rounded-lg p-4 space-y-6">
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
      <section className="panel-card rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Partidos de fase de grupos</h2>
          <form action={generateMatchesAction}>
            <button type="submit" className="text-xs rounded-md panel-button-secondary px-3 py-1.5">
              Generar todos-contra-todos
            </button>
          </form>
        </div>
        <div className="space-y-2">
          {(groupMatches ?? []).length === 0 && (
            <p className="text-sm panel-label">Todavía no se generaron partidos.</p>
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
        <section className="panel-card rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Cuadro de eliminatoria simple</h2>
            {bracketDisplayMatches.length === 0 && (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md panel-button-primary px-3 py-1.5 font-medium"
                >
                  Generar cuadro desde posiciones
                </button>
              </form>
            )}
          </div>
          {bracketDisplayMatches.length === 0 ? (
            <p className="text-sm panel-label">
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
    <div className="panel-surface rounded-md px-3 py-2 flex flex-wrap items-center gap-3 text-sm">
      <div className="min-w-[180px] flex-1">
        <span className={match.winner_id === match.team_a_id ? "font-semibold" : ""}>{teamAName}</span>
        {" vs "}
        <span className={match.winner_id === match.team_b_id ? "font-semibold" : ""}>{teamBName}</span>
        {match.status === "completed" && match.score_a !== null && match.score_b !== null && (
          <span className="panel-label"> · {match.score_a}-{match.score_b}</span>
        )}
        {match.status === "in_progress" && (
          <span className="text-amber-600 dark:text-amber-400"> · en curso</span>
        )}
      </div>

      {match.status !== "completed" && (
        <>
          <form action={onSchedule} className="flex items-center gap-1">
            <select
              name="court_id"
              defaultValue={match.court_id ?? ""}
              className="rounded panel-input px-1.5 py-1 text-xs"
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
              className="w-16 rounded panel-input px-1.5 py-1 text-xs"
            />
            <button type="submit" className="text-xs panel-label hover:opacity-80">
              Guardar
            </button>
          </form>

          <form action={onResult} className="flex items-center gap-1">
            <input
              name="score_a"
              type="number"
              placeholder="A"
              className="w-12 rounded panel-input px-1.5 py-1 text-xs"
            />
            <input
              name="score_b"
              type="number"
              placeholder="B"
              className="w-12 rounded panel-input px-1.5 py-1 text-xs"
            />
            <select
              name="winner_id"
              defaultValue=""
              className="rounded panel-input px-1.5 py-1 text-xs"
            >
              <option value="">(o ganador directo)</option>
              <option value={match.team_a_id ?? ""}>{teamAName}</option>
              <option value={match.team_b_id ?? ""}>{teamBName}</option>
            </select>
            <button type="submit" className="text-xs rounded panel-button-primary px-2 py-1">
              Cargar resultado
            </button>
          </form>
        </>
      )}
    </div>
  );
}
