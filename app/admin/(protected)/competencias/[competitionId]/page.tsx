import Link from "next/link";
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
  MatchCard,
  GroupStandingRow,
} from "@/lib/database.types";
import {
  addTeam,
  updateTeam,
  removeTeam,
  createGroup,
  randomDraw,
  startTournament,
  restartTournament,
  assignSchedule,
  submitResult,
  generateBracket,
  setRegistrationOpen,
  deleteCompetition,
} from "./actions";
import { GroupAssignSelect } from "./group-assign-select";
import { MoveTeamSelect } from "./move-team-select";
import { StandingsTable } from "./standings-table";
import { MatchResultForm } from "./match-result-form";
import { MatchScheduleForm } from "./match-schedule-form";
import { TeamAccreditationControls } from "./team-accreditation-controls";
import { BracketView, type BracketDisplayMatch } from "./bracket-view";
import { TeamSeedInput } from "./team-seed-input";
import { RealtimeRefresh } from "./realtime-refresh";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { TeamLabel } from "@/app/components/team-label";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { parseRobotNames } from "@/lib/team-display";
import { TeamCardBadges } from "@/app/components/team-card-badges";
import { cardsByTeam } from "@/lib/match-cards";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TabbedLayout, type TabItem } from "@/app/components/tabbed-layout";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ModalFormButton } from "@/app/components/modal-form";
import { competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineCategoryLabel, disciplineDisplayName } from "@/lib/discipline-display";
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

  const [{ data: courtsRaw }, { data: allDisciplines }, { data: siblingCompetitionsRaw }] = await Promise.all([
    supabase.from("courts").select("*").eq("event_id", event?.id ?? "").order("sort_order"),
    supabase.from("disciplines").select("id, name"),
    // Otros torneos del mismo evento — para poder saltar directo a otra
    // disciplina/categoría sin volver por Eventos > pestaña Torneos.
    supabase
      .from("competitions")
      .select("id, status, disciplines(name, sort_order), categories(name)")
      .eq("event_id", competition.event_id)
      .order("created_at"),
  ]);
  const allMatchIds = [...(groupMatches ?? []), ...(bracketMatches ?? [])].map((m: Match) => m.id);
  const { data: allCards } = allMatchIds.length
    ? await supabase.from("match_cards").select("*").in("match_id", allMatchIds)
    : { data: [] as MatchCard[] };
  const cardsByMatchId = new Map<string, MatchCard[]>();
  for (const c of (allCards ?? []) as MatchCard[]) {
    const list = cardsByMatchId.get(c.match_id) ?? [];
    list.push(c);
    cardsByMatchId.set(c.match_id, list);
  }

  const disciplineNameById = new Map(
    (allDisciplines ?? []).map((d: { id: string; name: string }) => [d.id, disciplineDisplayName(d.name)])
  );
  // Mismo criterio que registration-form.tsx: solo fútbol robótico arma el
  // equipo con más de un robot (2 titulares + suplente opcional).
  const isFutbol = discipline?.slug === "futbol";
  const siblingCompetitions = (siblingCompetitionsRaw ?? []) as unknown as (Pick<Competition, "id" | "status"> & {
    disciplines: { name: string; sort_order: number } | null;
    categories: { name: string } | null;
  })[];
  // Destinos válidos para "Mover a otro torneo" (ver move-team-select.tsx):
  // cualquier otro torneo del evento que todavía no arrancó — uno que ya
  // tiene fixture armado no tiene dónde meter un equipo nuevo. No se
  // restringe a la misma disciplina (pedido explícito: "quiero moverlos
  // individualmente entre torneos por si se anotan mal") — se marca la
  // opción cuando SÍ cambia de disciplina, porque ahí `robot_names` (solo
  // tiene sentido en fútbol) puede quedar de más o vacío del otro lado; el
  // admin lo completa/limpia a mano desde "Editar equipo" después de mover.
  const moveTargets = siblingCompetitions
    .filter((c) => c.id !== competitionId && c.status === "setup")
    .map((c) => ({
      id: c.id,
      label: disciplineCategoryLabel(c.disciplines, c.categories),
      crossDiscipline: c.disciplines?.name !== discipline?.name,
    }));
  // Torneos del evento que existen pero no sirven como destino porque ya
  // arrancaron (tienen fixture armado) — para explicar en la pestaña
  // Equipos por qué "Mover a otro torneo" no aparece o tiene menos
  // opciones de las esperadas, en vez de dejarlo en silencio.
  const blockedMoveSiblings = siblingCompetitions
    .filter((c) => c.id !== competitionId && c.status !== "setup")
    .map((c) => disciplineCategoryLabel(c.disciplines, c.categories));

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

  // Pedido explícito del usuario: el torneo solo puede arrancar una vez que
  // TODOS los equipos cargados están asignados a un grupo — antes se podía
  // iniciar con equipos sueltos, que quedaban afuera del fixture sin avisar.
  const startBlockedReason =
    (teams ?? []).length === 0
      ? "Cargá equipos antes de iniciar el torneo (pestaña Equipos)."
      : groupsList.length === 0
        ? "Creá los grupos y asigná los equipos antes de iniciar el torneo (pestaña Grupos)."
        : unassignedTeams.length > 0
          ? `Asigná ${unassignedTeams.length === 1 ? "el equipo que falta" : `los ${unassignedTeams.length} equipos que faltan`} a un grupo antes de iniciar el torneo (pestaña Grupos).`
          : null;

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
    team_a_member_names: m.team_a_id ? teamsById.get(m.team_a_id)?.member_names ?? null : null,
    team_b_member_names: m.team_b_id ? teamsById.get(m.team_b_id)?.member_names ?? null : null,
    cards: cardsByMatchId.get(m.id) ?? [],
  }));
  // 'single_elimination'/'groups_only'/'bracket_only' arman un único cuadro
  // sin tipo (bracket_type null); 'gold_silver' arma dos en paralelo.
  const plainMatches = bracketDisplayMatches.filter((m) => m.bracket_type === null);
  const goldMatches = bracketDisplayMatches.filter((m) => m.bracket_type === "gold");
  const silverMatches = bracketDisplayMatches.filter((m) => m.bracket_type === "silver");

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
        <div className="space-y-4">
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

          <section className="rounded-xl p-4 space-y-3 border border-red-500/30 bg-red-500/[0.03]">
            <h2 className="font-medium text-red-600 dark:text-red-400">Zona de peligro</h2>
            <p className="text-xs panel-label">
              Borra este torneo y todo lo que tiene adentro: equipos, grupos, partidos y resultados. No
              se puede deshacer.
            </p>
            <form action={deleteCompetition.bind(null, competitionId)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar el torneo "${disciplineCategoryLabel(discipline, category)}"? Se borran sus equipos, grupos y partidos. No se puede deshacer.`}
                className="text-sm rounded-md panel-button-danger px-4 py-2"
              >
                🗑️ Eliminar torneo
              </ConfirmSubmitButton>
            </form>
          </section>
        </div>
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
              <TeamFormFields isFutbol={isFutbol} />
            </ModalFormButton>
          </div>
          <p className="text-xs panel-label -mt-1">
            Acreditado y Homologado se pueden tildar acá mismo (queda igual que hacerlo desde el link de
            acreditación del evento).
          </p>
          {competition.status !== "setup" && siblingCompetitions.length > 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
              Para mover equipos de este torneo a otro (unificar/dividir categorías), primero hay que
              reiniciarlo — ya tiene fixture armado.
            </p>
          )}
          {competition.status === "setup" && moveTargets.length === 0 && blockedMoveSiblings.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
              &quot;Mover a otro torneo&quot; no tiene destino ahora — {blockedMoveSiblings.join(", ")} ya
              arrancó{blockedMoveSiblings.length > 1 ? "ron" : ""} (tiene fixture armado). Reiniciálo si
              necesitás mover equipos ahí.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-2 panel-enter-stagger">
            {(teams ?? []).map((t: Team) => {
              const ready = t.accredited && t.homologated;
              return (
                <div
                  key={t.id}
                  className="panel-surface flex items-start justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:border-brand-teal/40"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <TeamLabel name={t.name} memberNames={t.member_names} />
                    </p>
                    {t.institution && <p className="text-xs panel-label">{t.institution}</p>}
                    {t.robot_names && (
                      <p className="text-xs panel-label opacity-80">
                        🤖 {parseRobotNames(t.robot_names).join(", ")}
                      </p>
                    )}
                    {t.mentor_name && (
                      <p className="text-xs panel-label opacity-80">
                        {t.mentor_name} · {t.mentor_contact}
                      </p>
                    )}
                    <TeamAccreditationControls competitionId={competitionId} team={t} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {competition.format_type === "bracket_only" && (
                      <TeamSeedInput
                        competitionId={competitionId}
                        teamId={t.id}
                        defaultValue={t.seed_order}
                      />
                    )}
                    {groupsList.length > 0 && ready && (
                      <GroupAssignSelect
                        competitionId={competitionId}
                        teamId={t.id}
                        groups={groupsList}
                        currentGroupId={groupIdByTeamId.get(t.id) ?? null}
                      />
                    )}
                    {competition.status === "setup" && (
                      <MoveTeamSelect competitionId={competitionId} teamId={t.id} teamName={t.name} options={moveTargets} />
                    )}
                    <ModalFormButton
                      buttonLabel="Editar"
                      buttonClassName="text-xs rounded-md px-2 py-0.5 panel-button-secondary"
                      title={`Editar ${t.name}`}
                      action={updateTeam.bind(null, competitionId, t.id)}
                      submitLabel="Guardar"
                    >
                      <TeamFormFields
                        isFutbol={isFutbol}
                        defaults={{
                          name: t.name,
                          institution: t.institution ?? "",
                          robots: parseRobotNames(t.robot_names),
                          memberCount: t.member_count,
                          memberNames: t.member_names,
                          notes: t.notes ?? "",
                        }}
                      />
                    </ModalFormButton>
                    <form action={removeTeam.bind(null, competitionId, t.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Quitar a ${t.name} del torneo? Si ya tiene partidos asignados, se pierden.`}
                        className="text-xs rounded-md px-2 py-0.5 panel-button-danger"
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
  ];

  // El formato "solo cuadro" no tiene fase de grupos — sin Grupos,
  // Posiciones ni Participantes (que dependen de grupos), directo a Equipos
  // + Cuadro (ver más abajo).
  if (competition.format_type !== "bracket_only") {
    tabs.push(
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
            <>
              <p className="text-xs panel-label -mt-2">
                El selector de cada fila mueve al equipo a otro grupo (o lo saca) al toque, sin ir a la
                pestaña Equipos.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 panel-enter-stagger">
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
                        <ul className="text-sm space-y-1.5">
                          {groupTeams.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <TeamLabel name={t.name} memberNames={t.member_names} className="truncate" />
                                {t.institution && (
                                  <span className="text-xs panel-label ml-1">· {t.institution}</span>
                                )}
                              </div>
                              <GroupAssignSelect
                                competitionId={competitionId}
                                teamId={t.id}
                                groups={groupsList}
                                currentGroupId={g.id}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {unassignedTeams.length > 0 && (
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-xs panel-label mb-1.5">
                Sin grupo asignado ({unassignedTeams.length}) — elegí grupo para el que ya estén listos:
              </p>
              <div className="space-y-1.5">
                {unassignedTeams.map((t) => {
                  const ready = t.accredited && t.homologated;
                  return (
                    <div
                      key={t.id}
                      className="panel-surface flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm"
                    >
                      <TeamLabel name={t.name} memberNames={t.member_names} className="truncate" />
                      {groupsList.length > 0 && ready ? (
                        <GroupAssignSelect
                          competitionId={competitionId}
                          teamId={t.id}
                          groups={groupsList}
                          currentGroupId={null}
                        />
                      ) : (
                        <span
                          className="panel-chip-warning text-xs rounded-full px-2 py-0.5 shrink-0"
                          title="Falta acreditar y homologar a este equipo (pestaña Acreditación) antes de poder asignarlo a un grupo"
                        >
                          Falta acreditar
                        </span>
                      )}
                    </div>
                  );
                })}
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
            <div className="grid sm:grid-cols-2 gap-3 panel-enter-stagger">
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
    );
  }

  if (standingsByGroup.length > 0) {
    tabs.push({
      id: "posiciones",
      label: "Posiciones",
      content: (
        <section className="panel-card rounded-xl p-4 space-y-6">
          <div>
            <h2 className="font-medium">Tabla de posiciones</h2>
            <p className="text-xs panel-label mt-0.5">
              El orden se calcula solo por puntos y diferencia. La columna{" "}
              <span className="font-medium">Orden manual</span> es para forzar el puesto de un equipo a
              mano (ej. para resolver un desempate) — escribí el puesto y salí del campo para guardar;
              dejalo vacío para volver al orden automático.
            </p>
          </div>
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

  if (competition.format_type !== "bracket_only") {
    tabs.push({
    id: "partidos",
    label: "Partidos",
    badge: (groupMatches ?? []).length || undefined,
    content: (
      <section className="panel-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Partidos de fase de grupos</h2>
          {(groupMatches ?? []).length === 0 ? (
            startBlockedReason ? (
              <span
                className="text-xs rounded-md panel-chip-warning px-3 py-2 whitespace-nowrap"
                title={startBlockedReason}
              >
                🔒 Iniciar torneo
              </span>
            ) : (
              <form action={startTournamentAction}>
                <button
                  type="submit"
                  className="text-sm rounded-md panel-button-primary font-medium px-4 py-2 whitespace-nowrap"
                >
                  ▶️ Iniciar torneo
                </button>
              </form>
            )
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
        <div className="space-y-2 panel-enter-stagger">
          {(groupMatches ?? []).length === 0 && (
            <p className="text-sm panel-label">
              {startBlockedReason
                ? startBlockedReason
                : <>&ldquo;Iniciar torneo&rdquo; arma el todos-contra-todos de cada grupo y le asigna cancha y turno a cada partido automáticamente.</>}
            </p>
          )}
          {(groupMatches ?? []).map((m: Match) => (
            <MatchRow
              key={m.id}
              match={m}
              teamAName={m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? "?" : "?"}
              teamBName={m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? "?" : "?"}
              teamAMemberNames={m.team_a_id ? teamsById.get(m.team_a_id)?.member_names ?? null : null}
              teamBMemberNames={m.team_b_id ? teamsById.get(m.team_b_id)?.member_names ?? null : null}
              cards={cardsByMatchId.get(m.id) ?? []}
              courts={(courts ?? []) as Court[]}
              competitionDisciplineId={competition.discipline_id}
              disciplineNameById={disciplineNameById}
              allowDraws={competition.allow_draws}
              onSchedule={assignScheduleAction}
              onResult={submitResultAction.bind(null, m.id)}
            />
          ))}
        </div>
      </section>
    ),
    });
  }

  if (competition.format_type === "single_elimination") {
    tabs.push({
      id: "fase-final",
      label: "Fase Final",
      badge: plainMatches.length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Cuadro de eliminatoria simple</h2>
            {plainMatches.length === 0 ? (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md panel-button-accent px-3 py-1.5 font-medium whitespace-nowrap"
                  title="Normalmente no hace falta: se arma solo apenas se completa el último partido de grupos."
                >
                  Generar ahora
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
          {plainMatches.length === 0 ? (
            <p className="text-sm panel-label">
              Se arma solo, con los clasificados de cada grupo ({competition.qualifiers_per_group} por
              grupo), apenas se carga el resultado del último partido de la fase de grupos — no hace
              falta ningún paso manual. El botón de arriba es solo para forzarlo antes de tiempo si hiciera
              falta.
            </p>
          ) : (
            <BracketView competitionId={competitionId} matches={plainMatches} />
          )}
        </section>
      ),
    });
  }

  if (competition.format_type === "groups_only" && groupsList.length > 0) {
    tabs.push({
      id: "fase-final",
      label: "Fase Final",
      badge: plainMatches.length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Cuadro de eliminatoria (opcional)</h2>
            {plainMatches.length === 0 ? (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md panel-button-accent px-3 py-1.5 font-medium whitespace-nowrap"
                >
                  Generar fase final
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
          {plainMatches.length === 0 ? (
            <p className="text-sm panel-label">
              Este torneo es solo fase de grupos — no arma cuadro solo. Si después (o incluso antes de
              terminar los grupos) querés jugar una final entre los mejores de cada grupo, apretá
              &ldquo;Generar fase final&rdquo; ({competition.qualifiers_per_group} clasificados por
              grupo).
            </p>
          ) : (
            <BracketView competitionId={competitionId} matches={plainMatches} />
          )}
        </section>
      ),
    });
  }

  if (competition.format_type === "gold_silver") {
    tabs.push({
      id: "fase-final",
      label: "Fase Final",
      badge: goldMatches.length + silverMatches.length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Copa Oro / Copa Plata</h2>
            {goldMatches.length === 0 ? (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-xs rounded-md panel-button-accent px-3 py-1.5 font-medium whitespace-nowrap"
                  title="Normalmente no hace falta: se arman solos apenas se completa el último partido de grupos."
                >
                  Generar ahora
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
          {goldMatches.length === 0 ? (
            <p className="text-sm panel-label">
              Se arman solas apenas se completa la fase de grupos: copa oro con los clasificados de cada
              grupo ({competition.qualifiers_per_group} por grupo), copa plata con el resto de cada grupo.
              El botón de arriba es solo para forzarlo antes de tiempo si hiciera falta.
            </p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-brand-orange">🥇 Copa Oro</h3>
              <BracketView competitionId={competitionId} matches={goldMatches} />
            </div>
          )}
          {silverMatches.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-500">🥈 Copa Plata</h3>
              <BracketView competitionId={competitionId} matches={silverMatches} />
            </div>
          )}
        </section>
      ),
    });
  }

  if (competition.format_type === "bracket_only") {
    tabs.push({
      id: "cuadro",
      label: "Cuadro",
      badge: plainMatches.length || undefined,
      content: (
        <section className="panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Cuadro de eliminación</h2>
            {plainMatches.length === 0 ? (
              <form action={generateBracketAction}>
                <button
                  type="submit"
                  className="text-sm rounded-md panel-button-primary font-medium px-4 py-2 whitespace-nowrap"
                >
                  ▶️ Generar cuadro
                </button>
              </form>
            ) : (
              <form action={restartTournamentAction}>
                <ConfirmSubmitButton
                  confirmMessage="Esto borra el cuadro completo y todos sus resultados, y vuelve el torneo a 'Armando'. Los equipos no se tocan. ¿Reiniciar?"
                  className="text-xs rounded-md panel-button-danger px-3 py-1.5 whitespace-nowrap"
                >
                  🔄 Reiniciar cuadro
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
          {plainMatches.length === 0 ? (
            <p className="text-sm panel-label">
              {(teams ?? []).length < 2
                ? "Cargá al menos 2 equipos en la pestaña Equipos antes de generar el cuadro."
                : "Ordená la semilla de cada equipo en la pestaña Equipos (opcional — si no la tocás, se usa el orden en que los cargaste) y generá el cuadro cuando estén todos."}
            </p>
          ) : (
            <BracketView competitionId={competitionId} matches={plainMatches} />
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
            { label: disciplineCategoryLabel(discipline, category) },
          ]}
        />
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} aria-hidden="true" />
          <h1 className="text-lg font-semibold">
            {disciplineCategoryLabel(discipline, category)}
          </h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[competition.status]}`}
          >
            {competitionStatusLabel[competition.status]}
          </span>
        </div>

        {siblingCompetitions.length > 1 && (
          <nav aria-label="Otros torneos del evento" className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-xs panel-label mr-0.5">Cambiar de torneo:</span>
            {siblingCompetitions.map((c) => {
              const isCurrent = c.id === competitionId;
              const sColors = disciplineColor(c.disciplines);
              return (
                <Link
                  key={c.id}
                  href={`/admin/competencias/${c.id}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "panel-button-primary"
                      : "panel-chip hover:bg-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sColors.dot}`} aria-hidden="true" />
                  {disciplineCategoryLabel(c.disciplines, c.categories)}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <TabbedLayout
        items={tabs}
        sectionTitle={disciplineCategoryLabel(discipline, category)}
        sectionColorDot={colors.dot}
      />
    </div>
  );
}

function MatchRow({
  match,
  teamAName,
  teamBName,
  teamAMemberNames,
  teamBMemberNames,
  cards,
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
  teamAMemberNames: string | null;
  teamBMemberNames: string | null;
  cards: MatchCard[];
  courts: Court[];
  competitionDisciplineId: string;
  disciplineNameById: Map<string, string>;
  allowDraws: boolean;
  onSchedule: (matchId: string, formData: FormData) => Promise<void>;
  onResult: (formData: FormData) => Promise<void>;
}) {
  const courtName = match.court_id ? courts.find((c) => c.id === match.court_id)?.name : null;
  const teamCards = cardsByTeam(cards, match.team_a_id, match.team_b_id);

  return (
    <div
      className={`rounded-lg px-3 py-2.5 space-y-2.5 text-sm transition-colors ${
        match.status === "in_progress"
          ? "bg-brand-orange/5 border border-brand-orange/40"
          : "panel-surface hover:border-brand-teal/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-[180px]">
          <TeamLabel
            name={teamAName}
            memberNames={teamAMemberNames}
            className={match.winner_id === match.team_a_id ? "font-semibold" : ""}
          />{" "}
          <TeamCardBadges summary={teamCards.a} />
          {" vs "}
          <TeamLabel
            name={teamBName}
            memberNames={teamBMemberNames}
            className={match.winner_id === match.team_b_id ? "font-semibold" : ""}
          />{" "}
          <TeamCardBadges summary={teamCards.b} />
          {match.status === "completed" && match.score_a !== null && match.score_b !== null && (
            <span className="panel-label"> · {match.score_a}-{match.score_b}</span>
          )}
          {match.status === "in_progress" && (
            <span className="text-brand-orange font-medium inline-flex items-center gap-1">
              {" · "}
              <span className="panel-live-dot" aria-hidden="true" />
              en curso
            </span>
          )}
        </div>
        {match.status === "completed" ? (
          <span className="panel-chip-success text-xs rounded-full px-2 py-0.5 font-medium shrink-0">
            ✅ Jugado
          </span>
        ) : courtName ? (
          <span className="panel-chip text-xs rounded-full px-2 py-0.5 shrink-0">
            🏟 {courtName}
            {match.turno !== null ? ` · Turno ${match.turno}` : ""}
          </span>
        ) : (
          <span className="panel-chip-warning text-xs rounded-full px-2 py-0.5 shrink-0">
            Sin cancha asignada
          </span>
        )}
      </div>

      {match.status !== "completed" && (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          {/* Cancha y turno se asignan solos al iniciar el torneo — esto es
              solo para pisar esa asignación a mano si hace falta (ej. una
              cancha se rompe a mitad de la jornada). */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide panel-label shrink-0">Cancha/turno</span>
            <MatchScheduleForm
              matchId={match.id}
              courtId={match.court_id}
              turno={match.turno}
              courts={courts}
              competitionDisciplineId={competitionDisciplineId}
              disciplineNameById={disciplineNameById}
              onSchedule={onSchedule}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide panel-label shrink-0">Resultado</span>
            <MatchResultForm
              action={onResult}
              teamAId={match.team_a_id}
              teamBId={match.team_b_id}
              teamAName={teamAName}
              teamBName={teamBName}
              allowDraws={allowDraws}
            />
          </div>
        </div>
      )}
    </div>
  );
}
