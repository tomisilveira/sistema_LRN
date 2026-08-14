import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Discipline, EventRow } from "@/lib/database.types";
import { createEvent, createDiscipline } from "./actions";
import { ModalFormButton } from "@/app/components/modal-form";
import { disciplineColor } from "@/lib/discipline-colors";

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
  const [{ data: events }, { data: disciplines }] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { ascending: false }),
    supabase.from("disciplines").select("*").order("sort_order"),
  ]);

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
        <div className="space-y-2">
          {(events ?? []).length === 0 && (
            <p className="text-sm panel-label">Todavía no hay eventos creados.</p>
          )}
          {(events ?? []).map((ev: EventRow) => (
            <Link
              key={ev.id}
              href={`/admin/eventos/${ev.id}`}
              className="panel-link-card flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
            >
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-sm panel-label">{ev.event_date}</p>
              </div>
              <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusChipClass[ev.status]}`}>
                {statusLabel[ev.status]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Disciplinas</h2>
            <p className="text-sm panel-label">Se usan al crear torneos y para colorear canchas.</p>
          </div>
          <ModalFormButton
            buttonLabel="+ Nueva disciplina"
            buttonClassName="rounded-md panel-button-secondary px-4 py-2 text-sm"
            title="Nueva disciplina"
            action={createDiscipline}
          >
            <div>
              <label className="block text-sm panel-label mb-1" htmlFor="discipline-name">
                Nombre
              </label>
              <input
                id="discipline-name"
                name="name"
                required
                placeholder="Línea Seguidora"
                className="w-full rounded-md panel-input px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="allow_draws_default" type="checkbox" defaultChecked className="rounded" />
              Admite empates por defecto (se puede ajustar por torneo)
            </label>
          </ModalFormButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {(disciplines ?? []).length === 0 && (
            <p className="text-sm panel-label">Todavía no hay disciplinas cargadas.</p>
          )}
          {(disciplines ?? []).map((d: Discipline) => {
            const colors = disciplineColor(d);
            return (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border-l-4 ${colors.border} ${colors.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
                {d.name}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
