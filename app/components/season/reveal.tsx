"use client";

import { MotionConfig, motion } from "motion/react";

/** Entrada sutil al aparecer en pantalla (sube 16 px y aparece), una sola
 * vez. Con prefers-reduced-motion, MotionConfig "user" saca el
 * desplazamiento y deja solo el fundido. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
