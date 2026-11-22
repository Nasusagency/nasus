"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo "espacial arcade, pero elegante".
 *
 * - Constelación: estrellas que derivan despacio, se unen con líneas finas
 *   cuando están cerca y se conectan con el cursor. Estrella fugaz dorada.
 * - Nave: de vez en cuando cruza en horizontal una nave arcade en 2D, en pixel
 *   art. Rueda sobre su eje (de perfil → vista desde arriba → de perfil) en 12
 *   cuadros y deja una estela de cuadritos dorados. Igual en todos los tamaños.
 *
 * - Tetris (solo en móvil): un par de piezas caen muy despacio y giran a saltos,
 *   con trazo fino y casi transparentes. En escritorio no hay piezas: solo la nave.
 *
 * Un solo canvas, sin dependencias. En móvil usa menos estrellas y con
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

function rotar(celdas: Celda[]): Celda[] {
  const g = celdas.map(([x, y]) => [-y, x] as Celda);
  const minX = Math.min(...g.map((c) => c[0]));
  const minY = Math.min(...g.map((c) => c[1]));
  return g.map(([x, y]) => [x - minX, y - minY] as Celda);
}

// Nave arcade en 2D, de pixel art, que rueda sobre su eje mientras avanza: pasa de
// la vista de perfil a la vista desde arriba (como el clásico Galaga) y vuelve.
// Cada letra es un cuadro. W casco blanco, C cristal cian, G dorado.
const ANCHO = 22;
const EJE_Y = 4.5; // centro del casco (coordenadas de borde de celda)
const EJE_J = 4; // fila de la nariz
const FUSELAJE = [
  "..GGWWWWWWWWWWWWWWW",
  "GGGGWWWWWWWWWWWWWWWWW",
  "GGGGWWWWWWWWWWWWWWWWWW",
  "..GGWWWWWCCCWWWWWWWW",
  "....WWWWWWWWWWWWWW",
].map((f) => f.padEnd(ANCHO, "."));
const FILA0 = 2; // el casco empieza en la fila 2
const PASOS = 12; // posiciones del giro: una vuelta completa
const SPAN = 8; // cuánto se abren las alas vistas desde arriba

type CeldaAla = { i: number; j: number; col: 0 | 1 | 2 };

function dentro(x: number, y: number, poly: [number, number][]): boolean {
  let c = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) c = !c;
  }
  return c;
}

/** Alas en cada posición del giro, ya rasterizadas en cuadros. */
function alasDe(paso: number): CeldaAla[] {
  const h = SPAN * Math.sin((paso * 2 * Math.PI) / PASOS);
  if (Math.abs(h) < 1.2) return []; // de canto: se ocultan tras el casco
  const out: CeldaAla[] = [];
  for (const lado of [-1, 1]) {
    const ty = EJE_Y + lado * h; // altura de la punta del ala
    const poly: [number, number][] = [[14, EJE_Y], [8, EJE_Y], [2, ty], [7, ty]];
    const arriba = ty < EJE_Y;
    const cercana = h > 0 === arriba; // el ala más cercana a la cámara va más clara
    for (let i = 0; i <= 16; i++) {
      for (let j = -6; j <= 15; j++) {
        if (!dentro(i + 0.5, j + 0.5, poly)) continue;
        const punta = Math.abs(j + 0.5 - EJE_Y) > Math.abs(h) * 0.72;
        out.push({ i, j, col: punta ? 2 : cercana ? 0 : 1 });
      }
    }
  }
  return out;
}
const ALAS = Array.from({ length: PASOS }, (_, k) => alasDe(k));

type Nave = {
  x: number;
  y: number;
  y0: number;
  dir: 1 | -1;
  k: number;
  t0: number;
  estela: { x: number; y: number }[];
};

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
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let fugaz: { x: number; y: number; vx: number; vy: number; vida: number } | null = null;
    let proximaFugaz = performance.now() + 5000;
    let nave: Nave | null = null;
    let proximaNave = performance.now() + (reducido ? 1e12 : 6000);

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
      cs: 11,
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
      // Solo en móvil: dos piezas de Tetris
      const np = movil ? 2 : 0;
      if (piezas.length !== np) piezas = Array.from({ length: np }, () => crearPieza(true));
    };

    // Paleta del sprite
    const COL = {
      W: tone === "dark" ? "244,250,252" : "40,44,56",
      C: P.cian,
      G: P.dorado,
      alaCerca: tone === "dark" ? "0,176,204" : "0,120,130",
      alaLejos: tone === "dark" ? "0,104,132" : "0,80,92",
    };

    const pintarNave = (t: number, n: Nave) => {
      const px = n.k; // tamaño de cada cuadro de pixel art
      // Todo se ancla a la cuadrícula de píxeles para que se vea nítido
      const baseX = Math.round((n.x - (ANCHO / 2) * px) / px) * px;
      const baseY = Math.round(n.y / px) * px - EJE_J * px;
      const celda = (i: number, j: number, col: string, alfa = 1) => {
        const ii = n.dir === 1 ? i : ANCHO - 1 - i; // espejo si va hacia la izquierda
        ctx.fillStyle = `rgba(${col},${alfa})`;
        ctx.fillRect(baseX + ii * px, baseY + j * px, px, px);
      };

      // Estela de cuadritos dorados
      n.estela.forEach((e, i) => {
        if (i % 3 !== 0) return;
        ctx.fillStyle = `rgba(${P.dorado},${(i / n.estela.length) * 0.5})`;
        ctx.fillRect(Math.round(e.x / px) * px, Math.round(e.y / px) * px, px, px);
      });

      // Llama del propulsor: parpadea entre dos cuadros
      const llama = Math.floor(t / 90) % 2 === 0;
      celda(-1, EJE_J, P.dorado);
      celda(-2, EJE_J, llama ? P.dorado : P.cian, 0.9);
      if (llama) celda(-3, EJE_J, P.cian, 0.7);

      // Posición del giro: una vuelta cada PASOS cuadros (~1.1 s)
      const paso = Math.floor((t - n.t0) / 95) % PASOS;
      const ang = (paso * 2 * Math.PI) / PASOS;
      const cosA = Math.cos(ang);

      // Alas (primero, quedan detrás del casco)
      for (const c of ALAS[paso]) {
        celda(c.i, c.j, c.col === 2 ? P.dorado : c.col === 0 ? COL.alaCerca : COL.alaLejos);
      }

      // Casco
      FUSELAJE.forEach((fila, k) => {
        [...fila].forEach((ch, i) => {
          if (ch !== ".") celda(i, FILA0 + k, COL[ch as "W" | "C" | "G"]);
        });
      });

      // Aleta de cola y cúpula: suben, pasan al centro y bajan al rodar
      const jAleta = Math.round(EJE_Y - 3.5 * cosA - 1);
      for (let i = 4; i <= 6; i++) for (let j = 0; j < 2; j++) celda(i, jAleta + j, P.dorado, cosA < 0 ? 0.75 : 1);
      const jCupula = Math.round(EJE_Y - 3.0 * cosA - 1);
      for (let i = 12; i <= 14; i++) {
        celda(i, jCupula, cosA < 0 ? P.dorado : COL.W);
        celda(i, jCupula + 1, cosA < 0 ? P.dorado : i === 12 ? COL.W : P.cian);
      }
    };

    const pintarPieza = (pz: Pieza) => {
      const col = pz.color === "dorado" ? P.dorado : P.cian;
      for (const [cx, cy] of pz.celdas) {
        const x = pz.x + cx * pz.cs;
        const y = pz.y + cy * pz.cs;
        ctx.fillStyle = `rgba(${col},${pz.alfa * 0.35})`;
        ctx.fillRect(x + 3, y + 3, pz.cs - 6, pz.cs - 6);
        ctx.strokeStyle = `rgba(${col},${pz.alfa * 1.6})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, pz.cs - 1, pz.cs - 1);
      }
    };

    const pintar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const maxD = movil ? 100 : 135;

      // Piezas de Tetris (solo móvil), al fondo
      for (const pz of piezas) pintarPieza(pz);

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

      if (nave) pintarNave(t, nave);
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

      // Piezas: caen y giran a saltos
      piezas = piezas.map((pz) => {
        pz.y += pz.vy;
        if (t > pz.siguienteGiro) {
          pz.celdas = rotar(pz.celdas);
          pz.siguienteGiro = t + 3000 + Math.random() * 3500;
        }
        return pz.y > h + 20 ? crearPieza(false) : pz;
      });

      // Nave: cruza en horizontal, con un vaivén suave
      if (!nave && t > proximaNave) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        const y0 = h * (0.14 + Math.random() * 0.42);
        nave = {
          x: dir === 1 ? -80 : w + 80,
          y: y0,
          y0,
          dir,
          k: movil ? 3 : 4,
          t0: t,
          estela: [],
        };
      }
      if (nave) {
        nave.x += nave.dir * (movil ? 1.3 : 1.8);
        nave.y = nave.y0 + Math.sin(nave.x / 150) * 14;
        nave.estela.push({ x: nave.x - nave.dir * 13 * nave.k, y: nave.y });
        if (nave.estela.length > 30) nave.estela.shift();
        if (nave.x < -130 || nave.x > w + 130) {
          nave = null;
          proximaNave = t + 11000 + Math.random() * 9000;
        }
      }

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
