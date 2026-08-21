"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Sincroniza con la clase que puso el script anti-flash (app/admin/layout.tsx)
    // antes del primer render — no se puede saber en el server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.getElementById("admin-theme-root")?.classList.contains("dark") ?? false);
  }, []);

  function toggle() {
    const root = document.getElementById("admin-theme-root");
    if (!root) return;
    const next = !isDark;
    root.classList.toggle("dark", next);
    localStorage.setItem("lrn-admin-theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="text-sm panel-label hover:opacity-80 hover:scale-110 active:scale-90 transition-transform"
      aria-label="Cambiar tema claro/oscuro"
    >
      {isDark ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
