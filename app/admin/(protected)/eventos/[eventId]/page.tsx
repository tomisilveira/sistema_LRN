import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, Court, Discipline, Category, EventRow } from "@/lib/database.types";
import { addCourt, createCompetition, setEventStatusAction } from "./actions";
import { CopyLinkButton } from "./copy-link-button";

const formatLabel: Record<Competition["format_type"], string> = {
  groups_only: "Solo fase de grupos",
  single_elimination: "Grupos + eliminatoria simple",
  gold_silver: "Grupos + oro/plata (próximamente)",
};

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [{ data: courts }, { data: competitions }, { data: disciplines }, { data: categories }] =
    await Promise.all([
      supabase.from("courts").select("*").eq("event_id", eventId).order("sort_order"),
      supabase
        .from("competitions")
        .select("*, disciplines(name), categories(name)")
        .eq("event_id", eventId)
        .order("created_at"),
      supabase.from("disciplines").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

  const setStatus = setEventStatusAction.bind(null, eventId);
  const addCourtAction = addCourt.bind(null, eventId);
  const createCompetitionAction = createCompetition.bind(null, eventId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{event.name}</h1>
          <p className="text-sm text-neutral-500">{event.event_date}</p>
        </div>
        <form action={setStatus.bind(null, event.status === "active" ? "finished" : "active")}>
          <button
            type="submit"
            className="text-xs rounded-full px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 transition-colors"
          >
            {event.status === "active" ? "Marcar finalizado" : "Marcar activo"}
          </button>
        </form>
      </div>

      {/* Canchas */}
      <section className="rounded-lg border border-neutral-800 p-4 space-y-4">
        <h2 className="font-medium">Canchas</h2>
        <div className="space-y-2">
          {(courts ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay canchas cargadas.</p>
          )}
          {(courts ?? []).map((court: Court) => (
            <div
              key={court.id}
              className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-2"
            >
              <span className="text-sm">{court.name}</span>
              <CopyLinkButton path={`/juez/${court.access_token}`} />
            </div>
          ))}
        </div>
        <form action={addCourtAction} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Cancha 1"
            className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-100 text-neutral-900 font-medium px-4 py-2 text-sm hover:bg-white transition-colors"
          >
            Agregar
          </button>
        </form>
      </section>

      {/* Competencias */}
      <section className="rounded-lg border border-neutral-800 p-4 space-y-4">
        <h2 className="font-medium">Competencias (disciplina × categoría)</h2>
        <div className="space-y-2">
          {(competitions ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay competencias creadas.</p>
          )}
          {(competitions ?? []).map(
            (
              c: Competition & { disciplines: { name: string } | null; categories: { name: string } | null }
            ) => (
              <Link
                key={c.id}
                href={`/admin/competencias/${c.id}`}
                className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-2 hover:bg-neutral-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.disciplines?.name} — {c.categories?.name}
                  </p>
                  <p className="text-xs text-neutral-500">{formatLabel[c.format_type]}</p>
                </div>
                <span className="text-xs text-neutral-500">{c.status}</span>
              </Link>
            )
          )}
        </div>

        <form action={createCompetitionAction} className="space-y-3 border-t border-neutral-800 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Disciplina</label>
              <select
                name="discipline_id"
                required
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
              >
                {(disciplines ?? []).map((d: Discipline) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Categoría</label>
              <select
                name="category_id"
                required
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
              >
                {(categories ?? []).map((c: Category) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Formato</label>
            <select
              name="format_type"
              defaultValue="single_elimination"
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
            >
              <option value="groups_only">Solo fase de grupos (sin eliminatoria)</option>
              <option value="single_elimination">Grupos + eliminatoria simple</option>
            </select>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Pts. victoria</label>
              <input
                name="points_win"
                type="number"
                defaultValue={3}
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Pts. empate</label>
              <input
                name="points_draw"
                type="number"
                defaultValue={1}
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Pts. derrota</label>
              <input
                name="points_loss"
                type="number"
                defaultValue={0}
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Clasif./grupo</label>
              <input
                name="qualifiers_per_group"
                type="number"
                defaultValue={2}
                className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input name="allow_draws" type="checkbox" defaultChecked className="rounded" />
            Esta disciplina admite empates (desmarcar para sumo)
          </label>
          <button
            type="submit"
            className="rounded-md bg-neutral-100 text-neutral-900 font-medium px-4 py-2 text-sm hover:bg-white transition-colors"
          >
            Crear competencia
          </button>
        </form>
      </section>
    </div>
  );
}
