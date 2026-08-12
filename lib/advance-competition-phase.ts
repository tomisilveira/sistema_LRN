import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBracketForCompetition } from "./generate-bracket-for-competition";
import type { Competition } from "./database.types";

/**
 * Se llama después de cargar cualquier resultado (juez o admin). Si con ese
 * resultado se terminó la fase de grupos, dispara lo que corresponda solo:
 * - 'single_elimination' sin bracket todavía → genera el cuadro.
 * - 'groups_only' → marca la competencia como terminada.
 * También marca la competencia terminada si el partido recién completado es
 * la final del cuadro eliminatorio.
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
        if (competition.format_type === "single_elimination") {
          const { count: existingBracketMatches } = await supabase
            .from("matches")
            .select("id", { count: "exact", head: true })
            .eq("competition_id", competitionId)
            .eq("phase", "bracket");
          if (!existingBracketMatches) {
            await generateBracketForCompetition(supabase, competitionId);
          }
        } else {
          await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
        }
      }
    }

    if (competition.status === "bracket_in_progress") {
      const { data: finalMatch } = await supabase
        .from("matches")
        .select("status")
        .eq("competition_id", competitionId)
        .eq("phase", "bracket")
        .eq("round", "F")
        .maybeSingle();
      if (finalMatch?.status === "completed") {
        await supabase.from("competitions").update({ status: "finished" }).eq("id", competitionId);
      }
    }
  } catch (err) {
    console.error("maybeAdvanceCompetitionPhase failed", competitionId, err);
  }
}
