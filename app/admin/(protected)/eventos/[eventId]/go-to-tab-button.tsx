"use client";

import { useSectionNav } from "@/app/admin/(protected)/section-nav-context";
import { ChevronRightIcon } from "@/app/components/action-icons";

/** Salta a otra pestaña del mismo evento (Canchas, Torneos...) desde el
 * Resumen — mismo mecanismo que el menú lateral (SectionNavContext). */
export function GoToTabButton({ tabId, children }: { tabId: string; children: React.ReactNode }) {
  const { setActiveId } = useSectionNav();
  return (
    <button
      type="button"
      onClick={() => {
        setActiveId(tabId);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-teal-dark hover:underline underline-offset-2 rounded focus-visible:outline-2 focus-visible:outline-brand-teal"
    >
      {children}
      <ChevronRightIcon className="w-3.5 h-3.5" />
    </button>
  );
}
