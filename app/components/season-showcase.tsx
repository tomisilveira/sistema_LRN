import Link from "next/link";
import { METRICS, disciplineHex, growth, type EdicionesData } from "@/lib/ediciones";
import { BrandLockup } from "./brand-mark";
import { HeroFact } from "./season/hero-fact";
import { KpiCounters, type KpiItem } from "./season/kpi-counters";
import { EditionCompareChart, type CompareRow } from "./season/edition-compare-chart";
import { SeasonStage } from "./season/season-stage";
import { Reveal } from "./season/reveal";
import { HomeVideo } from "./season/home-video";

/** Portada cuando no hay ningún torneo en vivo (el resto del año, hasta la
 * próxima temporada): los números de la edición actual comparados con la
 * anterior, todos desde data/ediciones.json. Componente de servidor: solo
 * las piezas con animación o gráficos (carpeta ./season) son de cliente. */

const fmt = (n: number) => n.toLocaleString("es-AR");
const ACCENTS = ["#09aeb5", "#f99f1b", "#ec008c", "#5eb046", "#8b5cf6", "#2f6fdf", "#09aeb5"];

interface Upcoming {
  id: string;
  name: string;
  event_date: string;
}

export function SeasonShowcase({ data, upcoming }: { data: EdicionesData; upcoming: Upcoming[] }) {
  const { actual, anterior } = data;

  const facts = [
    { value: actual.participantes, label: "participantes en cancha" },
    { value: actual.robots, label: "robots compitiendo" },
    { value: actual.equipos, label: "equipos inscriptos" },
    { value: actual.partidos, label: "partidos jugados" },
    { value: actual.instituciones, label: "escuelas e instituciones" },
    { value: actual.localidades, label: "localidades representadas" },
    { value: actual.goles, label: "goles de fútbol robótico" },
  ].filter((f): f is { value: number; label: string } => typeof f.value === "number" && f.value > 0);

  // Primero las métricas que se pueden comparar con la edición anterior.
  const kpis: KpiItem[] = METRICS.filter((m) => actual[m.key] != null)
    .map((m) => ({ m, prev: anterior?.[m.key] ?? null }))
    .sort((a, b) => Number(b.prev !== null) - Number(a.prev !== null))
    .map(({ m, prev }, i) => ({
      label: m.label,
      note: m.note,
      value: actual[m.key]!,
      prev,
      growth: growth(prev, actual[m.key]),
      accent: ACCENTS[i % ACCENTS.length],
    }));

  // El titular de la comparación sale del mayor crecimiento disponible.
  const best = kpis.filter((k) => k.growth !== null).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];

  const compareRows: CompareRow[] = anterior
    ? [...new Set([...anterior.instancias, ...actual.instancias].map((i) => i.nombre))].map((nombre) => {
        const a = anterior.instancias.find((i) => i.nombre === nombre);
        const b = actual.instancias.find((i) => i.nombre === nombre);
        return {
          nombre,
          participantes: { [anterior.anio]: a?.participantes ?? null, [actual.anio]: b?.participantes ?? null },
          robots: { [anterior.anio]: a?.robots ?? null, [actual.anio]: b?.robots ?? null },
        };
      })
    : [];

  const ticker = [
    ...facts.map((f) => `${fmt(f.value)} ${f.label}`),
    ...actual.sedes.filter((s) => s.equipos).map((s) => `${s.nombre}: ${fmt(s.equipos!)} equipos`),
  ];

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Video de la temporada: arranca solo, en silencio (ver HomeVideo). */}
      <HomeVideo title={`Video de la Liga Robótica Neuquina ${actual.anio}`} />

      {/* Hero */}
      <section className="showcase-hero rounded-3xl px-6 py-10 sm:px-10 sm:py-14 shadow-xl">
        <div className="showcase-grid" aria-hidden="true" />
        <div className="showcase-blob showcase-blob-a h-64 w-64 -left-16 -top-20 bg-brand-teal" aria-hidden="true" />
        <div className="showcase-blob showcase-blob-b h-72 w-72 -right-20 top-10 bg-brand-pink" aria-hidden="true" />
        <div className="showcase-blob showcase-blob-c h-56 w-56 left-1/3 -bottom-24 bg-brand-orange" aria-hidden="true" />
        <div className="relative flex flex-col items-center text-center gap-5">
          <h1 className="sr-only">Liga Robótica Neuquina — temporada {actual.anio} en números</h1>
          <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
            <BrandLockup className="h-9 sm:h-10 w-auto" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
            Temporada {actual.anio}
            {actual.encuentros ? ` · ${actual.encuentros} encuentros` : ""}
          </span>
          <HeroFact facts={facts} />
          <p className="text-sm sm:text-base text-white/75 max-w-md">
            Gracias a cada escuela, familia y equipo. <strong className="text-white">Nos vemos en {actual.anio + 1}.</strong>
          </p>
        </div>
      </section>

      {/* Cinta */}
      {ticker.length > 0 && (
        <div className="showcase-marquee panel-card -mt-4 sm:-mt-8 rounded-2xl border py-3 overflow-hidden">
          <div className="showcase-marquee-track">
            {[false, true].map((hidden) =>
              ticker.map((t, k) => (
                <span key={`${hidden}-${k}`} className="flex items-center gap-3 px-5 whitespace-nowrap" aria-hidden={hidden || undefined}>
                  <span className="h-2 w-2 rounded-full" style={{ background: ACCENTS[k % 5] }} aria-hidden="true" />
                  <span className="text-sm font-bold">{t}</span>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* Edición anterior vs actual */}
      <section className="space-y-5">
        <Reveal>
          <SectionHead
            eyebrow={anterior ? `Edición ${anterior.anio} → ${actual.anio}` : `Edición ${actual.anio}`}
            title={best ? `${best.label}: ${best.growth! >= 0 ? "+" : ""}${best.growth}% en un año` : `La temporada ${actual.anio} en números`}
            lead={
              anterior
                ? `Lo que dejó ${actual.anio} al lado de ${anterior.anio}. Los datos de ${anterior.anio} salen del informe de esa edición.`
                : undefined
            }
          />
        </Reveal>
        <Reveal delay={0.05}>
          <KpiCounters items={kpis} prevYear={anterior?.anio ?? null} />
        </Reveal>
        {compareRows.length > 0 && anterior && (
          <Reveal delay={0.1}>
            <div className="panel-card rounded-3xl border p-5 sm:p-7 space-y-1">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal-dark dark:text-brand-teal">Regionales y final</p>
              <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Cada instancia, {anterior.anio} contra {actual.anio}</h3>
              <div className="pt-3">
                <EditionCompareChart rows={compareRows} years={[anterior.anio, actual.anio]} />
              </div>
            </div>
          </Reveal>
        )}
      </section>

      {/* La temporada actual por dentro */}
      <section className="space-y-5">
        <Reveal>
          <SectionHead eyebrow={`Temporada ${actual.anio}`} title="Fecha por fecha, disciplina por disciplina" />
        </Reveal>
        <Reveal delay={0.05}>
          <SeasonStage
            data={{
              year: actual.anio,
              sedes: actual.sedes
                .filter((s) => s.participantes != null)
                .map((s) => ({ nombre: s.nombre, participantes: s.participantes!, equipos: s.equipos ?? 0 })),
              disciplinas: actual.disciplinas.map((d) => ({ ...d, hex: disciplineHex(d.nombre) })),
              localidades: actual.localidadesTop,
            }}
          />
        </Reveal>
      </section>

      <Reveal>
        <UpcomingBlock upcoming={upcoming} nextYear={actual.anio + 1} />
      </Reveal>
    </div>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
      <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.05] text-balance">{title}</h2>
      {lead && <p className="panel-label max-w-2xl">{lead}</p>}
    </div>
  );
}

function UpcomingBlock({ upcoming, nextYear }: { upcoming: Upcoming[]; nextYear: number }) {
  if (upcoming.length === 0) {
    return (
      <div className="panel-card rounded-3xl border px-5 py-8 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-pink">Próxima temporada</p>
        <p className="font-heading mt-2 text-2xl font-extrabold">Se viene la Liga Robótica Neuquina {nextYear}</p>
        <p className="mt-1 text-sm panel-label">Las fechas se publican acá apenas estén confirmadas.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] panel-label mb-3">Próximas fechas</p>
      <div className="space-y-2">
        {upcoming.map((ev) => (
          <Link key={ev.id} href={`/publico/${ev.id}`} className="panel-card-button group flex items-center justify-between gap-3 rounded-xl px-4 py-3.5">
            <p className="font-semibold truncate">{ev.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm panel-label">{ev.event_date}</span>
              <span className="panel-label text-lg leading-none transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
