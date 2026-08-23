import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBracketForCompetition } from "./generate-bracket-for-competition";
import type { BracketType, Competition } from "./database.types";

/** `bracket_type`s relevantes para cada formato — `gold_silver` tiene dos
 * finales posibles (oro y plata) en paralelo, el resto tiene un único
 * cuadro sin tipo (bracket_type null). */
function relevantBracketTypes(formatType: Competition["format_type"]): (BracketType | null)[] {
  return formatType === "gold_silver" ? ["gold", "silver"] : [null];
}

/**
 * Se llama después de cargar cualquier resultado (juez o admin). Si con ese
 * resultado se terminó la fase de grupos, dispara lo que corresponda solo:
 * - 'single_elimination'/'gold_silver' sin cuadro todavía → genera el/los
 *   cuadro(s).
 * - 'groups_only' → marca la competencia como terminada (la fase final,
 *   si se quiere, se genera a mano desde el botón — nunca sola, ver
 *   lib/generate-bracket-for-competition.ts).
 * También marca la competencia terminada cuando se completan todas las
 * finales relevantes del cuadro (una sola en la mayoría de los formatos,
 * oro Y plata en 'gold_silver').
 *
 * Nunca tira: cualquier problema queda logueado pero no debe romper la
 * carga del resultado que sí se guardó.
 */
export async function maybeAdvanceCompetitionPhase(
  supabase: SupabaseClient,
  competitionId: string
): Promise<void> {
  try {
    const { data: competition } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", competitionId)
      .single<Competition>();
    if (!competition) return;

    if (competition.status === "groups_in_progress") {
      const { data: groupMatches } = await supabase
        .from("matches")
        .select("status")
        .eq("competition_id", competitionId)
        .eq("phase", "group");

      const allDone =
        !!groupMatches && groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");

      if (allDone) {
        if (competition.format_type === "single_elimination" || competition.format_type === "gold_silver") {
          await generateBracketForCompetition(supabase, competitionId);
        } else {
          await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
        }
      }
    }

    if (competition.status === "bracket_in_progress") {
      const types = relevantBracketTypes(competition.format_type);
      const finalsDone = await Promise.all(
        types.map(async (bracketType) => {
          const base = supabase
            .from("matches")
            .select("status")
            .eq("competition_id", competitionId)
            .eq("phase", "bracket")
            .eq("round", "F");
          const { data: finalMatches } = bracketType
            ? await base.eq("bracket_type", bracketType)
            : await base.is("bracket_type", null);
          // Sin partidos de este bracket_type (ej. copa plata que no llegó a
          // generarse por falta de sobrantes) cuenta como "completo" — no
          // hay nada pendiente que bloquee el cierre de la competencia.
          if (!finalMatches || finalMatches.length === 0) return true;
          return finalMatches.every((m) => m.status === "completed");
        })
      );
      if (finalsDone.every(Boolean)) {
        await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
      }
    }
  } catch (err) {
    console.error("maybeAdvanceCompetitionPhase failed", competitionId, err);
  }
}
