import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncuestaResponse } from "./stats";

// Carga de respuestas para la vista admin y el CSV, con los datos del
// equipo vinculado por el token (evento, disciplina, categoría, localidad).
// Se lee con el cliente de la SESIÓN del admin: la RLS de 0024 ya deja ver
// solo lo que corresponde (superadmin todo; event_admin, sus eventos).

export type Filters = { evento?: string; disciplina?: string; localidad?: string; quien?: string };

export type EnrichedResponse = EncuestaResponse & {
  event_id: string | null;
  event_name: string | null;
  discipline_id: string | null;
  discipline_name: string | null;
  category_name: string | null;
  team_name: string | null;
  locality: string | null;
};

type TeamJoin = {
  name: string;
  locality: string | null;
  competition: {
    event_id: string;
    discipline_id: string;
    event: { name: string } | null;
    discipline: { name: string } | null;
    category: { name: string } | null;
  } | null;
} | null;

export async function loadEncuestaResponses(supabase: SupabaseClient): Promise<EnrichedResponse[]> {
  const { data, error } = await supabase
    .from("encuesta_satisfaccion_familias")
    .select(
      "*, team:teams(name, locality, competition:competitions(event_id, discipline_id, event:events(name), discipline:disciplines(name), category:categories(name)))"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as (EncuestaResponse & { team: TeamJoin })[]).map(({ team, ...r }) => ({
    ...r,
    event_id: team?.competition?.event_id ?? null,
    event_name: team?.competition?.event?.name ?? null,
    discipline_id: team?.competition?.discipline_id ?? null,
    discipline_name: team?.competition?.discipline?.name ?? null,
    category_name: team?.competition?.category?.name ?? null,
    team_name: team?.name ?? null,
    locality: team?.locality ?? null,
  })) as EnrichedResponse[];
}

export function applyFilters(rows: EnrichedResponse[], f: Filters): EnrichedResponse[] {
  return rows.filter(
    (r) =>
      (!f.evento || (f.evento === "sin" ? r.event_id === null : r.event_id === f.evento)) &&
      (!f.disciplina || r.discipline_id === f.disciplina) &&
      (!f.localidad || r.locality === f.localidad) &&
      (!f.quien || r.quien_responde === f.quien)
  );
}

export function readFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): Filters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s ? s.slice(0, 200) : undefined;
  };
  return { evento: get("evento"), disciplina: get("disciplina"), localidad: get("localidad"), quien: get("quien") };
}
