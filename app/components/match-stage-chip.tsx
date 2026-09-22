import type { MatchStage } from "@/lib/match-stage";

const toneClass: Record<MatchStage["tone"], string> = {
  group: "panel-chip",
  bracket: "panel-chip-brand",
  third: "panel-chip-warning",
  final: "panel-chip-final",
};

const toneIcon: Record<MatchStage["tone"], string> = {
  group: "",
  bracket: "",
  third: "🥉 ",
  final: "🏆 ",
};

/** Chip con la instancia del partido (grupo / ronda del cuadro / 3er
 * puesto / final) — ver lib/match-stage.ts. */
export function MatchStageChip({
  stage,
  size = "sm",
  className = "",
}: {
  stage: MatchStage;
  size?: "xs" | "sm" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "lg" ? "text-base px-3 py-1" : size === "xs" ? "text-[10px] px-1.5 py-px" : "text-xs px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-display font-semibold uppercase tracking-wide whitespace-nowrap ${sizeClass} ${toneClass[stage.tone]} ${className}`}
    >
      {toneIcon[stage.tone]}
      {stage.label}
    </span>
  );
}
