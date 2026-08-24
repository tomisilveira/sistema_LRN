/** Nombres de las personas cargadas para un equipo/robot (ver
 * teams.member_names, 0008_team_member_names.sql) — texto libre, una
 * persona por línea o separadas por coma. Compartido entre todos los
 * lugares que muestran "Robot (Fulano, Mengano)" (ver TeamLabel). */
export function parseMemberNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Robot (Fulano, Mengano)" o solo "Robot" si no hay nombres cargados —
 * para contextos de texto plano (alt, title, exports) donde no alcanza un
 * componente React. */
export function formatTeamWithMembers(name: string, memberNames: string | null | undefined): string {
  const members = parseMemberNames(memberNames);
  return members.length > 0 ? `${name} (${members.join(", ")})` : name;
}
