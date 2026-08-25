/** Nombres de las personas cargadas para un equipo/robot (ver
 * teams.member_names, 0008_team_member_names.sql) — texto libre, una
 * persona por línea o separadas por coma. Compartido entre todos los
 * lugares que muestran "Robot (Fulano, Mengano)" (ver TeamLabel). */
export function parseMemberNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  // El envío del formulario (FormData → Server Action) normaliza saltos de
  // línea a CRLF aunque el campo de origen sea un textarea o un input
  // oculto armado a mano (MemberListInput) — sin el \r en el patrón queda
  // un carácter de control colgado al final de todos los nombres menos el
  // último, invisible en pantalla pero corrompe exports y comparaciones.
  return raw
    .split(/[\r\n,]/)
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

/** teams.robot_names sigue el mismo formato de texto libre que
 * member_names, así que reusa el mismo parser (ver 0010_team_robots_and_terms.sql). */
export const parseRobotNames = parseMemberNames;

/** Arma el texto a guardar en member_names/robot_names a partir de inputs
 * sueltos del form (uno por robot/integrante) — descarta los vacíos, uno
 * por línea. */
export function joinNameList(names: (string | null | undefined)[]): string | null {
  const joined = names
    .map((n) => (n ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return joined || null;
}
