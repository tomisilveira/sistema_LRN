import type { Team } from "@/lib/database.types";
import type { DisciplineColorSet } from "@/lib/discipline-colors";
import { TeamLabel } from "@/app/components/team-label";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { parseRobotNames } from "@/lib/team-display";
import { formatLocation } from "@/lib/argentina-locations";
import { BuildingIcon, CheckIcon, MapPinIcon, TrashIcon, UserIcon } from "@/app/components/action-icons";
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

  const location = formatLocation(team.locality, team.province);
  const robots = parseRobotNames(team.robot_names);
  const statusLabel = ready
    ? "Listo"
    : team.accredited
      ? "Sin homologar"
      : team.homologated
        ? "Sin acreditar"
        : "No listo";

  return (
    <div
      className={`panel-card rounded-xl border-l-4 p-3.5 flex flex-col gap-3 transition-shadow duration-200 hover:shadow-md ${
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
          {/* Nombre completo + integrantes debajo (TeamLabel): antes el
              nombre se cortaba con "…" al compartir la fila con el chip. */}
          <p className="font-semibold text-base leading-snug break-words">
            <TeamLabel name={team.name} memberNames={team.member_names} />
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-semibold whitespace-nowrap ${
            ready ? "panel-chip-success" : "panel-chip-warning"
          }`}
          title={ready ? "Acreditado y homologado: puede entrar a un grupo" : "Un equipo no listo no puede entrar a ningún grupo"}
        >
          {ready ? (
            <CheckIcon className="w-3 h-3" strokeWidth={3} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
      </div>

      {(team.institution || location || team.mentor_name || robots.length > 0) && (
        <ul className="space-y-1 text-xs panel-label pl-[46px] -mt-1">
          {team.institution && (
            <li className="flex items-start gap-1.5">
              <BuildingIcon className="w-3.5 h-3.5 mt-px text-neutral-400" />
              <span className="leading-snug">{team.institution}</span>
            </li>
          )}
          {location && (
            <li className="flex items-start gap-1.5">
              <MapPinIcon className="w-3.5 h-3.5 mt-px text-neutral-400" />
              <span className="leading-snug">{location}</span>
            </li>
          )}
          {team.mentor_name && (
            <li className="flex items-start gap-1.5" title={team.mentor_contact ?? undefined}>
              <UserIcon className="w-3.5 h-3.5 mt-px text-neutral-400" />
              <span className="leading-snug">Responsable: {team.mentor_name}</span>
            </li>
          )}
          {robots.length > 0 && (
            <li className="flex items-start gap-1.5">
              <span className="w-3.5 text-center text-[11px] leading-4" aria-hidden="true">🤖</span>
              <span className="leading-snug">{robots.join(", ")}</span>
            </li>
          )}
        </ul>
      )}

      <TeamAccreditationControls competitionId={competitionId} team={team} />

      <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-auto border-t border-neutral-100">
        {isBracketOnly && <TeamSeedInput competitionId={competitionId} teamId={team.id} defaultValue={team.seed_order} />}
        {groups.length > 0 && ready && (
          <GroupAssignSelect competitionId={competitionId} teamId={team.id} groups={groups} currentGroupId={currentGroupId} />
        )}
        <MoveTeamSelect competitionId={competitionId} teamId={team.id} teamName={team.name} options={moveTargets} />
        <div className="ml-auto flex items-center gap-1.5">
          <ModalFormButton
            buttonLabel="Editar"
            buttonClassName="panel-action panel-action-sm"
            title={`Editar ${team.name}`}
            action={updateTeam.bind(null, competitionId, team.id)}
            submitLabel="Guardar"
          >
            <TeamFormFields
              isFutbol={isFutbol}
              defaults={{
                name: team.name,
                institution: team.institution ?? "",
                province: team.province,
                locality: team.locality,
                robots: parseRobotNames(team.robot_names),
                memberNames: team.member_names,
                notes: team.notes ?? "",
              }}
            />
          </ModalFormButton>
          <form action={removeTeam.bind(null, competitionId, team.id)}>
            <ConfirmSubmitButton
              confirmMessage={`¿Quitar a ${team.name} del torneo? Si ya tiene partidos asignados, se pierden.`}
              className="panel-action-danger panel-action-sm"
            >
              <TrashIcon />
              Quitar
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
