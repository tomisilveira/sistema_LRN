import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Discipline } from "@/lib/database.types";
import { createDiscipline } from "../actions";
import { ModalFormButton } from "@/app/components/modal-form";
import { disciplineColor } from "@/lib/discipline-colors";

export default async function DisciplinasPage() {
  const supabase = await createServerSupabaseClient();
  const { data: disciplines } = await supabase.from("disciplines").select("*").order("sort_order");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Disciplinas</h1>
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
      <div className="flex flex-wrap gap-2 panel-enter-stagger">
        {(disciplines ?? []).length === 0 && (
          <p className="text-sm panel-label">Todavía no hay disciplinas cargadas.</p>
        )}
        {(disciplines ?? []).map((d: Discipline) => {
          const colors = disciplineColor(d);
          return (
            <span
              key={d.id}
              className={`inline-flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border-l-4 transition-colors hover:brightness-95 ${colors.border} ${colors.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
              {d.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
