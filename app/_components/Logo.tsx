/**
 * Logo de Nasus: una "N" dibujada con un solo hilo continuo que termina en un
 * nodo. El hilo es la parte artesanal (un trazo hecho a mano, de una sola
 * pasada); el nodo es la conexión con los sistemas y la IA.
 *
 * El trazo es un path, no una fuente: escala igual en cualquier tamaño y no
 * depende de que cargue una tipografía. Las otras direcciones exploradas están
 * en public/logo-opciones.html.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Hilo: sube, baja en diagonal y vuelve a subir, sin levantar el pincel. */}
      <path
        d="M9 32V9L31 31V12"
        stroke="#c4a882"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Nodo: el punto donde el hilo se conecta. */}
      <circle cx="31" cy="8" r="3.6" fill="#050508" stroke="#00f2ff" strokeWidth="2" />
    </svg>
  );
}

export default function Logo({
  size = 28,
  showAgency = true,
}: {
  size?: number;
  showAgency?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="inline-flex flex-col leading-none">
        <span className="font-display text-[15px] max-md:text-[14px] font-bold tracking-[0.22em] text-white">
          NASUS<sup className="text-[0.55em] align-super ml-0.5 tracking-normal">®</sup>
        </span>
        {showAgency && (
          <span className="mt-1 font-mono text-[8px] tracking-[0.42em] text-white/40 max-sm:hidden">
            AGENCY
          </span>
        )}
      </span>
    </span>
  );
}
