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

  return (
    <div className="flex items-center justify-between rounded-lg bg-neutral-900 border border-brand-orange/30 px-4 py-3">
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-wide">En curso</p>
        <p className="text-2xl font-mono font-bold tabular-nums text-brand-orange">{formatElapsed(elapsed)}</p>
      </div>
      <button
        onClick={handleCancel}
        disabled={canceling}
        className="text-xs text-neutral-500 hover:text-neutral-300 underline"
      >
        Abrí mal, volver
      </button>
    </div>
  );
}
