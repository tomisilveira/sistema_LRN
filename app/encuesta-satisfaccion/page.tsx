import SurveyFlow from "./survey-flow";

// Página estática a propósito (carga rápida con poca señal y cacheable): el
// token `?t=` lo lee el cliente recién al enviar, y el server lo resuelve a
// equipo/evento en la Server Action. Sin token también se puede responder.
export default function EncuestaSatisfaccionPage() {
  return <SurveyFlow />;
}
