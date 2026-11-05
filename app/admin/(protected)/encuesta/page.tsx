import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext, listManageableEvents } from "@/lib/admin-auth";
import { applyFilters, loadEncuestaResponses, readFilters, type EnrichedResponse } from "@/lib/encuesta/load";
import { summarize, type Count } from "@/lib/encuesta/stats";
import { QUIEN_OPTIONS } from "@/lib/encuesta/questions";
import type { EventRow } from "@/lib/database.types";
import { GenerateLinksButton } from "./generate-links-button";

export const dynamic = "force-dynamic";

type EventOption = Pick<EventRow, "id" | "name" | "event_date">;

// Títulos cortos de cada pregunta para la vista admin (los textos completos
// están en lib/encuesta/questions.ts).
const CHOICE_TITLES: Record<string, string> = {
  quien_responde: "¿Quién responde?",
  primera_vez: "¿Primera vez?",
  conocia_anide: "¿Conocía a ANIDE?",
  sede_cercana: "¿Sabía de la sede cercana?",
  info_previa: "¿Tenía la info previa clara?",
  horas_total: "Horas en el evento",
  volveria_2027: "¿Vuelve en 2027?",
};
const MULTI_TITLES: Record<string, string> = {
  como_se_entero: "¿Cómo se enteró? (varias)",
  interes_propuestas: "Interés en propuestas de ANIDE (varias)",
};
const SCORE_TITLES: Record<string, string> = {
  experiencia: "Experiencia (1 Mal – 5 ¡Genial!)",
  puntaje_comodidad: "Comodidad para acompañar",
  puntaje_seguridad: "Seguridad y cuidado de los chicos",
  puntaje_esperas: "Tiempos de espera",
};
const TEXT_TITLES: Record<string, string> = {
  que_conto: "¿Qué te contó tu hijo/a a la vuelta?",
  momento_malo: "¿Hubo algún momento que no estuvo bueno?",
  cambiaria: "Si pudieras cambiar o sumar una sola cosa…",
  chico_mas_gusto: "Chicos: lo que más les gustó",
  chico_menos_gusto: "Chicos: lo que menos les gustó",
};

function Bars({ counts, total }: { counts: Count[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {counts.map((c) => {
        const pct = total ? Math.round((c.n / total) * 100) : 0;
        return (
          <li key={c.value} className="text-sm">
            <div className="flex justify-between gap-2">
              <span>{c.label}</span>
              <span className="tabular-nums panel-label">
                {c.n} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-200 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-orange" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel-card rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide panel-label">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs panel-label mt-0.5">{sub}</div>}
    </div>
  );
}

const fmt1 = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }));

function contextLabel(r: EnrichedResponse): string {
  if (!r.event_id) return "Sin link (respuesta anónima)";
  return [r.event_name, [r.discipline_name, r.category_name].filter(Boolean).join(" "), r.locality].filter(Boolean).join(" · ");
}

/** Resultados de la encuesta a familias (SPEC §8). Cualquier admin: el
 * superadmin ve todas las respuestas; un administrador de eventos, solo las
 * que llegaron por links de equipos de sus eventos (RLS de 0024). */
export default async function EncuestaAdminPage({ searchParams }: PageProps<"/admin/encuesta">) {
  const admin = await getAdminContext();
  if (!admin) notFound();
  const filters = readFilters(await searchParams);
  const supabase = await createServerSupabaseClient();

  const [{ events }, { data: disciplinesData }] = await Promise.all([
    listManageableEvents<EventOption>(supabase, "id, name, event_date"),
    supabase.from("disciplines").select("id, name").order("sort_order"),
  ]);
  const disciplines = (disciplinesData ?? []) as { id: string; name: string }[];

  let all: EnrichedResponse[] = [];
  let loadError: string | null = null;
  try {
    all = await loadEncuestaResponses(supabase);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error";
  }
  const rows = applyFilters(all, filters);
  const s = summarize(rows);
  const localities = [...new Set(all.map((r) => r.locality).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es"));

  // Panel de links: equipos y tokens del evento elegido.
  const linksEvent = filters.evento && filters.evento !== "sin" ? events.find((e) => e.id === filters.evento) : undefined;
  let linkCounts: { teams: number; tokens: number } | null = null;
  if (linksEvent && !loadError) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, encuesta_tokens(token), competition:competitions!inner(event_id)")
      .eq("competition.event_id", linksEvent.id);
    const list = (teams ?? []) as { encuesta_tokens: unknown }[];
    linkCounts = {
      teams: list.length,
      tokens: list.filter((t) => (Array.isArray(t.encuesta_tokens) ? t.encuesta_tokens.length > 0 : !!t.encuesta_tokens)).length,
    };
  }

  const qs = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();
  const nps = s.nps;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Encuesta a familias</h1>
          <p className="text-sm panel-label">
            Respuestas de{" "}
            <Link href="/encuesta-satisfaccion" className="underline" target="_blank">
              /encuesta-satisfaccion
            </Link>
            . {admin.isSuperadmin ? "Ves todas las respuestas." : "Ves las respuestas que llegaron por links de equipos de tus eventos."}
          </p>
        </div>
        <a
          href={`/admin/encuesta/respuestas.csv${qs ? `?${qs}` : ""}`}
          className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm shrink-0"
        >
          Exportar CSV
        </a>
      </div>

      {loadError && (
        <div className="panel-card rounded-xl p-4 text-sm" role="alert">
          No se pudieron leer las respuestas: {loadError}.{" "}
          {/schema cache|does not exist/i.test(loadError) && "Falta aplicar la migración supabase/migrations/0024_encuesta_satisfaccion.sql en el SQL Editor de Supabase."}
        </div>
      )}

      <form method="get" className="panel-card rounded-xl p-4 grid gap-3 sm:grid-cols-4 items-end">
        <label className="text-sm">
          <span className="block panel-label mb-1">Encuentro</span>
          <select name="evento" defaultValue={filters.evento ?? ""} className="w-full rounded-md panel-input px-2 py-2 text-sm">
            <option value="">Todos</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
            {admin.isSuperadmin && <option value="sin">Sin link (anónimas)</option>}
          </select>
        </label>
        <label className="text-sm">
          <span className="block panel-label mb-1">Disciplina</span>
          <select name="disciplina" defaultValue={filters.disciplina ?? ""} className="w-full rounded-md panel-input px-2 py-2 text-sm">
            <option value="">Todas</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block panel-label mb-1">Localidad</span>
          <select name="localidad" defaultValue={filters.localidad ?? ""} className="w-full rounded-md panel-input px-2 py-2 text-sm">
            <option value="">Todas</option>
            {localities.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">Filtrar</button>
          {qs && (
            <Link href="/admin/encuesta" className="rounded-md panel-button-secondary px-3 py-2 text-sm">Limpiar</Link>
          )}
        </div>
      </form>

      <section className="panel-card rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Links para el mail</h2>
        <p className="text-sm panel-label">
          Cada equipo inscripto tiene su propio link (token aleatorio), así la respuesta queda vinculada a su encuentro,
          disciplina, categoría y localidad sin preguntarlos. El sistema no manda mails: descargá el CSV y usalo para
          combinar correspondencia. Varias familias del mismo equipo pueden usar el mismo link: cada navegador cuenta como
          una respuesta aparte.
        </p>
        {linksEvent ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>{linksEvent.name}</strong>: {linkCounts?.tokens ?? 0} de {linkCounts?.teams ?? 0} equipos con link.
            </span>
            <GenerateLinksButton eventId={linksEvent.id} missing={(linkCounts?.teams ?? 0) - (linkCounts?.tokens ?? 0)} />
            {(linkCounts?.tokens ?? 0) > 0 && (
              <a href={`/admin/encuesta/links.csv?evento=${linksEvent.id}`} className="rounded-md panel-button-secondary px-3 py-2">
                Descargar links (CSV)
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm">Elegí un encuentro en el filtro de arriba para generar y descargar sus links.</p>
        )}
      </section>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Tile label="Respuestas" value={String(s.total)} sub={`${s.conToken} con link · ${s.mobile} desde celular`} />
        <Tile
          label="NPS"
          value={nps.nps == null ? "—" : String(nps.nps)}
          sub={nps.n ? `${nps.promotores} promotores · ${nps.pasivos} pasivos · ${nps.detractores} detractores` : "Sin respuestas"}
        />
        <Tile label="Experiencia" value={fmt1(s.scales.experiencia.avg)} sub={`promedio sobre 5 · ${s.scales.experiencia.n} resp.`} />
        <Tile label="Aceptan contacto" value={String(s.aceptanContacto)} sub="con mail para novedades" />
      </div>

      <section className="panel-card rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Puntajes promedio</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {Object.entries(SCORE_TITLES).map(([k, title]) => (
            <li key={k} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{title}</span>
                <span className="tabular-nums font-semibold">
                  {fmt1(s.scales[k].avg)} <span className="panel-label font-normal">({s.scales[k].n})</span>
                </span>
              </div>
              <Bars counts={s.scales[k].counts} total={s.scales[k].n} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Recomendación (0 a 10)</h2>
        <p className="text-sm panel-label">NPS = % de 9–10 menos % de 0–6. Promedio: {fmt1(s.scales.nps.avg)}.</p>
        <Bars counts={s.scales.nps.counts} total={s.scales.nps.n} />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(CHOICE_TITLES).map(([k, title]) => (
          <section key={k} className="panel-card rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-sm">
              {title} <span className="panel-label font-normal">({s.choices[k].answered})</span>
            </h2>
            <Bars counts={s.choices[k].counts} total={s.choices[k].answered} />
            {k === "quien_responde" && s.choices[k].counts.some((c) => c.value === QUIEN_OPTIONS[1][0] && c.n > 0) && (
              <p className="text-xs panel-label">Las respuestas de docentes por ahora usan el formulario de familias.</p>
            )}
          </section>
        ))}
        {Object.entries(MULTI_TITLES).map(([k, title]) => (
          <section key={k} className="panel-card rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-sm">
              {title} <span className="panel-label font-normal">({s.multis[k].answered})</span>
            </h2>
            <Bars counts={s.multis[k].counts} total={s.multis[k].answered} />
          </section>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Respuestas abiertas</h2>
        {Object.entries(TEXT_TITLES).map(([k, title]) => {
          const list = s.texts[k];
          const byId = new Map(rows.map((r) => [r.id, r]));
          return (
            <details key={k} className="panel-card rounded-xl p-4" open={list.length > 0 && list.length <= 5}>
              <summary className="cursor-pointer font-medium text-sm">
                {title} <span className="panel-label font-normal">({list.length})</span>
              </summary>
              {list.length === 0 ? (
                <p className="text-sm panel-label mt-2">Sin respuestas.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {list.map((t) => (
                    <li key={t.id} className="text-sm border-l-2 border-brand-orange/60 pl-3">
                      <p className="whitespace-pre-wrap break-words">{t.text}</p>
                      <p className="text-xs panel-label mt-0.5">
                        {contextLabel(byId.get(t.id)!)} · {new Date(t.created_at).toLocaleDateString("es-AR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </section>
    </div>
  );
}
