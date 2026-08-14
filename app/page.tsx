import Link from "next/link";
import Script from "next/script";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, EventRow, Group, GroupStandingRow, Match, Team } from "@/lib/database.types";
import { disciplineColor } from "@/lib/discipline-colors";
import { competitionStatusLabel, competitionStatusChipClass } from "@/lib/labels";
import { HomeThemeToggle } from "./home-theme-toggle";
import { HomeDisciplineMenu, type DisciplineTabItem } from "./home-discipline-menu";
import { HomeStandingsTable } from "./home-standings-table";
import { HomeBracketView, type BracketDisplayMatch } from "./home-bracket-view";
import { HomeRealtime } from "./home-realtime";

export const revalidate = 0;

// Consulta anónima (sin login): `anon` solo tiene grant de columnas
// puntuales sobre `events` (ver 0003_accreditation.sql) — pedir "*"
// incluiría accreditation_token, sin grant, y la query entera falla con
// "permission denied for table events".
const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, created_at";

type CompetitionWithNames = Competition & {
  disciplines: { name: string; sort_order: number } | null;
  categories: { name: string } | null;
};

const LIVE_STATUSES = ["groups_in_progress", "bracket_in_progress"];

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  // La jornada de hoy: como mucho un evento debería estar "activo" a la vez.
  const { data: activeEvents } = await supabase
    .from("events")
    .select(EVENT_PUBLIC_COLUMNS)
    .eq("status", "active")
    .order("event_date", { ascending: false })
    .limit(1);
  const activeEvent = (activeEvents ?? [])[0] as EventRow | undefined;

  let competitions: CompetitionWithNames[] = [];
  if (activeEvent) {
    const { data } = await supabase
      .from("competitions")
      .select("*, disciplines(name, sort_order), categories(name)")
      .eq("event_id", activeEvent.id)
      .order("created_at");
    competitions = (data ?? []) as CompetitionWithNames[];
  }

  let upcomingEvents: EventRow[] = [];
  if (!activeEvent) {
    const { data } = await supabase
      .from("events")
      .select(EVENT_PUBLIC_COLUMNS)
      .neq("status", "finished")
      .order("event_date", { ascending: true })
      .limit(5);
    upcomingEvents = (data ?? []) as EventRow[];
  }

  const tabItems = await Promise.all(competitions.map((c) => buildTabItem(supabase, c)));
  const liveIndex = tabItems.findIndex((t) => t.isLive);
  const defaultId = tabItems[liveIndex >= 0 ? liveIndex : 0]?.id;

  return (
    <div id="home-theme-root" className="panel-page min-h-screen" suppressHydrationWarning>
      {/* Arranca en claro; si el usuario ya había elegido oscuro, este script
          lo aplica antes del primer paint (mismo patrón que el toggle del
          admin, invertido: acá el default es claro). */}
      <Script id="home-theme-init" strategy="beforeInteractive">
        {"try{if(localStorage.getItem('lrn-public-theme')==='dark'){document.getElementById('home-theme-root').classList.add('dark');}}catch(e){}"}
      </Script>

      <header className="panel-nav border-b sticky top-0 z-20 panel-page">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex gap-1" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              <span className="w-2 h-2 rounded-full bg-brand-pink" />
              <span className="w-2 h-2 rounded-full bg-brand-green" />
            </span>
            <span className="font-semibold">Liga Robótica Neuquina</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link href="/publico" className="text-xs rounded-full panel-chip px-3 py-1.5 hover:opacity-80 transition-opacity whitespace-nowrap">
              Todos los eventos
            </Link>
            <HomeThemeToggle />
            <Link
              href="/admin/login"
              className="text-xs rounded-full panel-button-primary px-3 py-1.5 whitespace-nowrap transition"
            >
              Ingresar como administrador
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {activeEvent && tabItems.length > 0 ? (
          <div className="space-y-6">
            <HomeRealtime eventId={activeEvent.id} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark dark:text-brand-teal">
                Jornada de hoy
              </p>
              <h1 className="text-xl sm:text-2xl font-bold mt-0.5">{activeEvent.name}</h1>
              <p className="panel-label text-sm">{activeEvent.event_date}</p>
            </div>
            <HomeDisciplineMenu items={tabItems} defaultId={defaultId} />
          </div>
        ) : activeEvent ? (
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold">{activeEvent.name}</h1>
            <p className="panel-label text-sm">Todavía no hay torneos cargados en esta jornada.</p>
          </div>
        ) : (
          <UpcomingEvents events={upcomingEvents} />
        )}
      </main>
    </div>
  );
}

async function buildTabItem(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  competition: CompetitionWithNames
): Promise<DisciplineTabItem> {
  const [{ data: teams }, { data: groups }, { data: bracketMatches }] = await Promise.all([
    supabase.from("teams").select("*").eq("competition_id", competition.id),
    supabase.from("groups").select("*").eq("competition_id", competition.id).order("sort_order"),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", competition.id)
      .eq("phase", "bracket")
      .order("bracket_slot"),
  ]);

  const teamsById = new Map((teams ?? []).map((t: Team) => [t.id, t]));
  const groupsList = (groups ?? []) as Group[];

  const standingsByGroup = await Promise.all(
    groupsList.map(async (g) => {
      try {
        const { data, error } = await supabase.rpc("get_group_standings", { p_group_id: g.id });
        if (error) throw error;
        return { group: g, rows: (data ?? []) as GroupStandingRow[] };
      } catch (err) {
        console.error(`get_group_standings falló para el grupo ${g.id}:`, err);
        return { group: g, rows: [] as GroupStandingRow[] };
      }
    })
  );

  const bracketDisplayMatches: BracketDisplayMatch[] = (bracketMatches ?? []).map((m: Match) => ({
    ...m,
    team_a_name: m.team_a_id ? teamsById.get(m.team_a_id)?.name ?? null : null,
    team_b_name: m.team_b_id ? teamsById.get(m.team_b_id)?.name ?? null : null,
  }));

  const colors = disciplineColor(competition.disciplines);
  const isLive = LIVE_STATUSES.includes(competition.status);

  const content = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">
          {competition.disciplines?.name} — {competition.categories?.name}
        </h2>
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-medium ${competitionStatusChipClass[competition.status]}`}
        >
          {competitionStatusLabel[competition.status]}
        </span>
      </div>

      {standingsByGroup.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-semibold panel-label uppercase tracking-wide">
            Tabla de posiciones
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {standingsByGroup.map(({ group, rows }) => (
              <HomeStandingsTable key={group.id} groupName={group.name} rows={rows} />
            ))}
          </div>
        </section>
      )}

      {bracketDisplayMatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold panel-label uppercase tracking-wide">Cuadro eliminatorio</h3>
          <HomeBracketView matches={bracketDisplayMatches} />
        </section>
      )}

      {standingsByGroup.length === 0 && bracketDisplayMatches.length === 0 && (
        <p className="text-sm panel-label">Todavía no hay grupos ni resultados cargados.</p>
      )}
    </div>
  );

  return {
    id: competition.id,
    label: `${competition.disciplines?.name ?? "?"} — ${competition.categories?.name ?? "?"}`,
    dotClass: colors.dot,
    isLive,
    content,
  };
}

function UpcomingEvents({ events }: { events: EventRow[] }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-8">
        <h1 className="text-xl sm:text-2xl font-bold">Liga Robótica Neuquina</h1>
        <p className="panel-label text-sm">No hay ningún torneo en vivo en este momento.</p>
      </div>
      <div>
        <p className="text-xs panel-label uppercase tracking-wide mb-3">Próximas fechas</p>
        <div className="space-y-2">
          {events.length === 0 && (
            <p className="text-sm panel-label">Todavía no hay jornadas programadas.</p>
          )}
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/publico/${ev.id}`}
              className="panel-card flex items-center justify-between rounded-lg px-4 py-3 hover:brightness-95 dark:hover:brightness-125 transition"
            >
              <p className="font-medium">{ev.name}</p>
              <span className="text-sm panel-label">{ev.event_date}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
