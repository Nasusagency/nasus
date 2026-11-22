"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo "espacial arcade, pero elegante".
 *
 * - Constelación: estrellas que derivan despacio, se unen con líneas finas
 *   cuando están cerca y se conectan con el cursor. Estrella fugaz dorada.
 * - Tetris: unas pocas piezas caen muy despacio y giran a saltos, como en el
 *   juego, dibujadas con trazo fino y casi transparentes.
 * - Nave: de vez en cuando cruza una nave pixelada que dispara a las piezas;
 *   al romperse, se deshacen en píxeles.
 *
 * Un solo canvas, sin dependencias. En móvil usa menos elementos y con
 * `prefers-reduced-motion` dibuja un solo cuadro quieto (sin nave).
 */

type Tono = "dark" | "light";

const PALETA = {
  dark: { base: "255,255,255", dorado: "196,168,130", cian: "0,242,255", lineas: 0.1 },
  light: { base: "13,13,20", dorado: "176,132,52", cian: "0,150,160", lineas: 0.13 },
} as const;

type Estrella = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tipo: 0 | 1 | 2; // 0 neutra, 1 dorada, 2 cian
  fase: number;
  destello: boolean;
};

type Celda = [number, number];
type Pieza = {
  x: number;
  y: number;
  vy: number;
  cs: number;
  celdas: Celda[];
  color: "dorado" | "cian";
  alfa: number;
  siguienteGiro: number;
};
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; s: number; color: "dorado" | "cian" };
type Bala = { x: number; y: number };

// Tetrominós (I, O, T, S, Z, J, L) en celdas de cuadrícula.
const FORMAS: Celda[][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];

// Nave (11×8). X = casco, o = cabina.
const NAVE = [
  ".....X.....",
  "....XXX....",
  "....XoX....",
  ".X.XXXXX.X.",
  ".XXXXXXXXX.",
  "XXXXXXXXXXX",
  "XX.XXXXX.XX",
  "X...X.X...X",
];

function rotar(celdas: Celda[]): Celda[] {
  const g = celdas.map(([x, y]) => [-y, x] as Celda);
  const minX = Math.min(...g.map((c) => c[0]));
  const minY = Math.min(...g.map((c) => c[1]));
  return g.map(([x, y]) => [x - minX, y - minY] as Celda);
}

export default function SpaceSketch({ tone = "dark" }: { tone?: Tono }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const P = PALETA[tone];

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const movil = window.matchMedia("(max-width: 768px)").matches;
    const puntero = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let w = 0;
    let h = 0;
    let estrellas: Estrella[] = [];
    let piezas: Pieza[] = [];
    let particulas: Particula[] = [];
    let balas: Bala[] = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let fugaz: { x: number; y: number; vx: number; vy: number; vida: number } | null = null;
    let proximaFugaz = performance.now() + 5000;
    let nave: { x: number; y: number; dir: 1 | -1; px: number; disparo: number } | null = null;
    let proximaNave = performance.now() + (reducido ? 1e12 : 9000);

    const crearEstrellas = (n: number): Estrella[] =>
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

    const crearPieza = (enPantalla: boolean): Pieza => ({
      x: Math.random() * (w - 80) + 10,
      y: enPantalla ? Math.random() * h : -70,
      vy: 0.14 + Math.random() * 0.16,
      cs: movil ? 11 : 14,
      celdas: FORMAS[Math.floor(Math.random() * FORMAS.length)].map((c) => [...c] as Celda),
      color: Math.random() < 0.55 ? "dorado" : "cian",
      alfa: 0.26 + Math.random() * 0.12,
      siguienteGiro: performance.now() + 2500 + Math.random() * 3500,
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
      if (estrellas.length !== n) estrellas = crearEstrellas(n);
      const np = movil ? 2 : 4;
      if (piezas.length !== np) piezas = Array.from({ length: np }, () => crearPieza(true));
    };

    const colorDe = (k: "dorado" | "cian") => (k === "dorado" ? P.dorado : P.cian);

    const pintarPieza = (p: Pieza) => {
      const col = colorDe(p.color);
      for (const [cx, cy] of p.celdas) {
        const x = p.x + cx * p.cs;
        const y = p.y + cy * p.cs;
        ctx.fillStyle = `rgba(${col},${p.alfa * 0.35})`;
        ctx.fillRect(x + 3, y + 3, p.cs - 6, p.cs - 6);
        ctx.strokeStyle = `rgba(${col},${p.alfa * 1.6})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, p.cs - 1, p.cs - 1);
      }
    };

    const pintar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const maxD = movil ? 100 : 135;

      // Piezas de Tetris (al fondo)
      for (const p of piezas) pintarPieza(p);

      // Líneas entre estrellas cercanas
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
            ctx.strokeStyle = `rgba(${P.base},${P.lineas * k})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (puntero && !reducido) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 160) {
            ctx.strokeStyle = `rgba(${P.cian},${0.34 * (1 - d / 160)})`;
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
        const col = s.tipo === 1 ? P.dorado : s.tipo === 2 ? P.cian : P.base;
        const alfa = s.tipo === 0 ? 0.3 * tw + 0.1 : 0.85 * tw;
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
        g.addColorStop(0, `rgba(${P.dorado},${0.9 * fugaz.vida})`);
        g.addColorStop(1, `rgba(${P.dorado},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(fugaz.x, fugaz.y);
        ctx.lineTo(fugaz.x - fugaz.vx * 14, fugaz.y - fugaz.vy * 14);
        ctx.stroke();
      }

      // Nave pixelada
      if (nave) {
        const px = nave.px;
        const x0 = nave.x - (NAVE[0].length * px) / 2;
        const y0 = nave.y;
        NAVE.forEach((fila, fy) => {
          [...fila].forEach((c, fx) => {
            if (c === ".") return;
            ctx.fillStyle = c === "o" ? `rgba(${P.dorado},0.95)` : `rgba(${P.cian},${tone === "dark" ? 0.8 : 0.7})`;
            ctx.fillRect(Math.round(x0 + fx * px), Math.round(y0 + fy * px), px - 0.5, px - 0.5);
          });
        });
        // Propulsor parpadeante
        if (Math.floor(t / 90) % 2 === 0) {
          ctx.fillStyle = `rgba(${P.dorado},0.85)`;
          ctx.fillRect(Math.round(nave.x - px), Math.round(y0 + NAVE.length * px), px, px);
          ctx.fillRect(Math.round(nave.x + 0), Math.round(y0 + NAVE.length * px), px, px);
        }
      }

      // Balas
      ctx.fillStyle = `rgba(${P.dorado},0.95)`;
      for (const b of balas) ctx.fillRect(Math.round(b.x - 1), Math.round(b.y), 2, 7);

      // Píxeles de las piezas rotas
      for (const q of particulas) {
        ctx.fillStyle = `rgba(${colorDe(q.color)},${Math.max(0, q.vida) * 0.8})`;
        ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
      }
    };

    const romper = (p: Pieza) => {
      for (const [cx, cy] of p.celdas) {
        const n = 3;
        for (let i = 0; i < n; i++) {
          particulas.push({
            x: p.x + cx * p.cs + Math.random() * p.cs,
            y: p.y + cy * p.cs + Math.random() * p.cs,
            vx: (Math.random() - 0.5) * 2.6,
            vy: (Math.random() - 0.7) * 2.2,
            vida: 1,
            s: 2 + Math.round(Math.random() * 2),
            color: p.color,
          });
        }
      }
    };

    const alcanza = (b: Bala, p: Pieza) =>
      p.celdas.some(([cx, cy]) => {
        const x = p.x + cx * p.cs;
        const y = p.y + cy * p.cs;
        return b.x >= x && b.x <= x + p.cs && b.y + 7 >= y && b.y <= y + p.cs;
      });

    const mover = (t: number) => {
      for (const s of estrellas) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -10) s.x = w + 10;
        else if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        else if (s.y > h + 10) s.y = -10;
      }

      // Piezas: caen y giran a saltos
      piezas = piezas.map((p) => {
        p.y += p.vy;
        if (t > p.siguienteGiro) {
          p.celdas = rotar(p.celdas);
          p.siguienteGiro = t + 3000 + Math.random() * 3500;
        }
        return p.y > h + 20 ? crearPieza(false) : p;
      });

      // Nave
      if (!nave && t > proximaNave) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        nave = {
          x: dir === 1 ? -50 : w + 50,
          y: h * (0.1 + Math.random() * 0.3),
          dir,
          px: movil ? 3 : 4,
          disparo: t + 600,
        };
      }
      if (nave) {
        nave.x += nave.dir * (movil ? 1.1 : 1.5);
        if (t > nave.disparo) {
          const objetivo = piezas.find(
            (p) => p.y > nave!.y + 30 && p.y < h * 0.8 && Math.abs(p.x + p.cs * 1.5 - nave!.x) < 70,
          );
          if (objetivo) {
            balas.push({ x: nave.x, y: nave.y + NAVE.length * nave.px });
            nave.disparo = t + 900;
          } else {
            nave.disparo = t + 250;
          }
        }
        if (nave.x < -80 || nave.x > w + 80) {
          nave = null;
          proximaNave = t + 20000 + Math.random() * 14000;
        }
      }

      // Balas y choques
      balas = balas.filter((b) => {
        b.y += 5;
        const golpeada = piezas.find((p) => alcanza(b, p));
        if (golpeada) {
          romper(golpeada);
          piezas = piezas.map((p) => (p === golpeada ? crearPieza(false) : p));
          return false;
        }
        return b.y < h + 10;
      });
      particulas = particulas.filter((q) => {
        q.x += q.vx;
        q.y += q.vy;
        q.vy += 0.05;
        q.vida -= 0.022;
        return q.vida > 0;
      });

      if (fugaz) {
        fugaz.x += fugaz.vx;
        fugaz.y += fugaz.vy;
        fugaz.vida -= 0.012;
        if (fugaz.vida <= 0) fugaz = null;
      } else if (t > proximaFugaz) {
        fugaz = {
          x: w * (0.55 + Math.random() * 0.4),
          y: -10,
          vx: -7 - Math.random() * 3,
          vy: 3.4 + Math.random() * 1.6,
          vida: 1,
        };
        proximaFugaz = t + 9000 + Math.random() * 6000;
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
  }, [tone]);

  return (
    <div className="space-sketch" data-tone={tone} aria-hidden="true">
      <div className="space-wash" />
      <div className="space-dots" />
      <canvas ref={ref} />
    </div>
  );
}
