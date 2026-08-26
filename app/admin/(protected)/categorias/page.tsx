import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/database.types";
import { createCategory, updateCategory, deleteCategory } from "./actions";
import { ModalFormButton } from "@/app/components/modal-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";

function CategoryFormFields({ defaults }: { defaults?: { name: string; minAge: number | null; maxAge: number | null } }) {
  return (
    <>
      <div>
        <label className="block text-sm panel-label mb-1" htmlFor="category-name">
          Nombre
        </label>
        <input
          id="category-name"
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder="Infantil"
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm panel-label mb-1" htmlFor="category-min-age">
            Edad mínima (opcional)
          </label>
          <input
            id="category-min-age"
            name="min_age"
            type="number"
            min={0}
            defaultValue={defaults?.minAge ?? undefined}
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm panel-label mb-1" htmlFor="category-max-age">
            Edad máxima (opcional)
          </label>
          <input
            id="category-max-age"
            name="max_age"
            type="number"
            min={0}
            defaultValue={defaults?.maxAge ?? undefined}
            className="w-full rounded-md panel-input px-3 py-2 text-sm"
          />
        </div>
      </div>
    </>
  );
}

export default async function CategoriasPage() {
  const supabase = await createServerSupabaseClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Categorías</h1>
          <p className="text-sm panel-label">
            Se usan al crear torneos (disciplina × categoría). Para unificar o dividir categorías sin
            recargar equipos: creá acá la(s) categoría(s) que falten, armá el torneo nuevo desde el evento, y
            moveé cada equipo desde la pestaña Equipos de su torneo actual (&quot;Mover a otro torneo&quot;) —
            no hace falta volver a cargar nada de los equipos.
          </p>
        </div>
        <ModalFormButton
          buttonLabel="+ Nueva categoría"
          buttonClassName="rounded-md panel-button-secondary px-4 py-2 text-sm shrink-0 whitespace-nowrap"
          title="Nueva categoría"
          action={createCategory}
        >
          <CategoryFormFields />
        </ModalFormButton>
      </div>

      <div className="space-y-2 panel-enter-stagger">
        {(categories ?? []).length === 0 && <p className="text-sm panel-label">Todavía no hay categorías cargadas.</p>}
        {(categories ?? []).map((c: Category) => (
          <div
            key={c.id}
            className="panel-surface flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{c.name}</p>
              <p className="text-xs panel-label">
                {c.min_age != null || c.max_age != null
                  ? `${c.min_age ?? "sin mínimo"}${c.max_age != null ? ` – ${c.max_age}` : "+"} años`
                  : "Sin franja etaria definida"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ModalFormButton
                buttonLabel="Editar"
                buttonClassName="text-xs rounded-md px-2.5 py-1 panel-button-secondary"
                title={`Editar ${c.name}`}
                action={updateCategory.bind(null, c.id)}
                submitLabel="Guardar"
              >
                <CategoryFormFields defaults={{ name: c.name, minAge: c.min_age, maxAge: c.max_age }} />
              </ModalFormButton>
              <form action={deleteCategory.bind(null, c.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`¿Borrar la categoría "${c.name}"? Solo se puede si ningún torneo la está usando.`}
                  className="text-xs rounded-md px-2.5 py-1 panel-button-danger"
                >
                  Borrar
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
