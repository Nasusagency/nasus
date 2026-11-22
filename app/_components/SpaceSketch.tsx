"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo "espacial arcade, pero elegante".
 *
 * - Constelación: estrellas que derivan despacio, se unen con líneas finas
 *   cuando están cerca y se conectan con el cursor. Estrella fugaz dorada.
 * - Nave: de vez en cuando cruza en horizontal una nave arcade en 3D, hecha de
 *   cubos con aspecto de ficha de Tetris y sombreado plano. Gira sobre su eje,
 *   aletea y deja una estela de cuadritos dorados. Igual en todos los tamaños.
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

type V3 = [number, number, number];
type Vox = {
  x: number;
  y: number;
  z: number;
  c: 0 | 1 | 3 | 4;
  caras: number;
  /** Solo las alas: distancia a la raíz y lado, para aletear. */
  ala?: { d: number; lado: 1 | -1 };
};

// Nave arcade hecha de cubos (voxels), vista de perfil con la nariz a la derecha.
// X = casco, o = cabina dorada. Las alas se extruyen hacia los lados.
const PERFIL = [
  "....XX..........",
  "....XXX.........",
  "XXXXXXXXXXooX...",
  "XXXXXXXXXXXXXXXX",
  "XXXXXXXXXXXXXXX.",
  "..XXXXXXXXXXX...",
  "....XXXXXX......",
];

// Cada cara del cubo: dirección, y las esquinas de su cuadrado.
const CARAS_CUBO: { n: V3; q: V3[] }[] = [
  { n: [1, 0, 0], q: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [-1, 0, 0], q: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { n: [0, 1, 0], q: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], q: [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]] },
  { n: [0, 0, 1], q: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], q: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
];

function construirNave(): Vox[] {
  type Color = 0 | 1 | 3 | 4;
  const celdas = new Map<string, { c: Color; ala?: { d: number; lado: 1 | -1 } }>();
  const alto = PERFIL.length;
  const poner = (x: number, y: number, z: number, c: Color, ala?: { d: number; lado: 1 | -1 }) =>
    celdas.set(`${x},${y},${z}`, { c, ala });

  // Capa central: el perfil completo. Cabina clara y vientre en cian más oscuro.
  PERFIL.forEach((fila, r) =>
    [...fila].forEach((ch, x) => {
      if (ch === ".") return;
      poner(x, alto - 1 - r, 0, ch === "o" ? 4 : r >= 5 ? 1 : 0);
    }),
  );
  // Capas laterales del fuselaje (sin la cabina, que queda angosta)
  for (const z of [-1, 1]) {
    PERFIL.forEach((fila, r) => {
      if (r < 2 || r > 4) return;
      [...fila].forEach((ch, x) => {
        if (ch === "X" && x >= 2 && x <= 13) poner(x, alto - 1 - r, z, r >= 5 ? 1 : 0);
      });
    });
  }
  // Alas en delta, doradas, que aletean desde la raíz (el costado del fuselaje)
  for (const lado of [-1, 1] as const) {
    const tramo = (x0: number, x1: number, d: number) => {
      for (let x = x0; x <= x1; x++) poner(x, 3, lado * (1 + d), 3, { d, lado });
    };
    tramo(4, 11, 1);
    tramo(3, 8, 2);
    tramo(2, 5, 3);
  }

  // Centrar en el origen y marcar las caras expuestas (las alas dibujan todas)
  const cx = 7.5;
  const cy = (alto - 1) / 2;
  const salida: Vox[] = [];
  celdas.forEach((info, k) => {
    const [x, y, z] = k.split(",").map(Number);
    let caras = 0;
    CARAS_CUBO.forEach((f, i) => {
      if (info.ala || !celdas.has(`${x + f.n[0]},${y + f.n[1]},${z + f.n[2]}`)) caras |= 1 << i;
    });
    if (caras) salida.push({ x: x - cx, y: y - cy, z, c: info.c, caras, ala: info.ala });
  });
  return salida;
}

const NAVE_VOX = construirNave();

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

    // Colores de los cubos: casco, alas (cian más oscuro), cabina y puntas doradas
    const COLOR_VOX: Record<0 | 1 | 3 | 4, number[]> = {
      0: P.cian.split(",").map(Number),
      1: (tone === "dark" ? "0,150,176" : "0,110,120").split(",").map(Number),
      3: P.dorado.split(",").map(Number),
      4: (tone === "dark" ? "235,248,250" : "255,255,255").split(",").map(Number),
    };
    const LUZ: V3 = [0.35, 0.8, -0.5];
    const LUZ_N = Math.hypot(...LUZ);

    const pintarNave = (t: number, n: Nave) => {
      const u = n.k; // tamaño de cada cubo, en píxeles

      // Estela arcade: cuadritos dorados que se apagan hacia atrás
      n.estela.forEach((e, i) => {
        if (i % 3 !== 0) return;
        ctx.fillStyle = `rgba(${P.dorado},${(i / n.estela.length) * 0.5})`;
        ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 3, 3);
      });

      // Giro en 3D: la nave gira sobre su eje vertical mientras avanza
      const dt = t - n.t0;
      const guinada = dt * 0.0016;
      const cabeceo = 0.42; // vista un poco desde arriba, para ver el lomo
      const cy = Math.cos(guinada);
      const sy = Math.sin(guinada);
      const cp = Math.cos(cabeceo);
      const sp = Math.sin(cabeceo);
      const rot = (x: number, y: number, z: number): V3 => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
      };
      const F = 520;

      // Aleteo: las alas suben y bajan desde la raíz, siempre en cubos
      const aleteo = 0.62 * Math.sin(dt * 0.009);
      const sa = Math.sin(aleteo);
      const ca = Math.cos(aleteo);
      const donde = (v: Vox): V3 =>
        v.ala ? [v.x, v.y + v.ala.d * sa, v.ala.lado * (1 + v.ala.d * ca)] : [v.x, v.y, v.z];

      // Propulsor parpadeante: un cubo dorado detrás de la cola
      const llama: Vox[] = Math.floor(t / 110) % 2 === 0 ? [{ x: -9, y: 0, z: 0, c: 3, caras: 63 }] : [];

      const cubos = [...NAVE_VOX, ...llama]
        .map((v) => {
          const p = donde(v);
          return { v, p, z: rot(p[0] * n.dir, p[1], p[2])[2] };
        })
        .sort((a, b) => b.z - a.z); // primero los más lejanos

      for (const { v, p } of cubos) {
        const base = COLOR_VOX[v.c];
        CARAS_CUBO.forEach((f, i) => {
          if (!(v.caras & (1 << i))) return;
          // Normal girada: solo se dibujan las caras que miran a la cámara
          const nr = rot(f.n[0] * n.dir, f.n[1], f.n[2]);
          if (nr[2] >= 0) return;
          // Sombreado plano en tres niveles, como un juego retro
          const d = (nr[0] * LUZ[0] + nr[1] * LUZ[1] + nr[2] * LUZ[2]) / LUZ_N;
          const brillo = d > 0.55 ? 1 : d > 0.15 ? 0.72 : 0.48;
          const pts = f.q.map((q) => {
            const r = rot((p[0] + q[0]) * n.dir, p[1] + q[1], p[2] + q[2]);
            const sc = F / (F + r[2] * u);
            return [n.x + r[0] * u * sc, n.y - r[1] * u * sc] as const;
          });
          ctx.beginPath();
          pts.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
          ctx.closePath();
          ctx.fillStyle = `rgb(${Math.round(base[0] * brillo)},${Math.round(base[1] * brillo)},${Math.round(base[2] * brillo)})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},0.4)`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
          // Cuadrito interior más claro: el aspecto de una ficha de Tetris
          const mx = pts.reduce((a, q) => a + q[0], 0) / 4;
          const my = pts.reduce((a, q) => a + q[1], 0) / 4;
          ctx.beginPath();
          pts.forEach(([px, py], k) => {
            const ix = mx + (px - mx) * 0.55;
            const iy = my + (py - my) * 0.55;
            if (k === 0) ctx.moveTo(ix, iy);
            else ctx.lineTo(ix, iy);
          });
          ctx.closePath();
          ctx.fillStyle = `rgba(255,255,255,${0.1 + brillo * 0.1})`;
          ctx.fill();
        });
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
        nave.estela.push({ x: nave.x - nave.dir * 10 * nave.k, y: nave.y });
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
