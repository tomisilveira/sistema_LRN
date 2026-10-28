"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/database.types";
import type { DisciplineColorSet } from "@/lib/discipline-colors";
import { TeamCheckinRow } from "./team-checkin-row";
import { ModalFormButton } from "@/app/components/modal-form";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { addTeam } from "./actions";
import { parseMemberNames } from "@/lib/team-display";

export interface AccreditationGroup {
  id: string;
  label: string;
  teams: Team[];
  isFutbol: boolean;
  /** Color de la disciplina (mismo sistema que canchas/torneos). */
  colors: DisciplineColorSet;
  /** Si este torneo ya arrancó (fixture armado), no se puede mover NADA
   * afuera de él — ver moveTeamToCompetition en ./actions.ts. */
  canMove: boolean;
  moveTargets: { id: string; label: string; crossDiscipline: boolean }[];
}

/** Personas inscriptas en un equipo: la cantidad declarada en la
 * inscripción y, si falta, cuántos nombres se cargaron. */
function inscribedPeople(t: Team): number {
  return t.member_count ?? parseMemberNames(t.member_names).length;
}

/** Minúsculas y sin tildes, para que "fermin" encuentre "Fermín". */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Todo lo buscable de un equipo en un solo texto: nombre, integrantes,
 * robots, institución, localidad/provincia, mentor y notas. */
function teamSearchText(t: Team): string {
  return normalize(
    [t.name, t.member_names, t.robot_names, t.institution, t.locality, t.province, t.mentor_name, t.mentor_contact, t.notes]
      .filter(Boolean)
      .join(" ")
  );
}

/** Tablero de acreditación con buscador — busca en todo (equipo,
 * participantes, robots, institución, localidad, mentor, notas y el nombre
 * del torneo) en todos los torneos del evento a la vez, para no tener que
 * scrollear buscando a mano con la fila de gente esperando. Con varias
 * palabras tienen que aparecer todas ("monsalve chos"). */
export function AccreditationBoard({
  eventToken,
  groups,
}: {
  eventToken: string;
  groups: AccreditationGroup[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  const filteredGroups = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean);
    if (words.length === 0) return groups;
    return groups
      .map((g) => {
        const label = normalize(g.label);
        return {
          ...g,
          teams: g.teams.filter((t) => {
            const text = `${label} ${teamSearchText(t)}`;
            return words.every((w) => text.includes(w));
          }),
        };
      })
      .filter((g) => g.teams.length > 0);
  }, [groups, q]);

  const totalTeams = groups.reduce((sum, g) => sum + g.teams.length, 0);
  const totalPeople = groups.reduce((sum, g) => sum + g.teams.reduce((s, t) => s + inscribedPeople(t), 0), 0);
  const foundTeams = filteredGroups.reduce((sum, g) => sum + g.teams.length, 0);
  const foundPeople = filteredGroups.reduce((sum, g) => sum + g.teams.reduce((s, t) => s + inscribedPeople(t), 0), 0);
  const readyTeams = groups.reduce(
    (sum, g) => sum + g.teams.filter((t) => t.accredited && t.homologated).length,
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 sticky top-0 -mx-4 px-4 py-2.5 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur z-10">
        <div className="relative flex-1 min-w-0">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar equipo, participante, robot, escuela…"
            className="w-full h-11 rounded-lg panel-input pl-10 pr-3 text-[15px]"
          />
        </div>
        <span className="shrink-0 font-display font-bold text-[13px] rounded-full px-3 py-2 panel-chip-success whitespace-nowrap">
          {readyTeams}/{totalTeams} listos
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 -mt-2">
        <div className="panel-card rounded-xl px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide panel-label">Equipos inscriptos</p>
          <p className="font-display font-bold text-2xl leading-tight">
            {q ? (
              <>
                {foundTeams}
                <span className="text-sm font-medium panel-label"> de {totalTeams}</span>
              </>
            ) : (
              totalTeams
            )}
          </p>
        </div>
        <div className="panel-card rounded-xl px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide panel-label">Personas inscriptas</p>
          <p className="font-display font-bold text-2xl leading-tight">
            {q ? (
              <>
                {foundPeople}
                <span className="text-sm font-medium panel-label"> de {totalPeople}</span>
              </>
            ) : (
              totalPeople
            )}
          </p>
        </div>
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm panel-label px-1">
          {q ? `Sin resultados para "${query}".` : "Todavía no hay equipos inscriptos."}
        </p>
      )}

      {filteredGroups.map((g) => {
        const groupReady = g.teams.filter((t) => t.accredited && t.homologated).length;
        const groupPeople = g.teams.reduce((sum, t) => sum + inscribedPeople(t), 0);
        return (
          <section key={g.id} className="space-y-2.5 panel-enter">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${g.colors.dot}`} aria-hidden="true" />
              <h2 className={`text-[12.5px] font-bold uppercase tracking-wide ${g.colors.text}`}>{g.label}</h2>
              <span className="text-[11px] panel-label">
                {groupReady}/{g.teams.length} listos · {groupPeople} {groupPeople === 1 ? "persona" : "personas"}
              </span>
              <ModalFormButton
                buttonLabel="+ Agregar equipo"
                buttonClassName={`ml-auto text-xs h-8 px-3 rounded-lg border font-medium whitespace-nowrap ${g.colors.border} ${g.colors.bg} ${g.colors.text}`}
                title={`Agregar equipo — ${g.label}`}
                description="Para un equipo que se presenta hoy sin haberse anotado antes."
                action={addTeam.bind(null, eventToken, g.id)}
                submitLabel="Agregar"
              >
                <TeamFormFields isFutbol={g.isFutbol} showMentor mentorRequired />
              </ModalFormButton>
            </div>
            <div className="space-y-2.5 panel-enter-stagger">
              {g.teams.map((t) => (
                <TeamCheckinRow
                  key={t.id}
                  eventToken={eventToken}
                  team={t}
                  isFutbol={g.isFutbol}
                  colors={g.colors}
                  moveTargets={g.canMove ? g.moveTargets : []}
                  competitionLabel={g.label}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
