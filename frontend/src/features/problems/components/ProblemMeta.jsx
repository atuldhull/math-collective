/**
 * ProblemMeta — the small identity marks a problem carries everywhere:
 * a hued source badge and a three-step difficulty meter.
 */

// Each source gets one hue, used as a dot + tinted label. Tuned to sit
// on graphite paper without shouting over the accent.
export const SOURCE_HUE = {
  SIH:        "251 146 60",
  GSoC:       "52 211 153",
  Kaggle:     "96 165 250",
  MLH:        "244 114 182",
  Devfolio:   "167 139 250",
  Unstop:     "250 204 21",
  OpenSource: "148 163 184",
};

const DIFFICULTY_STEP = { beginner: 1, intermediate: 2, advanced: 3 };
const DIFFICULTY_TONE = {
  beginner:     "rgb(var(--color-success))",
  intermediate: "rgb(var(--lamp))",
  advanced:     "rgb(var(--color-danger))",
};

export function SourceBadge({ source, event }) {
  const h = SOURCE_HUE[source] || SOURCE_HUE.OpenSource;
  const ev = event ? event.replace(source + " ", "") : "";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-xs font-medium"
      style={{ background: `rgb(${h} / 0.1)`, color: `rgb(${h})`, boxShadow: `inset 0 0 0 1px rgb(${h} / 0.28)` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `rgb(${h})` }} />
      <span className="truncate">{source}{ev ? <span className="opacity-70"> {ev}</span> : null}</span>
    </span>
  );
}

export function DifficultyMeter({ level }) {
  const step = DIFFICULTY_STEP[level] || 0;
  const tone = DIFFICULTY_TONE[level] || "rgb(var(--rule))";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-text-muted" title={level}>
      <span aria-hidden="true" className="flex items-end gap-[3px]">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="w-[3px] rounded-full"
            style={{ height: 4 + n * 3, background: n <= step ? tone : "rgb(var(--rule))" }}
          />
        ))}
      </span>
      {level}
    </span>
  );
}

