import type { Competition } from "@/lib/database.types";
import { updateCompetitionFormat } from "./actions";

export function EditFormatForm({ competitionId, competition }: { competitionId: string; competition: Competition }) {
  const action = updateCompetitionFormat.bind(null, competitionId);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="block text-sm panel-label mb-1">Formato</label>
        <select
          name="format_type"
          defaultValue={competition.format_type}
          className="w-full rounded-md panel-input px-3 py-2 text-sm"
        >
          <option value="groups_only">Solo fase de grupos (sin eliminatoria)</option>
          <option value="single_elimination">Grupos + eliminatoria simple</option>
        </select>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs panel-label mb-1">Pts. victoria</label>
          <input
            name="points_win"
            type="number"
            defaultValue={competition.points_win}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Pts. empate</label>
          <input
            name="points_draw"
            type="number"
            defaultValue={competition.points_draw}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Pts. derrota</label>
          <input
            name="points_loss"
            type="number"
            defaultValue={competition.points_loss}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs panel-label mb-1">Clasif./grupo</label>
          <input
            name="qualifiers_per_group"
            type="number"
            defaultValue={competition.qualifiers_per_group}
            className="w-full rounded-md panel-input px-2 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="allow_draws" type="checkbox" defaultChecked={competition.allow_draws} className="rounded" />
        Esta disciplina admite empates (desmarcar para sumo)
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md panel-button-primary font-medium px-4 py-2 text-sm">
          Guardar formato
        </button>
        <button type="reset" className="rounded-md panel-button-secondary px-4 py-2 text-sm">
          Restablecer
        </button>
      </div>
    </form>
  );
}
