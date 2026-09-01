"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/database.types";
import type { DisciplineColorSet } from "@/lib/discipline-colors";
import { TeamCheckinRow } from "./team-checkin-row";
import { ModalFormButton } from "@/app/components/modal-form";
import { TeamFormFields } from "@/app/components/team-form-fields";
import { addTeam } from "./actions";

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

/** Tablero de acreditación con buscador — filtra equipos por nombre o
 * institución en todos los torneos del evento a la vez, para no tener que
 * scrollear buscando a mano con la fila de gente esperando. */
export function AccreditationBoard({
  eventToken,
  groups,
}: {
  eventToken: string;
  groups: AccreditationGroup[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        teams: g.teams.filter(
          (t) => t.name.toLowerCase().includes(q) || (t.institution ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.teams.length > 0);
  }, [groups, q]);

  const totalTeams = groups.reduce((sum, g) => sum + g.teams.length, 0);
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
            placeholder="Buscar equipo o institución…"
            className="w-full h-11 rounded-lg panel-input pl-10 pr-3 text-[15px]"
          />
        </div>
        <span className="shrink-0 font-display font-bold text-[13px] rounded-full px-3 py-2 panel-chip-success whitespace-nowrap">
          {readyTeams}/{totalTeams} listos
        </span>
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm panel-label px-1">
          {q ? `Sin resultados para "${query}".` : "Todavía no hay equipos inscriptos."}
        </p>
      )}

      {filteredGroups.map((g) => {
        const groupReady = g.teams.filter((t) => t.accredited && t.homologated).length;
        return (
          <section key={g.id} className="space-y-2.5 panel-enter">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${g.colors.dot}`} aria-hidden="true" />
              <h2 className={`text-[12.5px] font-bold uppercase tracking-wide ${g.colors.text}`}>{g.label}</h2>
              <span className="text-[11px] panel-label">
                {groupReady}/{g.teams.length} listos
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
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
