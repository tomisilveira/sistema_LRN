"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartMatchButton({ courtToken, matchId }: { courtToken: string; matchId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo iniciar el partido.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá el wifi e intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm panel-label">Cuando los dos equipos estén listos en la cancha:</p>
      {error && <p className="text-sm text-red-400 panel-enter">{error}</p>}
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full rounded-md panel-button-accent font-semibold py-3 disabled:opacity-50"
      >
        {loading ? "Abriendo..." : "Iniciar partido"}
      </button>
    </div>
  );
}
