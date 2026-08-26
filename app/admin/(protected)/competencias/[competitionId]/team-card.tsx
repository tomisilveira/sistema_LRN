import type { Team } from "@/lib/database.types";
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

/** Una ficha de equipo en la pestaña Equipos — rediseñada 2026-08-27 (antes
 * todo el contenido iba en una sola fila apretada: nombre, acreditación,
 * grupo, mover y Editar/Quitar peleando por el mismo renglón). Ahora tiene
 * jerarquía clara: nombre + estado arriba (lo que se escanea de un
 * vistazo con la fila de acreditación esperando), meta debajo, controles de
 * acreditación al medio, y los selectores de ubicación (grupo/torneo) +
 * acciones destructivas abajo, separados por un borde — para que "dónde va
 * este equipo" y "borrarlo" no compitan visualmente con "está listo o no". */
export function TeamCard({
  competitionId,
  team,
  isFutbol,
  isBracketOnly,
  groups,
  currentGroupId,
  moveTargets,
}: {
  competitionId: string;
  team: Team;
  isFutbol: boolean;
  isBracketOnly: boolean;
  groups: { id: string; name: string }[];
  currentGroupId: string | null;
  moveTargets: { id: string; label: string; crossDiscipline: boolean }[];
}) {
  const ready = team.accredited && team.homologated;

  return (
    <div className="panel-surface rounded-lg p-3 space-y-2.5 transition-colors hover:border-brand-teal/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            <TeamLabel name={team.name} memberNames={team.member_names} />
          </p>
          {(team.institution || team.mentor_name) && (
            <p className="text-xs panel-label truncate" title={team.mentor_contact ?? undefined}>
              {team.institution}
              {team.institution && team.mentor_name && " · "}
              {team.mentor_name}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${ready ? "panel-chip-success" : "panel-chip-warning"}`}
        >
          {ready ? "✅ Listo" : "⏳ Falta"}
        </span>
      </div>

      {team.robot_names && (
        <p className="text-xs panel-label opacity-80 -mt-1.5">🤖 {parseRobotNames(team.robot_names).join(", ")}</p>
      )}

      <TeamAccreditationControls competitionId={competitionId} team={team} />

      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
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
                memberCount: team.member_count,
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
