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
  startTournament,
  restartTournament,
  assignSchedule,
  submitResult,
  generateBracket,
  setRegistrationOpen,
} from "./actions";
import { GroupAssignSelect } from "./group-assign-select";
import { StandingsTable } from "./standings-table";
import { MatchResultForm } from "./match-result-form";
import { BracketView, type BracketDisplayMatch } from "./bracket-view";
import { RealtimeRefresh } from "./realtime-refresh";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TabbedLayout, type TabItem } from "@/app/components/tabbed-layout";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ModalFormButton } from "@/app/components/modal-form";
import { competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { disciplineColor } from "@/lib/discipline-colors";
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

  const [{ data: courtsRaw }, { data: allDisciplines }] = await Promise.all([
    supabase.from("courts").select("*").eq("event_id", event?.id ?? "").order("sort_order"),
    supabase.from("disciplines").select("id, name"),
  ]);
  const disciplineNameById = new Map((allDisciplines ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));

  // Las canchas se comparten entre torneos, pero conviene ver primero las
  // que ya están armadas para esta disciplina — evita elegir por error una
  // cancha de otra disciplina al asignar un partido.
  const courts = [...(courtsRaw ?? [])].sort((a: Court, b: Court) => {
    const aMatch = a.discipline_id === competition.discipline_id ? 0 : 1;
    const bMatch = b.discipline_id === competition.discipline_id ? 0 : 1;
    return aMatch - bMatch || a.sort_order - b.sort_order;
  });

  const teamsById = new Map((teams ?? []).map((t: Team) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];
  const groupTeamsList = (groupTeams ?? []) as GroupTeam[];
  const groupIdByTeamId = new Map(groupTeamsList.map((gt) => [gt.team_id, gt.group_id]));

  // Armado de cada grupo, para mostrarlo en la pestaña Grupos sin tener que
  // ir a buscar cada equipo o saltar a Posiciones.
  const teamsByGroupId = new Map<string, Team[]>();
  for (const gt of groupTeamsList) {
    const team = teamsById.get(gt.team_id);
    if (!team) continue;
    const list = teamsByGroupId.get(gt.group_id) ?? [];
    list.push(team);
    teamsByGroupId.set(gt.group_id, list);
  }
  const unassignedTeams = (teams ?? []).filter((t: Team) => !groupIdByTeamId.has(t.id));

  // Si la RPC de un grupo puntual falla (red, cold start, etc.), que se
  // pierda solo ese grupo y no toda la página — antes un error acá tiraba
  // abajo todo el render del server component.
  const standingsByGroup = await Promise.all(
    groupsList.map(async (g) => {
      try {
        const { data, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
        if (error) throw error;
        return { group: g, rows: (data ?? []) as GroupStandingRow[] };
      } catch (err) {
        console.error(`get_group_standings falló para el grupo ${g.id}:`, err);
        return { group: g, rows: [] as GroupStandingRow[] };
      }
    })
  );

  const addTeamAction = addTeam.bind(null, competitionId);
  const createGroupAction = createGroup.bind(null, competitionId);
  const randomDrawAction = randomDraw.bind(null, competitionId);
  const startTournamentAction = startTournament.bind(null, competitionId);
  const restartTournamentAction = restartTournament.bind(null, competitionId);
  const assignScheduleAction = assignSchedule.bind(null, competitionId);
  const submitResultAction = submitResult.bind(null, competitionId);
  const generateBracketAction = generateBracket.bind(null, competitionId);
  const setRegistrationOpenAction = setRegistrationOpen.bind(null, competitionId);

  const bracketDisplayMatches: BracketDisplayMatch[] = (bracketMatches ?? []).map((m: Match) => ({
    ...m,
    team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
    team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
  }));

  const colors = disciplineColor(discipline);
  const teamsReadyCount = (teams ?? []).filter((t: Team) => t.accredited && t.homologated).length;

  // Personas presentes por equipo — cargado desde Acreditación
  // (participants_present) con member_count como respaldo si todavía no se
  // acreditó. Sirve para calcular medallas/premios por grupo.
  const peopleCount = (t: Team) => t.participants_present ?? t.member_count ?? 0;
  const grandTotalPeople = (teams ?? []).reduce((sum, t) => sum + peopleCount(t), 0);

  const tabs: TabItem[] = [
    {
      id: "formato",
      label: "Formato",
      content: (
        <section className={`panel-card rounded-xl p-4 space-y-4 border-l-4 ${colors.border}`}>
          <h2 className="font-medium">Formato del torneo</h2>
          <FormatAdvisory teamCount={(teams ?? []).length} courtCount={(courts ?? []).length} />
          {competition.status === "setup" ? (
            <EditFormatForm competitionId={competitionId} competition={competition} />
          ) : (
            <p className="text-xs panel-label">
              Ya se generaron los partidos de grupo, así que el formato quedó fijo para este torneo.
            </p>
          )}
        </section>
      ),
    },
    {
      id: "inscripcion",
      label: "Inscripción",
      content: (
        <section className="panel-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
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
      ),
    },
    {
      id: "equipos",
      label: "Equipos",
      badge: (teams ?? []).length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium">
              Equipos ({(teams ?? []).length}) · {teamsReadyCount} listos
            </h2>
            <ModalFormButton
              buttonLabel="+ Agregar equipo"
              buttonClassName="rounded-md panel-button-primary font-medium px-4 py-2 text-sm shrink-0 whitespace-nowrap"
              title="Agregar equipo"
              action={addTeamAction}
              submitLabel="Agregar"
            >
              <div>
                <label className="block text-sm panel-label mb-1">Nombre del equipo</label>
                <input
                  name="name"
                  required
                  placeholder="Nombre del equipo"
                  className="w-full rounded-md panel-input px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm panel-label mb-1">Institución (opcional)</label>
                <input
                  name="institution"
                  placeholder="Institución"
                  className="w-full rounded-md panel-input px-3 py-2 text-sm"
                />
              </div>
            </ModalFormButton>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {(teams ?? []).map((t: Team) => {
              const ready = t.accredited && t.homologated;
              return (
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
                    <span
                      className={`inline-block mt-1 text-xs rounded-full px-2 py-0.5 font-medium ${
                        ready ? "panel-chip-success" : "panel-chip-warning"
                      }`}
                    >
                      {ready ? "✅ Acreditado y homologado" : "⏳ Falta acreditar/homologar"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {groupsList.length > 0 && ready && (
                      <GroupAssignSelect
                        competitionId={competitionId}
                        teamId={t.id}
                        groups={groupsList}
                        currentGroupId={groupIdByTeamId.get(t.id) ?? null}
                      />
                    )}
                    <form action={removeTeam.bind(null, competitionId, t.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Quitar a ${t.name} del torneo? Si ya tiene partidos asignados, se pierden.`}
                        className="text-xs panel-button-danger"
                      >
                        Quitar
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ),
    },
    {
      id: "grupos",
      label: "Grupos",
      badge: groupsList.length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-medium">Grupos</h2>
            <div className="flex flex-wrap gap-2">
              <ModalFormButton
                buttonLabel="+ Crear grupo vacío"
                buttonClassName="rounded-md panel-button-secondary px-3 py-2 text-sm whitespace-nowrap"
                title="Crear grupo vacío"
                description="Lo creás sin equipos y después los asignás uno por uno desde la pestaña Equipos."
                action={createGroupAction}
                submitLabel="Crear grupo"
              >
                <div>
                  <label className="block text-sm panel-label mb-1">Nombre del grupo</label>
                  <input
                    name="name"
                    placeholder="Grupo C"
                    required
                    className="w-full rounded-md panel-input px-3 py-2 text-sm"
                  />
                </div>
              </ModalFormButton>
              <ModalFormButton
                buttonLabel="🎲 Sortear equipos"
                buttonClassName="rounded-md panel-button-accent px-3 py-2 text-sm font-medium whitespace-nowrap"
                title="Sortear equipos en grupos"
                description="Reparte al azar en partes iguales a TODOS los equipos ya acreditados y homologados. Si ya había grupos armados, borra esas asignaciones y arranca de cero."
                action={randomDrawAction}
                submitLabel="Sortear"
                confirmMessage="Esto borra y vuelve a repartir TODAS las asignaciones de grupo actuales. ¿Continuar?"
              >
                <div>
                  <label className="block text-sm panel-label mb-1">¿En cuántos grupos?</label>
                  <input
                    name="num_groups"
                    type="number"
                    min={1}
                    defaultValue={2}
                    className="w-24 rounded-md panel-input px-3 py-2 text-sm"
                  />
                </div>
              </ModalFormButton>
            </div>
          </div>

          {groupsList.length === 0 ? (
            <p className="text-sm panel-label">
              Sin grupos todavía — creá uno vacío o sorteá los equipos con los botones de arriba.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {groupsList.map((g) => {
                const groupTeams = teamsByGroupId.get(g.id) ?? [];
                return (
                  <div key={g.id} className="panel-surface rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{g.name}</h3>
                      <span className="text-xs panel-label">
                        {groupTeams.length} equipo{groupTeams.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {groupTeams.length === 0 ? (
                      <p className="text-xs panel-label">Todavía no tiene equipos asignados.</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {groupTeams.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2">
                            <span>{t.name}</span>
                            {t.institution && <span className="text-xs panel-label">{t.institution}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {unassignedTeams.length > 0 && (
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-xs panel-label mb-1.5">
                Sin grupo asignado ({unassignedTeams.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unassignedTeams.map((t) => (
                  <span key={t.id} className="panel-chip text-xs rounded-full px-2 py-0.5">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      ),
    },
    {
      id: "participantes",
      label: "Participantes",
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div>
            <h2 className="font-medium">Participantes por grupo</h2>
            <p className="text-xs panel-label mt-0.5">
              Cantidad de personas presentes por grupo (cargado desde Acreditación) — útil para
              calcular medallas o premios.
            </p>
          </div>
          {groupsList.length === 0 ? (
            <p className="text-sm panel-label">Sin grupos todavía.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {groupsList.map((g) => {
                const groupTeams = teamsByGroupId.get(g.id) ?? [];
                const totalPeople = groupTeams.reduce((sum, t) => sum + peopleCount(t), 0);
                const missingCount = groupTeams.filter(
                  (t) => t.participants_present === null && t.member_count === null
                ).length;
                return (
                  <div key={g.id} className="panel-surface rounded-md p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{g.name}</h3>
                      <span className="text-xs panel-label">
                        {groupTeams.length} equipo{groupTeams.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-brand-teal-dark dark:text-brand-teal">
                      {totalPeople} <span className="text-sm font-normal panel-label">personas</span>
                    </p>
                    {missingCount > 0 && (
                      <p className="text-xs text-brand-orange">
                        {missingCount} equipo{missingCount === 1 ? "" : "s"} sin cargar cuántos se
                        presentaron
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-sm font-medium">Total del torneo</span>
            <span className="text-lg font-bold">
              {grandTotalPeople} personas · {(teams ?? []).length} equipos
            </span>
          </div>
        </section>
      ),
    },
  ];

  if (standingsByGroup.length > 0) {
    tabs.push({
      id: "posiciones",
      label: "Posiciones",
      content: (
        <section className="panel-card rounded-xl p-4 space-y-6">
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
      ),
    });
  }

  tabs.push({
    id: "partidos",
    label: "Partidos",
    badge: (groupMatches ?? []).length || undefined,
    content: (
      <section className="panel-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Partidos de fase de grupos</h2>
          {(groupMatches ?? []).length === 0 ? (
            <form action={startTournamentAction}>
              <button
                type="submit"
                className="text-sm rounded-md panel-button-primary font-medium px-4 py-2 whitespace-nowrap"
              >
                ▶️ Iniciar torneo
              </button>
            </form>
          ) : (
            <form action={restartTournamentAction}>
              <ConfirmSubmitButton
                confirmMessage="Esto borra TODOS los partidos y resultados de este torneo (grupos y cuadro) y vuelve a 'Armando'. Los equipos y grupos no se tocan. ¿Reiniciar?"
                className="text-xs rounded-md panel-button-danger px-3 py-1.5 whitespace-nowrap"
              >
                🔄 Reiniciar torneo
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
        <div className="space-y-2">
          {(groupMatches ?? []).length === 0 && (
            <p className="text-sm panel-label">
              Todavía no se generaron partidos. &ldquo;Iniciar torneo&rdquo; arma el
              todos-contra-todos de cada grupo y le asigna cancha y turno a cada partido
              automáticamente.
            </p>
          )}
          {(groupMatches ?? []).map((m: Match) => (
            <MatchRow
              key={m.id}
              match={m}
              teamAName={m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? "?" : "?"}
              teamBName={m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? "?" : "?"}
              courts={(courts ?? []) as Court[]}
              competitionDisciplineId={competition.discipline_id}
              disciplineNameById={disciplineNameById}
              allowDraws={competition.allow_draws}
              onSchedule={assignScheduleAction.bind(null, m.id)}
              onResult={submitResultAction.bind(null, m.id)}
            />
          ))}
        </div>
      </section>
    ),
  });

  if (competition.format_type === "single_elimination") {
    tabs.push({
      id: "cuadro",
      label: "Cuadro",
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Cuadro de eliminatoria simple</h2>
            {bracketDisplayMatches.length === 0 && (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md panel-button-accent px-3 py-1.5 font-medium"
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
      ),
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <RealtimeRefresh competitionId={competitionId} />

      <div>
        <Breadcrumbs
          items={[
            { label: "Eventos", href: "/admin" },
            { label: event?.name ?? "", href: event ? `/admin/eventos/${event.id}` : undefined },
            { label: `${discipline?.name} — ${category?.name}` },
          ]}
        />
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} aria-hidden="true" />
          <h1 className="text-lg font-semibold">
            {discipline?.name} — {category?.name}
          </h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[competition.status]}`}
          >
            {competitionStatusLabel[competition.status]}
          </span>
        </div>
      </div>

      <TabbedLayout items={tabs} />
    </div>
  );
}

function MatchRow({
  match,
  teamAName,
  teamBName,
  courts,
  competitionDisciplineId,
  disciplineNameById,
  allowDraws,
  onSchedule,
  onResult,
}: {
  match: Match;
  teamAName: string;
  teamBName: string;
  courts: Court[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  allowDraws: boolean;
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
          <span className="text-brand-orange font-medium"> · en curso</span>
        )}
      </div>

      {match.status !== "completed" && (
        <>
          {/* Cancha y turno se asignan solos al iniciar el torneo — esto es
              solo para pisar esa asignación a mano si hace falta (ej. una
              cancha se rompe a mitad de la jornada). */}
          <form action={onSchedule} className="flex items-center gap-1" title="Reasignar cancha/turno a mano">
            <select
              name="court_id"
              defaultValue={match.court_id ?? ""}
              className="rounded panel-input px-1.5 py-1 text-xs"
            >
              <option value="">Sin cancha</option>
              {courts.map((c) => {
                const otherDiscipline =
                  c.discipline_id && c.discipline_id !== competitionDisciplineId
                    ? disciplineNameById.get(c.discipline_id)
                    : null;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {otherDiscipline ? ` (⚠ ${otherDiscipline})` : ""}
                  </option>
                );
              })}
            </select>
            <input
              name="turno"
              type="number"
              placeholder="Turno"
              defaultValue={match.turno ?? ""}
              className="w-16 rounded panel-input px-1.5 py-1 text-xs"
            />
            <button type="submit" className="text-xs panel-label hover:opacity-80" title="Reasignar">
              Guardar
            </button>
          </form>

          <MatchResultForm
            action={onResult}
            teamAId={match.team_a_id}
            teamBId={match.team_b_id}
            teamAName={teamAName}
            teamBName={teamBName}
            allowDraws={allowDraws}
          />
        </>
      )}
    </div>
  );
}
