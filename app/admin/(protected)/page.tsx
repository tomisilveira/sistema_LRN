import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/database.types";
import { createEvent } from "./actions";
import { ModalFormButton } from "@/app/components/modal-form";

const statusLabel: Record<EventRow["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  finished: "Finalizado",
};

const statusChipClass: Record<EventRow["status"], string> = {
  draft: "panel-chip",
  active: "panel-chip-success",
  finished: "panel-chip-brand",
};

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: events } = await supabase.from("events").select("*").order("event_date", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Eventos</h1>
          <ModalFormButton
            buttonLabel="+ Nuevo evento"
            buttonClassName="rounded-md panel-button-primary font-medium px-4 py-2 text-sm"
            title="Nuevo evento"
            description="Una jornada completa (puede tener varios torneos adentro)."
            action={createEvent}
          >
            <div>
              <label className="block text-sm panel-label mb-1" htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="Regional Confluencia"
                className="w-full rounded-md panel-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm panel-label mb-1" htmlFor="event_date">
                Fecha
              </label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                required
                className="w-full rounded-md panel-input px-3 py-2 text-sm"
              />
            </div>
          </ModalFormButton>
        </div>
        <div className="space-y-2 panel-enter-stagger">
          {(events ?? []).length === 0 && (
            <p className="text-sm panel-label">Todavía no hay eventos creados.</p>
          )}
          {(events ?? []).map((ev: EventRow) => (
            <Link
              key={ev.id}
              href={`/admin/eventos/${ev.id}`}
              className="panel-card-button group flex items-center justify-between gap-3 rounded-xl px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{ev.name}</p>
                <p className="text-sm panel-label">{ev.event_date}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!ev.is_public && (
                  <span
                    className="panel-chip-warning text-xs rounded-full px-2 py-1 font-medium"
                    title="No aparece en /publico ni en el inicio"
                  >
                    🔒 Privado
                  </span>
                )}
                <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusChipClass[ev.status]}`}>
                  {statusLabel[ev.status]}
                </span>
                <span
                  className="panel-label text-lg leading-none transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
