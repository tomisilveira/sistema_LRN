import type { PodiumBoard, PodiumEntry } from "@/lib/podium";

const MEDAL: Record<1 | 2 | 3, { emoji: string; label: string; ring: string; badge: string }> = {
  1: {
    emoji: "🥇",
    label: "1er puesto",
    ring: "border-brand-orange bg-brand-orange/[0.06]",
    badge: "bg-brand-orange text-neutral-900",
  },
  2: {
    emoji: "🥈",
    label: "2do puesto",
    ring: "border-neutral-400 bg-neutral-400/[0.06]",
    badge: "bg-neutral-400 text-neutral-900",
  },
  3: {
    emoji: "🥉",
    label: "3er puesto",
    ring: "border-[#c07d3f] bg-[#c07d3f]/[0.07]",
    badge: "bg-[#c07d3f] text-neutral-900",
  },
};

function PodiumCard({ entry }: { entry: PodiumEntry }) {
  const medal = MEDAL[entry.position];
  const isFirst = entry.position === 1;

  return (
    <div
      className={`rounded-2xl border-2 p-5 space-y-3 transition-transform ${medal.ring} ${
        isFirst ? "sm:scale-[1.03] shadow-lg" : "shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none" aria-hidden="true">
          {medal.emoji}
        </span>
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${medal.badge}`}>{medal.label}</span>
      </div>

      <div>
        <p className={`font-display font-bold leading-tight ${isFirst ? "text-2xl" : "text-xl"}`}>
          {entry.team.name}
        </p>
        {entry.team.institution && (
          <p className="text-sm panel-label mt-0.5">{entry.team.institution}</p>
        )}
      </div>

      <div className="pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
        <p className="text-sm panel-label">
          <span className="font-semibold text-brand-teal-dark dark:text-brand-teal text-lg">
            {entry.participantCount}
          </span>{" "}
          participante{entry.participantCount === 1 ? "" : "s"}
        </p>
        {entry.participantNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.participantNames.map((name, i) => (
              <span key={i} className="panel-chip text-[15px] rounded-full px-2.5 py-1 font-medium">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs panel-label mt-1.5">
            Sin nombres de integrantes cargados — completá el equipo en la pestaña Equipos.
          </p>
        )}
      </div>
    </div>
  );
}

function BoardBlock({ board }: { board: PodiumBoard }) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium">{board.label}</h3>
      {board.entries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 items-start panel-enter-stagger">
          {board.entries.map((entry, i) => (
            <PodiumCard key={`${entry.team.id}-${i}`} entry={entry} />
          ))}
        </div>
      )}
      {board.note && (
        <p className="text-sm panel-label panel-surface rounded-lg p-3">{board.note}</p>
      )}
      {board.entries.length === 0 && !board.note && (
        <p className="text-sm panel-label panel-surface rounded-lg p-3">
          Todavía no se puede definir el podio — faltan resultados de la fase final.
        </p>
      )}
    </div>
  );
}

export function PodiumPanel({ boards, finished }: { boards: PodiumBoard[]; finished: boolean }) {
  return (
    <section className="panel-card rounded-xl p-4 space-y-5">
      <div>
        <h2 className="font-medium">🏆 Ganadores</h2>
        <p className="text-xs panel-label mt-0.5">
          Los primeros puestos del torneo, con la cantidad de participantes y sus nombres — para la
          premiación.
        </p>
      </div>

      {!finished && (
        <p className="text-sm rounded-lg panel-chip-warning px-3 py-2">
          Vista previa — el torneo todavía no terminó, el podio puede cambiar.
        </p>
      )}

      {boards.map((board, i) => (
        <BoardBlock key={i} board={board} />
      ))}
    </section>
  );
}
