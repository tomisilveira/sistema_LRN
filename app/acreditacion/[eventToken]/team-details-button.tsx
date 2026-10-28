"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Team } from "@/lib/database.types";
import { parseMemberNames, parseMentorContact, parseRobotNames } from "@/lib/team-display";
import { formatLocation } from "@/lib/argentina-locations";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : null);

/** "Ver inscripción": todos los datos del equipo en un cuadro de solo
 * lectura (torneo, integrantes, robots, institución, responsable con
 * contacto, notas, fechas de inscripción/acreditación) — para chequear algo
 * en la mesa sin entrar a "Editar" y arriesgarse a cambiar un dato. Mismo
 * Portal a document.body que ModalFormButton (ver comentario ahí). */
export function TeamDetailsButton({ team, competitionLabel }: { team: Team; competitionLabel: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const members = parseMemberNames(team.member_names);
  const robots = parseRobotNames(team.robot_names);
  const contact = parseMentorContact(team.mentor_contact);
  const location = formatLocation(team.locality, team.province);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] rounded-md px-2.5 h-[30px] panel-button-secondary"
      >
        Ver inscripción
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 panel-modal-backdrop"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`team-details-${team.id}`}
              className="panel-page panel-card rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-lg panel-modal-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs panel-label">{competitionLabel}</p>
                  <h3 id={`team-details-${team.id}`} className="font-semibold text-lg leading-tight break-words">
                    {team.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="panel-label hover:opacity-70 hover:rotate-90 active:scale-90 transition-all duration-150 text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>

              <dl className="space-y-3 text-sm">
                <Field label={`Integrantes (${team.member_count ?? members.length})`}>
                  {members.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-0.5">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty />
                  )}
                </Field>
                {robots.length > 0 && (
                  <Field label="Robots">
                    <ul className="list-disc pl-5 space-y-0.5">
                      {robots.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </Field>
                )}
                <Field label="Institución">{team.institution || <Empty />}</Field>
                <Field label="Localidad">{location || <Empty />}</Field>
                <Field label="Responsable (mentor/profesor)">
                  {team.mentor_name || contact.phones.length + contact.emails.length + contact.other.length > 0 ? (
                    <div className="space-y-0.5">
                      {team.mentor_name && <p className="font-medium">{team.mentor_name}</p>}
                      {contact.phones.map((p) => (
                        <p key={p.href}>
                          📞{" "}
                          <a href={p.href} className="underline text-brand-teal-dark">
                            {p.label}
                          </a>
                        </p>
                      ))}
                      {contact.emails.map((e) => (
                        <p key={e} className="break-all">
                          ✉️{" "}
                          <a href={`mailto:${e}`} className="underline text-brand-teal-dark">
                            {e}
                          </a>
                        </p>
                      ))}
                      {contact.other.map((o) => (
                        <p key={o}>{o}</p>
                      ))}
                    </div>
                  ) : (
                    <Empty />
                  )}
                </Field>
                {team.notes && (
                  <Field label="Notas">
                    <p className="whitespace-pre-line">{team.notes}</p>
                  </Field>
                )}
                <Field label="Inscripción">
                  <p>Cargada el {formatDate(team.created_at)}</p>
                  <p className="panel-label">
                    {team.accepted_terms_at
                      ? `Aceptó las bases y condiciones (${formatDate(team.accepted_terms_at)})`
                      : "Cargada a mano (sin el formulario público)"}
                  </p>
                </Field>
                <Field label="Estado en la mesa">
                  <p>
                    {team.accredited ? `Acreditado (${formatDate(team.accredited_at)})` : "Sin acreditar"} ·{" "}
                    {team.homologated ? `Homologado (${formatDate(team.homologated_at)})` : "Sin homologar"}
                  </p>
                  <p className="panel-label">
                    Presentes:{" "}
                    {team.participants_present ??
                      `${team.member_count ?? members.length} (los inscriptos, todavía sin confirmar en la mesa)`}
                  </p>
                  {team.withdrawn_at && (
                    <p className="text-red-600">
                      Dado de baja el {formatDate(team.withdrawn_at)}
                      {team.withdrawn_reason ? ` — ${team.withdrawn_reason}` : ""}
                    </p>
                  )}
                </Field>
              </dl>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-md panel-button-secondary px-4 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide panel-label">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="panel-label">Sin cargar</span>;
}
