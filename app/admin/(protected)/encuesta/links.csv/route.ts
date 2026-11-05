import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageEvent, getAdminContext } from "@/lib/admin-auth";
import { toCsv } from "@/lib/encuesta/stats";
import { parseMentorContact } from "@/lib/team-display";

export const dynamic = "force-dynamic";

type Row = {
  name: string;
  institution: string | null;
  locality: string | null;
  mentor_name: string | null;
  mentor_contact: string | null;
  encuesta_tokens: { token: string } | { token: string }[] | null;
  competition: { discipline: { name: string } | null; category: { name: string } | null } | null;
};

/** `mentor_contact` es "celular · email" (lib/team-input.ts). */
function mentorEmail(contact: string | null): string {
  return contact ? (parseMentorContact(contact).emails[0] ?? "") : "";
}

/** Links personalizados de la encuesta, uno por equipo del evento, para
 * combinar correspondencia desde la herramienta de mail (el sistema no manda
 * correos). Solo equipos que ya tienen token: antes hay que tocar "Generar
 * links" en /admin/encuesta. */
export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get("evento") ?? "";
  const supabase = await createServerSupabaseClient();
  if (!eventId || !(await canManageEvent(supabase, eventId))) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("teams")
    .select(
      "name, institution, locality, mentor_name, mentor_contact, encuesta_tokens(token), competition:competitions!inner(event_id, discipline:disciplines(name), category:categories(name))"
    )
    .eq("competition.event_id", eventId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = (process.env.SITE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  const rows = ((data ?? []) as unknown as Row[])
    .map((t) => {
      const tok = Array.isArray(t.encuesta_tokens) ? t.encuesta_tokens[0]?.token : t.encuesta_tokens?.token;
      return tok
        ? [
            t.name,
            t.competition?.discipline?.name ?? "",
            t.competition?.category?.name ?? "",
            t.institution ?? "",
            t.locality ?? "",
            t.mentor_name ?? "",
            mentorEmail(t.mentor_contact),
            `${base}/encuesta-satisfaccion?t=${tok}`,
          ]
        : null;
    })
    .filter((r): r is string[] => r !== null);

  const csv = toCsv(["equipo", "disciplina", "categoria", "institucion", "localidad", "mentor", "email_mentor", "link_encuesta"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="encuesta-links.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
