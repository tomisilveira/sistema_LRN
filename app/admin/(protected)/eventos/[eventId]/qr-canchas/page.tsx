import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/admin-auth";
import type { Court, Discipline, EventRow } from "@/lib/database.types";
import { disciplineColor } from "@/lib/discipline-colors";
import { courtDisplayName } from "@/lib/court-display";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { CourtQrSheet, type CourtQrItem } from "./court-qr-sheet";

/** Hoja para imprimir: un QR por cancha con el link del juez, 6 por A4
 * (2 × 3), para pegar en cada mesa de cancha. Solo admins del evento — el
 * link del juez es la credencial de la cancha (ver lib/judge-auth.ts). */
export default async function CourtQrPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: event }, allowed, { data: courts }, { data: disciplines }] = await Promise.all([
    supabase.from("events").select("id, name, event_date").eq("id", eventId).maybeSingle<Pick<EventRow, "id" | "name" | "event_date">>(),
    canManageEvent(supabase, eventId),
    supabase
      .from("courts")
      .select("id, name, access_token, discipline_id, sort_order")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("name"),
    supabase.from("disciplines").select("id, name, sort_order"),
  ]);
  if (!event || !allowed) notFound();

  const disciplineById = new Map((disciplines ?? []).map((d: Pick<Discipline, "id" | "name" | "sort_order">) => [d.id, d]));
  const items: CourtQrItem[] = ((courts ?? []) as Pick<Court, "id" | "name" | "access_token" | "discipline_id" | "sort_order">[])
    .map((c) => {
      const discipline = c.discipline_id ? disciplineById.get(c.discipline_id) : null;
      return {
        id: c.id,
        name: courtDisplayName(c.name, discipline),
        path: `/juez/${c.access_token}`,
        colors: disciplineColor(discipline),
        sortKey: discipline?.sort_order ?? 99,
      };
    })
    // Agrupadas por disciplina (mismo orden que el resto del panel), así
    // cada hoja junta las canchas de una misma zona.
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name, "es", { numeric: true }));

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { label: "Eventos", href: "/admin" },
            { label: event.name, href: `/admin/eventos/${eventId}?tab=canchas` },
            { label: "QR de canchas" },
          ]}
        />
      </div>
      <CourtQrSheet eventName={event.name} items={items} />
    </div>
  );
}
