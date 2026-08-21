"use client";

import { useEffect, useState } from "react";

/** Mismo mecanismo que el toggle del admin (ver
 * app/admin/(protected)/theme-toggle.tsx) pero con su propia clave de
 * localStorage y arrancando en claro — son toggles independientes a
 * propósito. Se usa en el inicio y en todo /publico (mismo root, ver
 * public-shell.tsx), así que la elección viaja entre esas páginas. */
export function PublicThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.getElementById("public-theme-root")?.classList.contains("dark") ?? false);
  }, []);

  function toggle() {
    const root = document.getElementById("public-theme-root");
    if (!root) return;
    const next = !isDark;
    root.classList.toggle("dark", next);
    localStorage.setItem("lrn-public-theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="text-xs rounded-full panel-chip px-3 py-1.5 hover:opacity-80 hover:scale-105 active:scale-90 transition-transform whitespace-nowrap"
      aria-label="Cambiar tema claro/oscuro"
    >
      {isDark ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
