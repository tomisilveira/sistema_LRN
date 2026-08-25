// El admin siempre es claro — sin toggle, sin clase `dark`, sin excepción
// (pedido explícito del usuario ago 2026: el toggle que había antes quedaba
// pegado en oscuro entre sesiones — localStorage — y volvía casi negras
// todas las tarjetas/superficies del panel, sin que hubiera forma fácil de
// notar por qué. El público conserva su propio toggle en public-shell.tsx,
// con su propio root — esto no lo afecta).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel-page min-h-full">{children}</div>;
}
