// Sugerencia (no vinculante) de formato de torneo según cantidad de
// inscriptos y canchas disponibles. El admin siempre puede elegir otra cosa
// — esto es solo una ayuda para decidir, no una regla dura.
export interface FormatRecommendation {
  recommended: "groups_only" | "single_elimination";
  reasoning: string[];
  suggestedNumGroups: number;
  estimatedGroupMatches: number;
  estimatedBracketMatches: number;
}

function roundRobinMatches(n: number): number {
  return n < 2 ? 0 : (n * (n - 1)) / 2;
}

export function recommendFormat(teamCount: number, courtCount: number): FormatRecommendation {
  if (teamCount < 2) {
    return {
      recommended: "groups_only",
      reasoning: ["Cargá al menos 2 equipos para poder sugerir un formato."],
      suggestedNumGroups: 1,
      estimatedGroupMatches: 0,
      estimatedBracketMatches: 0,
    };
  }

  // Apunta a ~4 equipos por grupo.
  const suggestedNumGroups = Math.max(1, Math.round(teamCount / 4));
  const baseSize = Math.floor(teamCount / suggestedNumGroups);
  const remainder = teamCount % suggestedNumGroups;
  let estimatedGroupMatches = 0;
  for (let i = 0; i < suggestedNumGroups; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    estimatedGroupMatches += roundRobinMatches(size);
  }

  const recommended: "groups_only" | "single_elimination" =
    teamCount <= 5 ? "groups_only" : "single_elimination";
  const qualifiers = suggestedNumGroups * 2;
  const estimatedBracketMatches = recommended === "single_elimination" ? Math.max(0, qualifiers - 1) : 0;

  const reasoning: string[] = [];
  if (recommended === "groups_only") {
    reasoning.push(
      `Con ${teamCount} equipos, un cuadro eliminatorio después de los grupos dejaría muy pocos partidos de eliminatoria — conviene que la fase de grupos defina todo el ranking.`
    );
  } else {
    reasoning.push(
      `Con ${teamCount} equipos alcanza para armar ${suggestedNumGroups} grupo(s) parejos y una llave eliminatoria después, estilo "Copa del Mundo".`
    );
  }
  reasoning.push(`Fase de grupos: ~${estimatedGroupMatches} partido(s) en total.`);
  if (estimatedBracketMatches > 0) {
    reasoning.push(`Cuadro eliminatorio: ~${estimatedBracketMatches} partido(s) más.`);
  }
  if (courtCount > 0) {
    const turns = Math.ceil(estimatedGroupMatches / courtCount);
    reasoning.push(
      `Con ${courtCount} cancha(s) disponible(s), la fase de grupos toma aproximadamente ${turns} turno(s) en simultáneo.`
    );
  }

  return { recommended, reasoning, suggestedNumGroups, estimatedGroupMatches, estimatedBracketMatches };
}
