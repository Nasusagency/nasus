"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Capa de animación de la landing, centralizada en un solo componente cliente.
 *
 * La página sigue siendo un Server Component: aquí no se renderiza contenido,
 * solo el cromo (grano, partículas, cursor) y la lógica que marca con `is-in`
 * los nodos que el HTML servido trae anotados con `data-reveal`.
 *
 * Presupuesto de listeners: UN scroll (throttleado con rAF), UN mousemove
 * (solo en punteros finos) y UN IntersectionObserver para toda la página.
 */

export default function SiteChrome() {
  const [hovering, setHovering] = useState(false);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  // ── Reveals + navbar + capítulo activo ──────────────────────────────────
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = document.querySelectorAll<HTMLElement>(
      "[data-reveal], .case-reveal, .chapter-numeral",
    );
    let cleanupIO: (() => void) | undefined;

    if (reduced) {
      // Sin animación: se muestra todo de una vez, sin observer.
      targets.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            io.unobserve(entry.target); // una sola vez: no re-animar al volver
          }
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
      );
      targets.forEach((el) => io.observe(el));

      // Índice para el escalonado por CSS, sin timers por elemento.
      document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          (child as HTMLElement).style.setProperty("--i", String(i));
        });
      });

      cleanupIO = () => io.disconnect();
    }

    // Un único listener de scroll para navbar y capítulo activo. Escribe por
    // DOM en vez de por estado: la navbar se queda en el HTML del servidor.
    const nav = document.getElementById("site-nav");

    const apply = () => {
      frame.current = null;
      if (nav) nav.dataset.scrolled = window.scrollY > 30 ? "true" : "false";

    };

    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(apply);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      cleanupIO?.();
    };
  }, []);

  // ── Cursor personalizado: solo puntero fino ─────────────────────────────
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    document.body.classList.add("has-custom-cursor");

    const onMove = (e: MouseEvent) => {
      const el = cursorRef.current;
      if (el) {
        el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        el.style.opacity = "1";
      }
      const target = e.target as HTMLElement | null;
      setHovering(Boolean(target?.closest("a, button, [data-cursor-view]")));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  const size = hovering ? 56 : 18;

  return (
    <>
      <div className="nasus-grain" aria-hidden="true" />

      {/* Se renderiza siempre; el CSS lo oculta salvo en punteros finos. */}
      <div
        ref={cursorRef}
        className="nasus-cursor"
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          opacity: 0,
          background: hovering ? "rgba(0,242,255,.12)" : "transparent",
        }}
      />
    </>
  );
}
