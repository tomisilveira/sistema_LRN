"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

const FACT_MS = 3200;
const fmt = (n: number) => n.toLocaleString("es-AR");

/** La cifra grande del hero, que va rotando entre los números de la
 * temporada. Con prefers-reduced-motion sigue cambiando pero sin el giro. */
export function HeroFact({ facts }: { facts: { value: number; label: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (facts.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % facts.length), FACT_MS);
    return () => clearInterval(t);
  }, [facts.length]);
  const fact = facts[i % Math.max(1, facts.length)];
  if (!fact) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex w-full flex-col items-center gap-5">
        <div className="relative h-[8.5rem] sm:h-[10.5rem] w-full [perspective:800px]" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={fact.label}
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 36, rotateX: -60 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -24, rotateX: 40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="font-heading text-7xl sm:text-8xl font-extrabold tabular-nums leading-none tracking-tight bg-gradient-to-br from-white via-white to-brand-teal bg-clip-text text-transparent">
                {fmt(fact.value)}
              </p>
              <p className="mt-3 text-lg sm:text-xl font-semibold text-white/85">{fact.label}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {facts.map((f, k) => (
            <span
              key={f.label}
              className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/35"}`}
            />
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}
