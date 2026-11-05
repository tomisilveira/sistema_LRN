import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-auth";
import { applyFilters, loadEncuestaResponses, readFilters } from "@/lib/encuesta/load";
import { toCsv } from "@/lib/encuesta/stats";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "created_at", "updated_at", "event_name", "discipline_name", "category_name", "locality", "team_name",
  "quien_responde", "experiencia", "experiencia_equipo", "que_conto", "primera_vez", "nps",
  "como_se_entero", "como_se_entero_otro", "conocia_anide", "sede_cercana",
  "info_previa", "acompanamiento_referente", "puntaje_comodidad", "puntaje_organizacion", "puntaje_seguridad", "puntaje_esperas", "horas_total", "momento_malo",
  "volveria_2027", "interes_propuestas", "acepta_contacto", "email_contacto", "cambiaria",
  "chico_mas_gusto", "chico_menos_gusto", "user_agent_tipo",
] as const;

/** CSV de respuestas con los mismos filtros que la pantalla. Solo admins;
 * la RLS limita las filas a lo que cada uno puede ver. */
export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  let rows;
  try {
    rows = applyFilters(await loadEncuestaResponses(supabase), readFilters(req.nextUrl.searchParams));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }

  const csv = toCsv([...COLUMNS], rows.map((r) => COLUMNS.map((c) => (r as Record<string, unknown>)[c])));
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="encuesta-familias_${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
