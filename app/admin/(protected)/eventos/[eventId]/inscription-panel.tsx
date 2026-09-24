import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionWithNames } from "@/lib/build-event-tab-items";
import { disciplineColor } from "@/lib/discipline-colors";
import { disciplineCategoryLabel } from "@/lib/discipline-display";
import { competitionStatusChipClass, competitionStatusLabel } from "@/lib/labels";
import { InscriptionLinkCard } from "./inscription-link-card";
import { RegistrationSwitch } from "./registration-switch";
import { setAllRegistrations } from "./actions";

/** Pestaña "Inscripción" del evento: el link único de inscripción (visible
 * siempre, no solo cuando hay algo abierto) y la llave abrir/cerrar de
 * cada torneo, todo en un lugar — antes había que entrar torneo por torneo.
 * La inscripción de un torneo se cierra sola al armar su fixture (ver
 * generateFixture en competencias/[competitionId]/actions.ts). */
export async function InscriptionPanel({
  supabase,
  eventId,
  competitions,
}: {
  supabase: SupabaseClient;
  eventId: string;
  competitions: CompetitionWithNames[];
}) {
  const ids = competitions.map((c) => c.id);
  const { data: teams } = ids.length
    ? await supabase.from("teams").select("competition_id").in("competition_id", ids)
    : { data: [] as { competition_id: string }[] };
  const teamCount = new Map<string, number>();
  for (const t of (teams ?? []) as { competition_id: string }[]) {
    teamCount.set(t.competition_id, (teamCount.get(t.competition_id) ?? 0) + 1);
  }

  const sorted = [...competitions].sort(
    (a, b) =>
      (a.disciplines?.sort_order ?? 99) - (b.disciplines?.sort_order ?? 99) ||
      disciplineCategoryLabel(a.disciplines, a.categories).localeCompare(disciplineCategoryLabel(b.disciplines, b.categories))
  );
  const openCount = competitions.filter((c) => c.registration_open).length;
  const openableCount = competitions.filter((c) => c.status === "setup" && !c.registration_open).length;

  return (
    <div className="space-y-4">
      <section className="panel-card rounded-xl p-4 space-y-3">
        <div>
          <h2 className="font-medium">Link de inscripción</h2>
          <p className="text-xs panel-label mt-0.5">
            Uno solo para todo el evento: el equipo elige ahí la disciplina y la categoría. Solo se ofrecen los
            torneos con la inscripción abierta.
          </p>
        </div>
        <InscriptionLinkCard path={`/inscripcion/${eventId}`} openCount={openCount} />
      </section>

      <section className="panel-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Torneos</h2>
            <p className="text-xs panel-label mt-0.5">
              Se cierra sola cuando armás el fixture del torneo.
            </p>
          </div>
          {competitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <form action={setAllRegistrations.bind(null, eventId, true)}>
                <button
                  type="submit"
                  disabled={openableCount === 0}
                  title="Abre los torneos que todavía no empezaron"
                  className="panel-action panel-action-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Abrir todos{openableCount > 0 ? ` (${openableCount})` : ""}
                </button>
              </form>
              <form action={setAllRegistrations.bind(null, eventId, false)}>
                <button
                  type="submit"
                  disabled={openCount === 0}
                  className="panel-action panel-action-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cerrar todos{openCount > 0 ? ` (${openCount})` : ""}
                </button>
              </form>
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm panel-label">Todavía no hay torneos en este evento. Crealos en la pestaña Torneos.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 -mx-1">
            {sorted.map((c) => {
              const colors = disciplineColor(c.disciplines);
              const label = disciplineCategoryLabel(c.disciplines, c.categories);
              const finished = c.status === "finished";
              const inProgress = c.status !== "setup" && !finished;
              const count = teamCount.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex items-center gap-3 px-1 py-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0 space-y-1">
                    <Link
                      href={`/admin/competencias/${c.id}`}
                      className="block text-sm font-medium leading-snug hover:text-brand-teal-dark hover:underline underline-offset-2"
                    >
                      {label}
                    </Link>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs panel-label">
                      <span className={`rounded-full px-2 py-px font-medium ${competitionStatusChipClass[c.status]}`}>
                        {competitionStatusLabel[c.status]}
                      </span>
                      <span className="tabular-nums">
                        {count} {count === 1 ? "equipo" : "equipos"}
                      </span>
                      {inProgress && c.registration_open && (
                        <span className="text-brand-orange">
                          · En curso: sumá los nuevos con &quot;Armar partidos que falten&quot;
                        </span>
                      )}
                    </span>
                  </span>
                  {finished ? (
                    <span className="text-xs panel-label text-right max-w-[9rem]">Terminado, no admite inscripciones</span>
                  ) : (
                    <RegistrationSwitch
                      eventId={eventId}
                      competitionId={c.id}
                      open={c.registration_open}
                      label={label}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
