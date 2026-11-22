import { useId } from "react";

/**
 * Logo de Nasus: lápiz entre corchetes de código + NASUS en bloque.
 *
 * - El lápiz es lo artesanal y conservador: así trabajamos.
 * - Los corchetes `< >` son el código y la IA: el toque juguetón.
 * - La punta del lápiz es cian, el mismo color de los corchetes: une las dos ideas.
 *
 * Todo son paths (sin fuentes): se ve idéntico en cualquier dispositivo.
 * El letrero NASUS se dibuja a mano, con esquinas cortadas, en estilo universitario.
 */

const GOLD = "#c4a882";
const GOLD_L = "#ecdcb9";
const GOLD_D = "#a88b5c";
const CYAN = "#00f2ff";
const CYAN_L = "#009fa8";
const INK = "#0d0d14";

const BLOCK: Record<string, string> = {
  N: "M0 0H24L56 52V0H80V100H56L24 48V100H0Z",
  A: "M0 100V28L14 0H66L80 28V100H56V72H24V100ZM26 24V48H54V24Z",
  S: "M0 0H80V22H24V39H80V100H0V78H56V61H0Z",
  U: "M0 0H24V72H56V0H80V92L72 100H8L0 92Z",
};

/** Lápiz inclinado + corchetes, centrados en (400, 290). Reutilizable en otras ilustraciones. */
export function SimboloFormas({
  uid,
  bracket = CYAN_L,
  lead = CYAN,
}: {
  uid: string;
  bracket?: string;
  lead?: string;
}) {
  return (
    <>
      <defs>
        <linearGradient id={`lp-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={GOLD_D} />
          <stop offset=".5" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_L} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={bracket} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="267,215 205,290 267,365" />
        <polyline points="533,215 595,290 533,365" />
      </g>
      <g transform="translate(400 290) rotate(25)">
        <path d="M-39 -128 a39 11 0 0 1 78 0 V60 H-39Z" fill={`url(#lp-${uid})`} />
        <ellipse cx="0" cy="-128" rx="39" ry="11" fill={GOLD_L} />
        <ellipse cx="0" cy="-128" rx="26" ry="6.5" fill={GOLD_D} />
        <path d="M-39 60 H39 L0 138Z" fill="#f3e9d2" />
        <path d="M0 60 H39 L0 138Z" fill="#d9c79f" opacity=".7" />
        <path d="M-14 110 H14 L0 138Z" fill={lead} />
      </g>
    </>
  );
}

export function LogoSimbolo({
  height = 36,
  tone = "light",
}: {
  height?: number;
  tone?: "light" | "dark";
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      height={height}
      viewBox="184 139 432 302"
      fill="none"
      aria-hidden="true"
      style={{ width: "auto" }}
      className="shrink-0"
    >
      <SimboloFormas uid={uid} bracket={tone === "light" ? CYAN_L : CYAN} />
    </svg>
  );
}

export function LogoLetrero({
  height = 15,
  tone = "light",
}: {
  height?: number;
  tone?: "light" | "dark";
}) {
  const color = tone === "light" ? INK : "#ffffff";
  const gap = 14;
  return (
    <svg
      height={height}
      viewBox="0 0 456 100"
      fill={color}
      role="img"
      aria-label="Nasus"
      style={{ width: "auto" }}
    >
      {"NASUS".split("").map((ch, i) => (
        <path key={i} transform={`translate(${i * (80 + gap)} 0)`} d={BLOCK[ch]} />
      ))}
    </svg>
  );
}

export default function Logo({
  height = 36,
  tone = "light",
}: {
  height?: number;
  tone?: "light" | "dark";
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoSimbolo height={height} tone={tone} />
      <LogoLetrero height={Math.round(height * 0.42)} tone={tone} />
    </span>
  );
}
