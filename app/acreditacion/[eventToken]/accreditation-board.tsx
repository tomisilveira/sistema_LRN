"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/database.types";
import { TeamCheckinRow } from "./team-checkin-row";

export interface AccreditationGroup {
  id: string;
  label: string;
  teams: Team[];
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
      <div className="flex flex-wrap items-center gap-3 sticky top-0 -mx-4 px-4 py-2 bg-neutral-950/95 backdrop-blur z-10">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar equipo o institución…"
          className="flex-1 min-w-[180px] rounded-md panel-input px-3 py-2 text-sm"
        />
        <span className="panel-chip text-xs whitespace-nowrap rounded-full px-2.5 py-1">
          {readyTeams}/{totalTeams} listos
        </span>
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm panel-label">
          {q ? `Sin resultados para "${query}".` : "Todavía no hay equipos inscriptos."}
        </p>
      )}

      {filteredGroups.map((g) => (
        <section key={g.id} className="panel-card rounded-xl p-3 space-y-2">
          <h2 className="text-sm font-semibold text-brand-teal uppercase tracking-wide">{g.label}</h2>
          <div className="space-y-2">
            {g.teams.map((t) => (
              <TeamCheckinRow key={t.id} eventToken={eventToken} team={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
