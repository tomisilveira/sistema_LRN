import { LoadingState } from "@/app/components/loading-state";

// Mientras se arma una pantalla del panel: el menú lateral (layout) queda
// visible y usable, solo el contenido muestra el indicador.
export default function AdminLoading() {
  return <LoadingState />;
}
