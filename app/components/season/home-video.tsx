"use client";

import { useEffect, useRef, useState } from "react";

/** Video de la temporada en la portada. Hay dos cortes del mismo video: el
 * vertical (9:16) para pantallas más altas que anchas —celulares— y el
 * horizontal (16:9) para el resto; el navegador elige con `media` en cada
 * <source> y baja uno solo. Los archivos están en public/videos/ (ya
 * comprimidos para web: ~11 MB cada uno, ver el commit que los agrega).
 *
 * Arranca solo y en silencio (los navegadores solo permiten autoplay sin
 * sonido), en loop, y se pausa cuando sale de la pantalla. No arranca solo
 * si el sistema pide menos movimiento o ahorro de datos: ahí queda la foto
 * con el botón de reproducir. Botones de pausa y de sonido siempre a mano
 * (contenido en movimiento de más de 5 s tiene que poder pausarse). */

const SRC = {
  vertical: "/videos/liga-2026-vertical.mp4",
  horizontal: "/videos/liga-2026-horizontal.mp4",
  posterVertical: "/videos/liga-2026-vertical-poster.jpg",
  posterHorizontal: "/videos/liga-2026-horizontal-poster.jpg",
};
const PORTRAIT = "(orientation: portrait)";

export function HomeVideo({ title }: { title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // El usuario pausó a mano: no volver a reproducir al re-entrar en pantalla.
  const userPaused = useRef(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) userPaused.current = true;

    const tryPlay = () => {
      if (userPaused.current) return;
      video.play().catch(() => {
        /* autoplay bloqueado: queda la foto con el botón de play */
      });
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) tryPlay();
        else video.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(video);

    // Si el celular se gira, cambia el corte que corresponde: recargar.
    const mq = window.matchMedia(PORTRAIT);
    const onRotate = () => {
      video.load();
      tryPlay();
    };
    mq.addEventListener("change", onRotate);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", onRotate);
    };
  }, []);

  const togglePlay = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  };
  const toggleMute = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    }
  };

  return (
    <figure className="relative mx-auto overflow-hidden rounded-3xl bg-neutral-950 shadow-xl aspect-video portrait:aspect-[9/16] portrait:max-h-[78svh]">
      {/* Foto mientras carga (y sin JS): misma lógica de orientación. */}
      <picture>
        <source media={PORTRAIT} srcSet={SRC.posterVertical} />
        <img src={SRC.posterHorizontal} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={SRC.vertical} type="video/mp4" media={PORTRAIT} />
        <source src={SRC.horizontal} type="video/mp4" />
      </video>

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30 focus-visible:outline-none group"
          aria-label="Reproducir video"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-brand-teal">
            <PlayIcon className="h-7 w-7 translate-x-0.5" />
          </span>
        </button>
      )}

      <div className="absolute bottom-3 right-3 flex gap-2">
        {playing && (
          <VideoButton onClick={togglePlay} label="Pausar video">
            <PauseIcon className="h-4 w-4" />
          </VideoButton>
        )}
        <VideoButton onClick={toggleMute} label={muted ? "Activar sonido" : "Silenciar"} pressed={!muted}>
          {muted ? <MutedIcon className="h-4 w-4" /> : <SoundIcon className="h-4 w-4" />}
          <span className="text-xs font-bold">{muted ? "Activar sonido" : "Sonido"}</span>
        </VideoButton>
      </div>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

function VideoButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full bg-black/55 px-3 text-white backdrop-blur transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {children}
    </button>
  );
}

const PlayIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
);
const PauseIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const MutedIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
    <path d="m22 9-6 6M16 9l6 6" />
  </svg>
);
const SoundIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
