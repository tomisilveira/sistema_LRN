import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Competition, EventRow, Group, GroupStandingRow, Match, Team } from "@/lib/database.types";
import { PublicRealtime } from "@/app/publico/[eventId]/[competitionId]/public-realtime";
import { PublicStandingsTable } from "@/app/publico/[eventId]/[competitionId]/public-standings-table";
import { PublicBracketView, type BracketDisplayMatch } from "@/app/publico/[eventId]/[competitionId]/public-bracket-view";

export const revalidate = 0;

type CompetitionWithNames = Competition & {
  disciplines: { name: string } | null;
  categories: { name: string } | null;
};

const LIVE_STATUSES = ["groups_in_progress", "bracket_in_progress"];

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  // Consulta anónima (sin login): `anon` solo tiene grant de columnas
  // puntuales sobre `events` (ver 0003_accreditation.sql) — pedir "*"
  // incluiría accreditation_token, sin grant, y la query entera falla con
  // "permission denied for table events".
  const EVENT_PUBLIC_COLUMNS = "id, name, event_date, status, created_at";

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
      .select("*, disciplines(name), categories(name)")
      .eq("event_id", activeEvent.id)
      .order("created_at");
    competitions = (data ?? []) as CompetitionWithNames[];
  }
  const liveCompetitions = competitions.filter((c) => LIVE_STATUSES.includes(c.status));
  const featured = liveCompetitions[0];

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

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-brand-teal" />
            <span className="w-2 h-2 rounded-full bg-brand-orange" />
            <span className="w-2 h-2 rounded-full bg-brand-pink" />
            <span className="w-2 h-2 rounded-full bg-brand-green" />
          </span>
          <span className="font-semibold">Liga Robótica Neuquina</span>
        </Link>
        <Link
          href="/admin/login"
          className="text-xs rounded-full border border-neutral-700 text-neutral-300 px-3 py-1.5 hover:border-brand-teal hover:text-brand-teal transition-colors"
        >
          Ingresar como administrador
        </Link>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {featured ? (
          <FeaturedCompetition event={activeEvent!} competition={featured} others={liveCompetitions.slice(1)} />
        ) : activeEvent ? (
          <ActiveEventNoLiveMatch event={activeEvent} competitions={competitions} />
        ) : (
          <UpcomingEvents events={upcomingEvents} />
        )}

        <p className="text-center text-xs text-neutral-600 mt-10">
          <Link href="/publico" className="hover:text-neutral-400 transition-colors">
            Ver todas las jornadas →
          </Link>
        </p>
      </div>
    </main>
  );
}

async function FeaturedCompetition({
  event,
  competition,
  others,
}: {
  event: EventRow;
  competition: CompetitionWithNames;
  others: CompetitionWithNames[];
}) {
  const supabase = await createServerSupabaseClient();

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

  return (
    <div className="space-y-8">
      <PublicRealtime competitionId={competition.id} />
      <div>
        <p className="text-xs text-brand-orange font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" aria-hidden="true" />
          En vivo · {event.name}
        </p>
        <h1 className="text-2xl font-bold mt-1">
          {competition.disciplines?.name} — {competition.categories?.name}
        </h1>
      </div>

      {standingsByGroup.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
            Tabla de posiciones
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            {standingsByGroup.map(({ group, rows }) => (
              <PublicStandingsTable key={group.id} groupName={group.name} rows={rows} />
            ))}
          </div>
        </section>
      )}

      {bracketDisplayMatches.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
            Cuadro eliminatorio
          </h2>
          <PublicBracketView matches={bracketDisplayMatches} />
        </section>
      )}

      {standingsByGroup.length === 0 && bracketDisplayMatches.length === 0 && (
        <p className="text-sm text-neutral-500">Todavía no hay grupos ni resultados cargados.</p>
      )}

      {others.length > 0 && (
        <section className="pt-4 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">También en vivo ahora</p>
          <div className="flex flex-wrap gap-2">
            {others.map((c) => (
              <Link
                key={c.id}
                href={`/publico/${event.id}/${c.id}`}
                className="text-sm rounded-full border border-neutral-800 px-3 py-1.5 hover:border-brand-teal hover:text-brand-teal transition-colors"
              >
                {c.disciplines?.name} — {c.categories?.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActiveEventNoLiveMatch({
  event,
  competitions,
}: {
  event: EventRow;
  competitions: CompetitionWithNames[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-brand-teal font-semibold uppercase tracking-wide">Jornada de hoy</p>
        <h1 className="text-2xl font-bold mt-1">{event.name}</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Todavía no hay ningún torneo en curso — arrancan en breve.
        </p>
      </div>
      <div className="space-y-2">
        {competitions.length === 0 && (
          <p className="text-sm text-neutral-500">Todavía no hay torneos cargados.</p>
        )}
        {competitions.map((c) => (
          <Link
            key={c.id}
            href={`/publico/${event.id}/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
          >
            <p className="font-medium">
              {c.disciplines?.name} — {c.categories?.name}
            </p>
            <span className="text-xs text-neutral-500">Ver →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function UpcomingEvents({ events }: { events: EventRow[] }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-8">
        <h1 className="text-2xl font-bold">Liga Robótica Neuquina</h1>
        <p className="text-neutral-400 text-sm">No hay ningún torneo en vivo en este momento.</p>
      </div>
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Próximas fechas</p>
        <div className="space-y-2">
          {events.length === 0 && (
            <p className="text-sm text-neutral-500">Todavía no hay jornadas programadas.</p>
          )}
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/publico/${ev.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors"
            >
              <p className="font-medium">{ev.name}</p>
              <span className="text-sm text-neutral-500">{ev.event_date}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
