import { recommendFormat } from "@/lib/format-recommendation";

const formatLabel: Record<"groups_only" | "single_elimination", string> = {
  groups_only: "Solo fase de grupos",
  single_elimination: "Grupos + eliminatoria (estilo Copa del Mundo)",
};

export function FormatAdvisory({ teamCount, courtCount }: { teamCount: number; courtCount: number }) {
  const rec = recommendFormat(teamCount, courtCount);

  return (
    <div className="rounded-md panel-surface p-3 text-sm space-y-1.5">
      <p className="font-medium">
        Sugerencia: <span>{formatLabel[rec.recommended]}</span>
      </p>
      <ul className="text-xs panel-label space-y-0.5 list-disc list-inside">
        {rec.reasoning.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
