import { CheckCircle2, Flame, Medal, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

function Value({ value }) {
  // Numbers count up; strings ("--", "87%", a title) render as-is.
  if (typeof value === "number") return <AnimatedNumber value={value} duration={1.3} />;
  return value;
}

export default function ActivityStatsCard({ xp, level, stats, currentTitle }) {
  const items = [
    { label: "XP earned", value: xp, icon: Zap, accent: true },
    { label: "Level", value: level, icon: Star },
    { label: "Quizzes taken", value: stats?.quizzesTaken ?? stats?.testsAttempted ?? "--", icon: CheckCircle2 },
    {
      label: "Accuracy",
      value:
        stats?.accuracy != null
          ? `${Math.round(stats.accuracy)}%`
          : stats?.correctAnswers != null && stats?.totalAnswers
            ? `${Math.round((stats.correctAnswers / stats.totalAnswers) * 100)}%`
            : "--",
      icon: Target,
    },
    { label: "Challenges solved", value: stats?.challengesSolved ?? stats?.arenaAttempts ?? "--", icon: Trophy },
    { label: "Current streak", value: stats?.streak ?? stats?.currentStreak ?? "--", icon: Flame },
    { label: "Best streak", value: stats?.bestStreak ?? stats?.longestStreak ?? "--", icon: Sparkles },
    { label: "Rank", value: stats?.rank ?? currentTitle.title, icon: Medal },
  ];

  return (
    <section data-reveal="up" className="lamp-panel p-5 sm:p-7">
      <h2 className="text-xl text-text-primary sm:text-2xl">Your stats</h2>

      {/* A ruled table rather than eight identical cards: cells share
          hairlines, the XP cell carries the lamp. */}
      <div
        data-stagger="scale"
        className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[rgb(var(--rule))] sm:grid-cols-4 [&>*]:border-[rgb(var(--rule))] [&>*]:border-b [&>*]:border-r"
      >
        {items.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className={`-mb-px -mr-px px-4 py-4 ${accent ? "bg-primary/[0.07]" : ""}`}>
            <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
              <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-text-dim"}`} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </p>
            <p className={`lamp-numerals mt-1.5 truncate text-2xl ${accent ? "text-primary" : "text-text-primary"}`}>
              <Value value={value} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
