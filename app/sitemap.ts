import type { MetadataRoute } from "next";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site-url";

// Se rearma una vez por hora como mucho: alcanza para que aparezca una
// jornada nueva y no le suma consultas a la base.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/publico`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Jornadas públicas (mismo filtro que /publico). Si la base no responde
  // (por ejemplo, durante un build sin red), el sitemap sale igual con las
  // páginas fijas en vez de romper el build.
  try {
    const { data: events } = await createPublicSupabaseClient()
      .from("events")
      .select("id, event_date, created_at")
      .eq("is_public", true)
      .order("event_date", { ascending: false });
    for (const ev of events ?? []) {
      pages.push({
        url: `${SITE_URL}/publico/${ev.id}`,
        lastModified: ev.event_date ?? ev.created_at ?? undefined,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error("sitemap: no se pudieron leer las jornadas", e instanceof Error ? e.message : e);
  }

  return pages;
}
