"use client";

import type { PhotoAnalysisResult, PhotoConfig, RuleResult } from "@/lib/photos/types";

interface Props {
  result: PhotoAnalysisResult;
  config: PhotoConfig;
}

const VERDICT_CONFIG = {
  APTA: {
    label: "APTA",
    description: "La fotografía cumple todos los requisitos",
    classes: "bg-emerald-950/40 border-emerald-800 text-emerald-300",
    iconPath: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    iconColor: "text-emerald-400",
  },
  NO_APTA: {
    label: "NO APTA",
    description: "La fotografía no cumple requisitos obligatorios",
    classes: "bg-red-950/40 border-red-800 text-red-300",
    iconPath: "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    iconColor: "text-red-400",
  },
  REVISAR: {
    label: "REVISAR",
    description: "Cumple los requisitos principales pero tiene observaciones",
    classes: "bg-amber-950/40 border-amber-800 text-amber-300",
    iconPath: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
    iconColor: "text-amber-400",
  },
};

function RuleRow({
  rule,
  result,
}: {
  rule: PhotoConfig["rules"][number];
  result: RuleResult | undefined;
}) {
  const pass = result?.pass ?? true;
  const note = result?.note ?? "";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-2.5 ${
        pass ? "" : rule.required ? "bg-red-950/20" : "bg-amber-950/20"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {pass ? (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : rule.required ? (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-mono ${pass ? "text-zinc-300" : rule.required ? "text-red-300" : "text-amber-300"}`}>
          {rule.label}
        </p>
        {note && !pass && (
          <p className="text-xs text-zinc-500 font-mono mt-0.5">{note}</p>
        )}
      </div>
      {!rule.required && (
        <span className="shrink-0 text-[10px] font-mono text-zinc-600 uppercase">opcional</span>
      )}
    </div>
  );
}

export default function PhotoResult({ result, config }: Props) {
  const verdict = VERDICT_CONFIG[result.verdict];

  return (
    <div className="flex flex-col gap-4 w-full">
      <p className="text-xs font-mono text-[#00f2ff] uppercase tracking-[0.2em]">
        {config.name}
        {config.institution && (
          <span className="text-zinc-600 ml-2 normal-case tracking-normal">
            · {config.institution}
          </span>
        )}
      </p>

      <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${verdict.classes}`}>
        <svg className={`w-7 h-7 shrink-0 ${verdict.iconColor}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={verdict.iconPath} />
        </svg>
        <div>
          <p className="font-bold font-mono text-xl tracking-widest">{verdict.label}</p>
          <p className="text-xs opacity-70 font-mono mt-0.5">{verdict.description}</p>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-zinc-800">
        <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#c4a882]">
            Revisión de requisitos
          </p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {config.rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              result={result.ruleResults[rule.id]}
            />
          ))}
        </div>
      </div>

      {result.suggestions.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
            Sugerencias
          </p>
          <ul className="flex flex-col gap-1.5">
            {result.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400 font-mono">
                <span className="mt-0.5 shrink-0 text-[#c4a882]">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
