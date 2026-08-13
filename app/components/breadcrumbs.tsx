import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Migas de pan para ubicarse en el drill-down Eventos › Evento › Torneo. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm panel-label mb-1">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="opacity-50">›</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-brand-teal transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-neutral-900 dark:text-neutral-100 font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
