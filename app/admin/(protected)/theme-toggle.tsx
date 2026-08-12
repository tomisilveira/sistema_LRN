"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Sincroniza con la clase que puso el script anti-flash (app/admin/layout.tsx)
    // antes del primer render — no se puede saber en el server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.getElementById("admin-theme-root")?.classList.contains("dark") ?? true);
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
      className="text-sm panel-label hover:opacity-80 transition-opacity"
      aria-label="Cambiar tema claro/oscuro"
    >
      {isDark ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
