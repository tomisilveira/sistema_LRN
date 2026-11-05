"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, takeRateLimit } from "@/lib/rate-limit";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { TOKEN_RE, userAgentTipo, validateEncuesta } from "@/lib/encuesta/validate";

export type SaveEncuestaResult = { ok: true } | { ok: false; error: string };

// 20 envíos cada 10 minutos por IP: una escuela o un evento con wifi
// compartido (misma IP para muchas familias) entra holgado; un script no.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Server Action pública (sin sesión): guarda o actualiza la respuesta del
// navegador `respondent_id`. Escribe con service_role (anon no tiene grants
// sobre la tabla), así que TODO se valida acá: valores permitidos, rangos,
// 2000 caracteres por texto y mail solo con consentimiento
// (lib/encuesta/validate.ts; la base además tiene CHECKs). El token, si
// viene y existe, vincula la respuesta al equipo; uno inválido o
// desconocido no frena el envío, se guarda sin vínculo.
//
// Devuelve el error en vez de tirarlo (en producción Next reemplaza el
// texto de los errores tirados por uno genérico en inglés).
export async function saveEncuesta(payload: unknown): Promise<SaveEncuestaResult> {
  try {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p[HONEYPOT_FIELD] === "string" && p[HONEYPOT_FIELD] !== "") return { ok: true };

    if (!takeRateLimit(`encuesta:${await clientIp()}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return { ok: false, error: "Se mandaron muchas respuestas seguidas desde esta conexión. Esperá unos minutos y probá de nuevo." };
    }

    const v = validateEncuesta(p);
    if (!v.ok) return v;

    const supabase = createAdminClient();

    let token: string | null = null;
    let inscripcionId: string | null = null;
    if (typeof p.token === "string" && TOKEN_RE.test(p.token)) {
      const { data } = await supabase.from("encuesta_tokens").select("token, team_id").eq("token", p.token).maybeSingle();
      if (data) {
        token = data.token as string;
        inscripcionId = data.team_id as string;
      }
    }

    const ua = (await headers()).get("user-agent");
    const { error } = await supabase.from("encuesta_satisfaccion_familias").upsert(
      {
        ...v.row,
        token,
        inscripcion_id: inscripcionId,
        user_agent_tipo: userAgentTipo(ua),
      },
      { onConflict: "respondent_id" }
    );
    if (error) {
      console.error("encuesta: no se pudo guardar", error.message);
      return { ok: false, error: "No pudimos guardar tus respuestas. Probá de nuevo en un ratito." };
    }
    return { ok: true };
  } catch (e) {
    console.error("encuesta: error inesperado", e);
    return { ok: false, error: "No pudimos guardar tus respuestas. Probá de nuevo en un ratito." };
  }
}
