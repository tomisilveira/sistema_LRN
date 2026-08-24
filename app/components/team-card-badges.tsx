import type { TeamCardSummary } from "@/lib/match-cards";

/** Íconos de tarjetas de un equipo en un partido — hasta 2 🟨 (una 3ra
 * amarilla no suma ícono nuevo, ya está expulsado) + 🟥 si corresponde
 * (roja directa o doble amarilla, ver lib/match-cards.ts). No renderiza
 * nada si el equipo no tiene tarjetas. */
export function TeamCardBadges({
  summary,
  className = "",
}: {
  summary: TeamCardSummary | null | undefined;
  className?: string;
}) {
  if (!summary || (summary.yellow === 0 && summary.red === 0)) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}
      title={
        summary.redFromDoubleYellow
          ? "Expulsado por doble amarilla"
          : summary.red > 0
            ? "Tarjeta roja"
            : `${summary.yellow} amarilla${summary.yellow === 1 ? "" : "s"}`
      }
    >
      {Array.from({ length: Math.min(summary.yellow, 2) }).map((_, i) => (
        <span key={`y${i}`} aria-hidden="true">
          🟨
        </span>
      ))}
      {summary.red > 0 && <span aria-hidden="true">🟥</span>}
    </span>
  );
}
