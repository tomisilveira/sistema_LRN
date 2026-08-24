import type { CardType, MatchCard } from "./database.types";

export interface TeamCardSummary {
  yellow: number;
  /** Rojas propiamente cargadas + una roja "derivada" si hay 2+ amarillas
   * (ver `effectiveRed`) — para saber si mostrar el ícono 🟥. */
  red: number;
  /** true si la roja es por doble amarilla y no por una roja cargada
   * directamente — para poder aclararlo en el texto ("doble amarilla"). */
  redFromDoubleYellow: boolean;
}

/** Cuenta las tarjetas de un equipo en un partido y aplica "doble amarilla
 * = roja": si hay 2 o más amarillas, se muestra como expulsado (roja) aunque
 * nadie haya cargado una roja directamente. Las amarillas se siguen contando
 * todas (para el historial), la roja mostrada es 1 sola. */
export function summarizeTeamCards(cards: MatchCard[], teamId: string): TeamCardSummary {
  const teamCards = cards.filter((c) => c.team_id === teamId);
  const yellow = teamCards.filter((c) => c.card_type === "yellow").length;
  const directRed = teamCards.some((c) => c.card_type === "red");
  const redFromDoubleYellow = !directRed && yellow >= 2;
  return {
    yellow,
    red: directRed || redFromDoubleYellow ? 1 : 0,
    redFromDoubleYellow,
  };
}

export function cardsByTeam(cards: MatchCard[], teamAId: string | null, teamBId: string | null) {
  return {
    a: teamAId ? summarizeTeamCards(cards, teamAId) : null,
    b: teamBId ? summarizeTeamCards(cards, teamBId) : null,
  };
}

const CARD_EMOJI: Record<CardType, string> = { yellow: "🟨", red: "🟥" };

/** "🟨🟨" o "🟨🟨🟥" para un chip de texto plano (exports, alt) — en JSX
 * mejor usar TeamCardBadges (app/components/team-card-badges.tsx). */
export function formatCardSummary(summary: TeamCardSummary): string {
  const parts: string[] = [];
  if (summary.yellow > 0) parts.push(CARD_EMOJI.yellow.repeat(Math.min(summary.yellow, 2)));
  if (summary.red > 0) parts.push(CARD_EMOJI.red);
  return parts.join(" ");
}
