import { parseMemberNames } from "@/lib/team-display";

/** Nombre de equipo/robot + nombres de las personas inscriptas debajo, en su
 * propia línea (sin paréntesis, separados por " · "), en un tamaño relativo
 * (em) para que escale solo con el font-size del contexto donde se use —
 * scoreboard hero, fila de tabla, tarjeta de cuadro, lo que sea. Sin
 * `member_names` cargado, solo se ve el nombre del equipo, igual que antes
 * de este componente existir.
 *
 * ago/sep 2026: los integrantes pasaron de 0.72em/gris muy claro/entre
 * paréntesis a 0.9em con más contraste — antes casi no se leían (pedido
 * explícito, ver la maqueta "Robots y participantes"). El tamaño del NOMBRE
 * lo decide cada contexto (se subió un escalón en cuadro/tabla/marcador/
 * fichas al mismo tiempo). */
export function TeamLabel({
  name,
  memberNames,
  className = "",
  namesClassName = "block text-[0.9em] font-normal leading-snug text-neutral-500 dark:text-neutral-400",
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
      {members.length > 0 && <span className={namesClassName}>{members.join(" · ")}</span>}
    </span>
  );
}
