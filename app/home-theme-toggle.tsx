"use client";

import { useEffect, useState } from "react";

/** Igual mecanismo que el toggle del panel admin (ver
 * app/admin/(protected)/theme-toggle.tsx) pero con su propia clave de
 * localStorage y arrancando en claro — el admin arranca en oscuro, el
 * inicio público arranca en claro; son toggles independientes a propósito. */
export function HomeThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.getElementById("home-theme-root")?.classList.contains("dark") ?? false);
  }, []);

  function toggle() {
    const root = document.getElementById("home-theme-root");
    if (!root) return;
    const next = !isDark;
    root.classList.toggle("dark", next);
    localStorage.setItem("lrn-public-theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="text-xs rounded-full panel-chip px-3 py-1.5 hover:opacity-80 transition-opacity whitespace-nowrap"
      aria-label="Cambiar tema claro/oscuro"
    >
      {isDark ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
