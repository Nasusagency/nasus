"use client";

import { useId, useSyncExternalStore } from "react";

import { SimboloFormas } from "./Logo";

/**
 * Sistema de órbitas dibujado a lápiz: el lápiz entre corchetes es el "sol" y
 * tres planetas dan vueltas a su alrededor. Decorativo, para la portada.
 *
 * Los planetas se mueven con SMIL (animateMotion): así siguen siendo círculos
 * perfectos mientras recorren la elipse. Con `prefers-reduced-motion` se
 * quedan quietos en su posición inicial.
 */

const suscribir = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const leer = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const enServidor = () => false;

const C = 250;

/** Elipse como path (para que animateMotion pueda recorrerla). */
const elipse = (rx: number, ry: number) =>
  `M${C - rx} ${C} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

const BRILLO =
  "M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8Z";

const TONOS = {
  dark: { tinta: "#ffffff", dorado: "#c4a882", cian: "#00f2ff", cianPlaneta: "#00f2ff", brazos: "#00f2ff" },
  light: { tinta: "#0d0d14", dorado: "#b08434", cian: "#009fa8", cianPlaneta: "#00c2cf", brazos: "#009fa8" },
} as const;

export default function OrbitSketch({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const T = TONOS[tone];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const quieto = useSyncExternalStore(suscribir, leer, enServidor);

  const planeta = (
    id: string,
    rx: number,
    ry: number,
    dur: number,
    r: number,
    fill: string,
    sentido: 1 | -1 = 1,
    anillo = false,
  ) => (
    <g key={id}>
      {!quieto && (
        <animateMotion
          dur={`${dur}s`}
          repeatCount="indefinite"
          path={elipse(rx, ry)}
          keyPoints={sentido === 1 ? "0;1" : "1;0"}
          keyTimes="0;1"
          calcMode="linear"
        />
      )}
      <circle r={r} fill={fill} cx={quieto ? C + rx : 0} cy={quieto ? C : 0} />
      {anillo && (
        <ellipse
          rx={r * 1.9}
          ry={r * 0.6}
          fill="none"
          stroke={T.tinta}
          strokeOpacity=".55"
          strokeWidth="1.2"
          cx={quieto ? C + rx : 0}
          cy={quieto ? C : 0}
          transform={quieto ? undefined : "rotate(-20)"}
        />
      )}
    </g>
  );

  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      aria-hidden="true"
      fill="none"
      focusable="false"
    >
      {/* Órbitas: punteada, dorada continua y de trazos largos */}
      <g transform={`rotate(-18 ${C} ${C})`}>
        <path d={elipse(236, 94)} stroke={T.tinta} strokeOpacity=".3" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 8" />
        <path d={elipse(180, 72)} stroke={T.dorado} strokeOpacity=".6" strokeWidth="1.2" />
        <path d={elipse(126, 50)} stroke={T.tinta} strokeOpacity=".28" strokeWidth="1.2" strokeDasharray="10 8" />
      </g>
      <g transform={`rotate(42 ${C} ${C})`}>
        <path d={elipse(205, 58)} stroke={T.cian} strokeOpacity=".35" strokeWidth="1.1" strokeDasharray="2 6" strokeLinecap="round" />
      </g>

      {/* Destellos */}
      <g fill={T.dorado}>
        <path className="twinkle" style={{ animationDelay: "0s" }} transform="translate(70 120)" d={BRILLO} />
        <path className="twinkle" style={{ animationDelay: "1.1s" }} transform="translate(430 90) scale(.8)" d={BRILLO} fill={T.cian} />
        <path className="twinkle" style={{ animationDelay: "2.2s" }} transform="translate(455 400) scale(.6)" d={BRILLO} />
        <path className="twinkle" style={{ animationDelay: "0.6s" }} transform="translate(60 410) scale(.9)" d={BRILLO} fill={T.cian} />
      </g>

      {/* Sol: lápiz entre corchetes */}
      <g transform={`translate(${C} ${C}) scale(.4) translate(-400 -290)`}>
        <SimboloFormas uid={uid} bracket={T.brazos} />
      </g>

      {/* Planetas */}
      <g transform={`rotate(-18 ${C} ${C})`}>
        {planeta("p1", 236, 94, 40, 8, T.dorado)}
        {planeta("p2", 180, 72, 27, 5.5, T.cianPlaneta, -1)}
        {planeta("p3", 126, 50, 18, 4.2, T.tinta, 1, true)}
      </g>
    </svg>
  );
}
