import { parseMemberNames } from "@/lib/team-display";

/** Nombre de equipo/robot + nombres de las personas inscriptas debajo,
 * entre paréntesis, en un tamaño relativo (em) para que escale solo con el
 * font-size del contexto donde se use — scoreboard hero, fila de tabla,
 * tarjeta de cuadro, lo que sea. Sin `member_names` cargado, solo se ve el
 * nombre del equipo, igual que antes de este componente existir. */
export function TeamLabel({
  name,
  memberNames,
  className = "",
  namesClassName = "block text-[0.72em] font-normal leading-snug panel-label",
}: {
  name: string;
  memberNames?: string | null;
  className?: string;
  namesClassName?: string;
}) {
  const members = parseMemberNames(memberNames);
  return (
    <span className={className}>
      {name}
      {members.length > 0 && <span className={namesClassName}>({members.join(", ")})</span>}
    </span>
  );
}
