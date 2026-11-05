import "server-only";
import { randomBytes } from "node:crypto";

/** Token del link de la encuesta: 128 bits aleatorios en base64url (22
 * caracteres). No adivinable y sin relación con el id del equipo. */
export function newEncuestaToken(): string {
  return randomBytes(16).toString("base64url");
}
