import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Los buscadores indexan solo el sitio público (inicio, jornadas,
// privacidad). Todo lo demás es del día del evento o tiene un token en la
// URL: panel, kioscos (juez, acreditación), pantallas de TV, inscripción y
// encuesta. Esto NO es seguridad (robots.txt es público y los bots malos no
// lo respetan): la protección real es el login, los tokens y la RLS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/login",
        "/api/",
        "/juez/",
        "/acreditacion/",
        "/evento/",
        "/inscripcion/",
        "/encuesta-satisfaccion",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
