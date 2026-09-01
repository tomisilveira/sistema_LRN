import type { Team } from "@/lib/database.types";
import type { DisciplineColorSet } from "@/lib/discipline-colors";
import { TeamLabel } from "@/app/components/team-label";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { parseRobotNames } from "@/lib/team-display";
import { TeamAccreditationControls } from "./team-accreditation-controls";
import { GroupAssignSelect } from "./group-assign-select";
import { MoveTeamSelect } from "./move-team-select";
import { TeamSeedInput } from "./team-seed-input";
import { updateTeam, removeTeam } from "./actions";

/** Una ficha de equipo en la pestaña Equipos — rediseñada 2026-08-27, con
 * una segunda pasada de estilo el mismo día ("dale más estilo... que se vea
 * mucho más lindo"). Jerarquía: avatar con inicial en el color de la
 * disciplina (mismo `disciplineColor` que ya pinta canchas/chips de torneo
 * en el resto del panel — no un color nuevo inventado) + nombre + chip de
 * estado arriba, meta e integrantes al medio, selectores de ubicación +
 * Editar/Quitar abajo separados por un borde. El acento de color a la
 * izquierda de la tarjeta codifica el estado real (verde = listo, naranja =
 * falta) — no es decoración, es lo mismo que ya dice el chip pero
 * escaneable con la vista de reojo en una fila de gente esperando. */
export function TeamCard({
  competitionId,
  team,
  isFutbol,
  isBracketOnly,
  groups,
  currentGroupId,
  moveTargets,
  colors,
}: {
  competitionId: string;
  team: Team;
  isFutbol: boolean;
  isBracketOnly: boolean;
  groups: { id: string; name: string }[];
  currentGroupId: string | null;
  moveTargets: { id: string; label: string; crossDiscipline: boolean }[];
  colors: DisciplineColorSet;
}) {
  const ready = team.accredited && team.homologated;

  return (
    <div
      className={`panel-surface rounded-xl border-l-4 p-3.5 space-y-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-none ${
        ready ? "border-l-brand-green" : "border-l-brand-orange"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center border font-display font-semibold text-sm ${colors.border} ${colors.bg} ${colors.text}`}
          aria-hidden="true"
        >
          {team.name.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-base leading-tight truncate pt-0.5">
              <TeamLabel name={team.name} memberNames={team.member_names} />
            </p>
            <span
              className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${ready ? "panel-chip-success" : "panel-chip-warning"}`}
              title={ready ? undefined : "Un equipo no listo no puede entrar a ningún grupo"}
            >
              {ready
                ? "✅ Listo"
                : team.accredited
                  ? "⏳ Sin homologar"
                  : team.homologated
                    ? "⏳ Sin acreditar"
                    : "⏳ No listo"}
            </span>
          </div>
          {(team.institution || team.mentor_name) && (
            <p className="text-xs panel-label truncate mt-0.5" title={team.mentor_contact ?? undefined}>
              {team.institution}
              {team.institution && team.mentor_name && " · "}
              {team.mentor_name}
            </p>
          )}
        </div>
      </div>

      {team.robot_names && (
        <p className="text-[13px] panel-label opacity-90 pl-[42px] -mt-2.5">
          🤖 {parseRobotNames(team.robot_names).join(", ")}
        </p>
      )}

      <TeamAccreditationControls competitionId={competitionId} team={team} />

      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-neutral-200/70 dark:border-neutral-800">
        {isBracketOnly && <TeamSeedInput competitionId={competitionId} teamId={team.id} defaultValue={team.seed_order} />}
        {groups.length > 0 && ready && (
          <GroupAssignSelect competitionId={competitionId} teamId={team.id} groups={groups} currentGroupId={currentGroupId} />
        )}
        <MoveTeamSelect competitionId={competitionId} teamId={team.id} teamName={team.name} options={moveTargets} />
        <div className="ml-auto flex items-center gap-1.5">
          <ModalFormButton
            buttonLabel="Editar"
            buttonClassName="text-xs px-2 py-0.5 panel-button-xs"
            title={`Editar ${team.name}`}
            action={updateTeam.bind(null, competitionId, team.id)}
            submitLabel="Guardar"
          >
            <TeamFormFields
              isFutbol={isFutbol}
              defaults={{
                name: team.name,
                institution: team.institution ?? "",
                robots: parseRobotNames(team.robot_names),
                memberNames: team.member_names,
                notes: team.notes ?? "",
              }}
            />
          </ModalFormButton>
          <form action={removeTeam.bind(null, competitionId, team.id)}>
            <ConfirmSubmitButton
              confirmMessage={`¿Quitar a ${team.name} del torneo? Si ya tiene partidos asignados, se pierden.`}
              className="text-xs rounded-md px-2 py-0.5 panel-button-danger"
            >
              Quitar
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
