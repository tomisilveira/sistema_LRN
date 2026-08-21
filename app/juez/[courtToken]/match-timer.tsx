"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MatchTimer({
  startedAt,
  courtToken,
  matchId,
}: {
  startedAt: string;
  courtToken: string;
  matchId: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleCancel() {
    setCanceling(true);
    try {
      await fetch(`/api/matches/${matchId}/start`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtToken }),
      });
      router.refresh();
    } finally {
      setCanceling(false);
    }
  }

  const elapsed = now - new Date(startedAt).getTime();
  const elapsedMinutes = elapsed / 60000;
  // Puramente visual: el timer ya calculaba `elapsed`, esto solo elige el
  // color según cuánto pasó, para que la mesa de jueces note de un vistazo
  // un partido que se está estirando — no cambia el cálculo ni el negocio.
  const urgency =
    elapsedMinutes >= 5
      ? { border: "border-red-500/40", text: "text-red-500" }
      : elapsedMinutes >= 3
        ? { border: "border-brand-orange/40", text: "text-brand-orange" }
        : { border: "border-brand-teal/30", text: "text-brand-teal" };

  return (
    <div
      className={`flex items-center justify-between rounded-lg bg-neutral-900 border px-4 py-3 transition-colors duration-500 ${urgency.border}`}
    >
      <div>
        <p className="text-xs panel-label uppercase tracking-wide font-medium flex items-center gap-1.5">
          <span className="panel-live-dot" aria-hidden="true" />
          En curso
        </p>
        <p className={`text-2xl font-mono font-bold tabular-nums transition-colors duration-500 ${urgency.text}`}>
          {formatElapsed(elapsed)}
        </p>
      </div>
      <button
        onClick={handleCancel}
        disabled={canceling}
        className="text-xs panel-label hover:opacity-80 underline transition-opacity"
      >
        Abrí mal, volver
      </button>
    </div>
  );
}
