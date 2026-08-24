import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatTeamWithMembers } from "@/lib/team-display";
import { cardsByTeam, formatCardSummary } from "@/lib/match-cards";
import type {
  Category,
  Court,
  Discipline,
  Group,
  GroupStandingRow,
  GroupTeam,
  Match,
  MatchCard,
  Team,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

type CompetitionRow = {
  id: string;
  discipline_id: string;
  category_id: string;
  format_type: string;
  status: string;
};

const formatLabel: Record<string, string> = {
  groups_only: "Solo fase de grupos",
  single_elimination: "Grupos + eliminatoria simple",
  gold_silver: "Grupos + oro/plata",
};

const statusLabel: Record<string, string> = {
  setup: "Armando",
  groups_in_progress: "Grupos en curso",
  groups_done: "Grupos cerrados",
  bracket_in_progress: "Eliminatoria en curso",
  finished: "Terminado",
};

/** Excel completo de un evento — equipos, partidos y posiciones de todos
 * sus torneos, para tener un solo archivo con todo cuando termina la
 * jornada. Solo accesible logueado como admin (mismo chequeo que el panel). */
export async function GET(_req: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Sin permisos de administrador." }, { status: 403 });
  }

  const { data: event } = await supabase.from("events").select("id, name, event_date").eq("id", eventId).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const [{ data: competitions }, { data: disciplines }, { data: categories }, { data: courts }] = await Promise.all([
    supabase.from("competitions").select("*").eq("event_id", eventId).order("created_at"),
    supabase.from("disciplines").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("courts").select("*").eq("event_id", eventId),
  ]);

  const disciplineById = new Map((disciplines ?? []).map((d: Discipline) => [d.id, d]));
  const categoryById = new Map((categories ?? []).map((c: Category) => [c.id, c]));
  const courtById = new Map((courts ?? []).map((c: Court) => [c.id, c]));
  const competitionList = (competitions ?? []) as CompetitionRow[];

  function competitionLabel(c: CompetitionRow) {
    return `${disciplineById.get(c.discipline_id)?.name ?? "?"} — ${categoryById.get(c.category_id)?.name ?? "?"}`;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Liga Robótica Neuquina";
  workbook.created = new Date();

  // ---- Resumen ----
  const resumen = workbook.addWorksheet("Resumen");
  resumen.columns = [
    { header: "Torneo", key: "torneo", width: 32 },
    { header: "Formato", key: "formato", width: 26 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Equipos", key: "equipos", width: 10 },
  ];
  resumen.getRow(1).font = { bold: true };
  resumen.insertRow(1, [`${event.name} — ${event.event_date}`]);
  resumen.mergeCells(1, 1, 1, 4);
  resumen.getRow(1).font = { bold: true, size: 14 };
  resumen.getRow(2).font = { bold: true };

  // ---- Equipos, Partidos, Posiciones ----
  const equipos = workbook.addWorksheet("Equipos");
  equipos.columns = [
    { header: "Torneo", key: "torneo", width: 32 },
    { header: "Equipo", key: "equipo", width: 26 },
    { header: "Integrantes", key: "integrantes", width: 32 },
    { header: "Institución", key: "institucion", width: 26 },
    { header: "Grupo", key: "grupo", width: 12 },
    { header: "Acreditado", key: "acreditado", width: 12 },
    { header: "Homologado", key: "homologado", width: 12 },
    { header: "Presentes", key: "presentes", width: 12 },
  ];
  equipos.getRow(1).font = { bold: true };

  const partidos = workbook.addWorksheet("Partidos");
  partidos.columns = [
    { header: "Torneo", key: "torneo", width: 32 },
    { header: "Fase", key: "fase", width: 10 },
    { header: "Grupo/Ronda", key: "grupoRonda", width: 14 },
    { header: "Equipo A", key: "equipoA", width: 24 },
    { header: "Equipo B", key: "equipoB", width: 24 },
    { header: "Marcador A", key: "marcadorA", width: 12 },
    { header: "Marcador B", key: "marcadorB", width: 12 },
    { header: "Ganador", key: "ganador", width: 24 },
    { header: "Cancha", key: "cancha", width: 16 },
    { header: "Turno", key: "turno", width: 8 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Tarjetas", key: "tarjetas", width: 28 },
  ];
  partidos.getRow(1).font = { bold: true };

  const posiciones = workbook.addWorksheet("Posiciones");
  posiciones.columns = [
    { header: "Torneo", key: "torneo", width: 32 },
    { header: "Grupo", key: "grupo", width: 14 },
    { header: "#", key: "pos", width: 6 },
    { header: "Equipo", key: "equipo", width: 26 },
    { header: "PJ", key: "pj", width: 6 },
    { header: "G", key: "g", width: 6 },
    { header: "E", key: "e", width: 6 },
    { header: "P", key: "p", width: 6 },
    { header: "DIF", key: "dif", width: 6 },
    { header: "Pts", key: "pts", width: 6 },
  ];
  posiciones.getRow(1).font = { bold: true };

  for (const competition of competitionList) {
    const label = competitionLabel(competition);

    const [{ data: teams }, { data: groups }, { data: groupTeams }, { data: matches }] = await Promise.all([
      supabase.from("teams").select("*").eq("competition_id", competition.id).order("name"),
      supabase.from("groups").select("*").eq("competition_id", competition.id).order("sort_order"),
      supabase
        .from("group_teams")
        .select("*, groups!inner(competition_id)")
        .eq("groups.competition_id", competition.id),
      supabase.from("matches").select("*").eq("competition_id", competition.id).order("turno"),
    ]);

    const matchIds = ((matches ?? []) as Match[]).map((m) => m.id);
    const { data: cardsData } = matchIds.length
      ? await supabase.from("match_cards").select("*").in("match_id", matchIds)
      : { data: [] as MatchCard[] };
    const cardsByMatchId = new Map<string, MatchCard[]>();
    for (const c of (cardsData ?? []) as MatchCard[]) {
      const list = cardsByMatchId.get(c.match_id) ?? [];
      list.push(c);
      cardsByMatchId.set(c.match_id, list);
    }

    const teamsList = (teams ?? []) as Team[];
    const groupsList = (groups ?? []) as Group[];
    const groupTeamsList = (groupTeams ?? []) as GroupTeam[];
    const groupNameByTeamId = new Map(
      groupTeamsList.map((gt) => [gt.team_id, groupsList.find((g) => g.id === gt.group_id)?.name ?? ""])
    );
    const teamNameById = new Map(
      teamsList.map((t) => [t.id, formatTeamWithMembers(t.name, t.member_names)])
    );

    resumen.addRow({
      torneo: label,
      formato: formatLabel[competition.format_type] ?? competition.format_type,
      estado: statusLabel[competition.status] ?? competition.status,
      equipos: teamsList.length,
    });

    for (const t of teamsList) {
      equipos.addRow({
        torneo: label,
        equipo: t.name,
        integrantes: (t.member_names ?? "").replace(/\n/g, ", "),
        institucion: t.institution ?? "",
        grupo: groupNameByTeamId.get(t.id) ?? "",
        acreditado: t.accredited ? "Sí" : "No",
        homologado: t.homologated ? "Sí" : "No",
        presentes: t.participants_present ?? t.member_count ?? "",
      });
    }

    for (const m of (matches ?? []) as Match[]) {
      const cards = cardsByMatchId.get(m.id) ?? [];
      const teamCards = cardsByTeam(cards, m.team_a_id, m.team_b_id);
      const cardParts = [
        teamCards.a && (teamCards.a.yellow > 0 || teamCards.a.red > 0)
          ? `${teamNameById.get(m.team_a_id ?? "") ?? "Equipo A"}: ${formatCardSummary(teamCards.a)}`
          : null,
        teamCards.b && (teamCards.b.yellow > 0 || teamCards.b.red > 0)
          ? `${teamNameById.get(m.team_b_id ?? "") ?? "Equipo B"}: ${formatCardSummary(teamCards.b)}`
          : null,
      ].filter((x): x is string => !!x);

      partidos.addRow({
        torneo: label,
        fase: m.phase === "group" ? "Grupos" : "Cuadro",
        grupoRonda: m.phase === "group" ? groupsList.find((g) => g.id === m.group_id)?.name ?? "" : m.round ?? "",
        equipoA: m.team_a_id ? teamNameById.get(m.team_a_id) ?? "?" : "Por definir",
        equipoB: m.team_b_id ? teamNameById.get(m.team_b_id) ?? "?" : "Por definir",
        marcadorA: m.score_a,
        marcadorB: m.score_b,
        ganador: m.winner_id ? teamNameById.get(m.winner_id) ?? "?" : m.status === "completed" ? "Empate" : "",
        cancha: m.court_id ? courtById.get(m.court_id)?.name ?? "" : "",
        turno: m.turno,
        estado: statusLabel[m.status] ?? m.status,
        tarjetas: cardParts.join(" · "),
      });
    }

    for (const g of groupsList) {
      try {
        const { data, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
        if (error) throw error;
        (data ?? []).forEach((row: GroupStandingRow, i: number) => {
          posiciones.addRow({
            torneo: label,
            grupo: g.name,
            pos: i + 1,
            equipo: formatTeamWithMembers(row.team_name, row.member_names),
            pj: row.played,
            g: row.won,
            e: row.drawn,
            p: row.lost,
            dif: row.score_diff,
            pts: row.points,
          });
        });
      } catch (err) {
        console.error(`get_group_standings falló para el grupo ${g.id} en export:`, err);
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = event.name.replace(/[^a-zA-Z0-9-_]+/g, "_");

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}_${event.event_date}.xlsx"`,
    },
  });
}
