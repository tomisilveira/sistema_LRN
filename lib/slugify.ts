const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");

/** slug determinístico a partir de un nombre: sin acentos, en minúscula,
 * separado por guiones bajos — misma convención que las disciplinas y
 * categorías seedeadas (ej. "sumo_autonomo", "juvenil_adultos"). Usado al
 * crear disciplinas y categorías desde el panel admin. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
