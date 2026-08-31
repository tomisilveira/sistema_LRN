/** Tope de integrantes por equipo, para todas las disciplinas (pedido
 * explícito de la organización — es por la premiación). Compartido entre las
 * validaciones del server (lib/team-input.ts) y el `max` del
 * MemberListInput / los textos de inscripción (componentes cliente), por eso
 * vive en su propio módulo sin `server-only`. */
export const MAX_TEAM_MEMBERS = 4;
