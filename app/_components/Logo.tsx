/**
 * Logo de Nasus: sello + nombre.
 *
 * - Sello: cuadrado de esquinas suaves en dorado con una "N" en negativo.
 * - Nombre: NASUS dibujado con un trazo continuo y redondeado, igual que la N
 *   del sello. La "A" es un ángulo abierto en dorado con un nodo cian encima,
 *   como una chispa en la punta (la conexión con los sistemas y la IA).
 *
 * Todo son paths, no texto: se ve idéntico en cualquier dispositivo y la
 * separación entre letras es la misma, sin depender de que cargue una fuente.
 * Las otras direcciones exploradas están en public/logo-opciones.html.
 */

const GOLD = "#c4a882";
const CYAN = "#00f2ff";
const INK = "#050508";

export function LogoSello({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="40" height="40" rx="10" fill={GOLD} />
      <path
        d="M12 30V10L28 30V10"
        stroke={INK}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** NASUS en trazo. `height` es el alto del cuadro; el ancho sale de la proporción. */
export function LogoNombre({ height = 18 }: { height?: number }) {
  return (
    <svg
      height={height}
      viewBox="-3 -3 102 27"
      fill="none"
      role="img"
      aria-label="Nasus"
      style={{ width: "auto", overflow: "visible" }}
    >
      <g stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        {/* N */}
        <path d="M1.5 20V1.5L14.5 20V1.5" />
        {/* S */}
        <path d="M53 5C53 2.5 50.5 1.5 47.5 1.5C44 1.5 41.5 3.2 41.5 6C41.5 9.6 45.2 10 47.5 10.7C50 11.4 53.5 12 53.5 15.5C53.5 18.3 51 20 47.5 20C44.2 20 41.5 18.6 41.5 15.6" />
        {/* U */}
        <path d="M61.5 1.5V13C61.5 17.5 64 20 68 20C72 20 74.5 17.5 74.5 13V1.5" />
        {/* S */}
        <path d="M93 5C93 2.5 90.5 1.5 87.5 1.5C84 1.5 81.5 3.2 81.5 6C81.5 9.6 85.2 10 87.5 10.7C90 11.4 93.5 12 93.5 15.5C93.5 18.3 91 20 87.5 20C84.2 20 81.5 18.6 81.5 15.6" />
      </g>
      {/* A: ángulo abierto en dorado, pegado a sus vecinas, con el nodo arriba. */}
      <path
        d="M19.5 20L28 1.5L36.5 20"
        stroke={GOLD}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* El nodo va EN la punta de la A, no encima: así no se lee como acento. */}
      <circle cx="28" cy="1.5" r="3.2" fill={CYAN} />
    </svg>
  );
}

export default function Logo({
  size = 30,
  showAgency = true,
}: {
  size?: number;
  showAgency?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoSello size={size} />
      <span className="inline-flex flex-col">
        <span className="inline-flex items-start gap-0.5">
          <LogoNombre height={Math.round(size * 0.52)} />
          <span aria-hidden="true" className="mt-[-2px] text-[8px] leading-none text-white/60">
            ®
          </span>
        </span>
        {showAgency && (
          <span className="mt-1.5 font-mono text-[8px] leading-none tracking-[0.5em] text-white/40 max-sm:hidden">
            AGENCY
          </span>
        )}
      </span>
    </span>
  );
}
