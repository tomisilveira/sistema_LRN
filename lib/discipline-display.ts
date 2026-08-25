// "RC" (radio-controlado) en sumo/mini sumo se muestra expandido en toda la
// interfaz — pedido explícito de la organización, solo visual: no se toca
// `disciplines.name` en la base (sigue siendo "Sumo RC"/"Mini Sumo RC"), así
// no hace falta ninguna migración. Si en algún momento se prefiere guardarlo
// así directamente en la base, alcanza con vaciar esta función.
export function disciplineDisplayName(name: string): string {
  return name.replace(/\bRC\b/g, "Radio-controlado");
}

/** "Disciplina — Categoría", el label que se arma solo (copiado) en más de
 * diez lugares del panel/público — centralizado acá para que el reemplazo
 * de "RC" no dependa de tocar cada uno a mano. */
export function disciplineCategoryLabel(
  discipline: { name: string } | null | undefined,
  category: { name: string } | null | undefined
): string {
  return `${discipline ? disciplineDisplayName(discipline.name) : "?"} — ${category?.name ?? "?"}`;
}
