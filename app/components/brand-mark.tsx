import Image from "next/image";

// Logo real de la Liga (subido por la organización, ago 2026) — reemplaza
// los "puntitos" de marca que hacían de placeholder en headers/nav antes de
// tener un logo. Los tres recortes (ver public/brand-*.png, generados desde
// los exports originales con la transparencia recortada al contenido) cubren
// los tres usos que aparecen en el sistema:
//  - BrandIcon: solo la mascota — headers/nav chicos, favicon/app icons.
//  - BrandWordmark: solo el texto "LIGA ROBÓTICA NEUQUINA" — cuando el
//    ícono ya está en otro lado (ej. al lado del BrandIcon del sidebar).
//  - BrandLockup: ícono + texto juntos — momentos "hero" sin nada más
//    marcando la marca alrededor (login, pantallas vacías).
// El tamaño mostrado se controla 100% con className (ej. "h-7 w-auto"); los
// width/height son el tamaño real del archivo, next/image los usa para el
// aspect ratio, no para el tamaño en pantalla.

// El ícono en sí (mascota) lleva sus colores pensados para fondo claro — el
// contorno celeste y las formas sueltas (gota, mano) casi desaparecen sobre
// el header oscuro de /publico (el único lugar con modo oscuro real, ver
// public-shell.tsx). Por eso siempre se apoya en su propia chapita blanca
// circular en vez de heredar el fondo de la página — así se ve igual de
// bien en cualquier header, oscuro o claro. `className` controla el
// tamaño de esa chapita (ej. "h-7 w-7"), no el de la imagen sola.
export function BrandIcon({ className = "h-7 w-7", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center shrink-0 rounded-full bg-white p-[3px] shadow-sm ${className}`}>
      <Image
        src="/brand-icon.png"
        alt="Liga Robótica Neuquina"
        width={512}
        height={567}
        className="w-full h-full object-contain"
        priority={priority}
      />
    </span>
  );
}

export function BrandWordmark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/brand-wordmark.png"
      alt="Liga Robótica Neuquina"
      width={900}
      height={255}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function BrandLockup({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/brand-lockup.png"
      alt="Liga Robótica Neuquina"
      width={1600}
      height={699}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
