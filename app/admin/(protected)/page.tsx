import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import { createEvent } from "./actions";

const statusLabel: Record<EventRow["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  finished: "Finalizado",
};

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <h1 className="text-lg font-semibold mb-4">Eventos</h1>
        <div className="space-y-2">
          {(events ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay eventos creados.</p>
          )}
          {(events ?? []).map((ev: EventRow) => (
            <Link
              key={ev.id}
              href={`/admin/eventos/${ev.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
            >
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-sm text-neutral-500">{ev.event_date}</p>
              </div>
              <span className="text-xs rounded-full px-2 py-1 bg-neutral-800 text-neutral-300">
                {statusLabel[ev.status]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 p-4">
        <h2 className="font-medium mb-3">Crear evento (jornada)</h2>
        <form action={createEvent} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-neutral-400 mb-1" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="Regional Confluencia"
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1" htmlFor="event_date">
              Fecha
            </label>
            <input
              id="event_date"
              name="event_date"
              type="date"
              required
              className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-100 text-neutral-900 font-medium px-4 py-2 text-sm hover:bg-white transition-colors"
          >
            Crear
          </button>
        </form>
      </section>
    </div>
  );
}
