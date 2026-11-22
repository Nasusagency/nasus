"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo "cuaderno de ingeniería con cielo estrellado".
 *
 * Papel con puntos de cuaderno y una constelación dibujada a lápiz: estrellas
 * que derivan muy despacio, se unen con líneas finas cuando están cerca y se
 * conectan con el cursor. De vez en cuando cruza una estrella fugaz dorada.
 *
 * Es un solo canvas, sin dependencias. En móvil usa pocas estrellas y con
 * `prefers-reduced-motion` dibuja un solo cuadro quieto.
 */

type Estrella = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tipo: 0 | 1 | 2; // 0 grafito, 1 dorada, 2 cian
  fase: number;
  destello: boolean;
};

const RGB = {
  grafito: "13,13,20",
  dorado: "176,132,52",
  cian: "0,150,160",
};

export default function SpaceSketch() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const movil = window.matchMedia("(max-width: 768px)").matches;
    const puntero = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let w = 0;
    let h = 0;
    let estrellas: Estrella[] = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let fugaz: { x: number; y: number; vx: number; vy: number; vida: number } | null = null;
    let proxima = performance.now() + 5000;

    const crear = (n: number): Estrella[] =>
      Array.from({ length: n }, () => {
        const r = Math.random();
        const tipo: 0 | 1 | 2 = r < 0.1 ? 1 : r < 0.18 ? 2 : 0;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          r: tipo === 0 ? 0.9 + Math.random() * 0.9 : 1.6 + Math.random() * 1.2,
          tipo,
          fase: Math.random() * Math.PI * 2,
          destello: tipo !== 0 && Math.random() < 0.7,
        };
      });

    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = movil ? 26 : Math.round(Math.min(72, (w * h) / 20000));
      if (estrellas.length !== n) estrellas = crear(n);
    };

    const pintar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const maxD = movil ? 100 : 135;

      // Líneas entre estrellas cercanas (trazo de lápiz)
      ctx.lineWidth = 0.8;
      for (let i = 0; i < estrellas.length; i++) {
        const a = estrellas[i];
        for (let j = i + 1; j < estrellas.length; j++) {
          const b = estrellas[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD * maxD) {
            const k = 1 - Math.sqrt(d2) / maxD;
            ctx.strokeStyle = `rgba(${RGB.grafito},${0.13 * k})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // Conexión con el cursor
        if (puntero && !reducido) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 160) {
            ctx.strokeStyle = `rgba(${RGB.cian},${0.32 * (1 - d / 160)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Estrellas
      for (const s of estrellas) {
        const tw = 0.65 + 0.35 * Math.sin(t / 900 + s.fase);
        const col = s.tipo === 1 ? RGB.dorado : s.tipo === 2 ? RGB.cian : RGB.grafito;
        const alfa = s.tipo === 0 ? 0.32 * tw + 0.1 : 0.85 * tw;
        ctx.fillStyle = `rgba(${col},${alfa})`;
        ctx.strokeStyle = `rgba(${col},${alfa})`;
        if (s.destello) {
          const L = 3.5 + s.r * 2.2 * tw;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(s.x - L, s.y);
          ctx.lineTo(s.x + L, s.y);
          ctx.moveTo(s.x, s.y - L);
          ctx.lineTo(s.x, s.y + L);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Estrella fugaz dorada
      if (fugaz) {
        const g = ctx.createLinearGradient(fugaz.x, fugaz.y, fugaz.x - fugaz.vx * 14, fugaz.y - fugaz.vy * 14);
        g.addColorStop(0, `rgba(${RGB.dorado},${0.9 * fugaz.vida})`);
        g.addColorStop(1, `rgba(${RGB.dorado},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(fugaz.x, fugaz.y);
        ctx.lineTo(fugaz.x - fugaz.vx * 14, fugaz.y - fugaz.vy * 14);
        ctx.stroke();
      }
    };

    const mover = (t: number) => {
      for (const s of estrellas) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -10) s.x = w + 10;
        else if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        else if (s.y > h + 10) s.y = -10;
      }
      if (fugaz) {
        fugaz.x += fugaz.vx;
        fugaz.y += fugaz.vy;
        fugaz.vida -= 0.012;
        if (fugaz.vida <= 0) fugaz = null;
      } else if (t > proxima) {
        fugaz = {
          x: w * (0.55 + Math.random() * 0.4),
          y: -10,
          vx: -7 - Math.random() * 3,
          vy: 3.4 + Math.random() * 1.6,
          vida: 1,
        };
        proxima = t + 9000 + Math.random() * 6000;
      }
    };

    const cuadro = (t: number) => {
      mover(t);
      pintar(t);
      raf = requestAnimationFrame(cuadro);
    };

    const alMover = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const alSalir = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    ajustar();
    if (reducido) {
      pintar(0);
    } else {
      raf = requestAnimationFrame(cuadro);
      if (puntero) {
        window.addEventListener("pointermove", alMover, { passive: true });
        document.addEventListener("pointerleave", alSalir);
      }
    }
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const alRedimensionar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        ajustar();
        if (reducido) pintar(0);
      }, 150);
    };
    window.addEventListener("resize", alRedimensionar);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(temporizador);
      window.removeEventListener("resize", alRedimensionar);
      window.removeEventListener("pointermove", alMover);
      document.removeEventListener("pointerleave", alSalir);
    };
  }, []);

  return (
    <div className="space-sketch" aria-hidden="true">
      <div className="space-wash" />
      <div className="space-dots" />
      <canvas ref={ref} />
    </div>
  );
}
