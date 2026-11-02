import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "lucide-react";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/lamp";

const STATE_STYLE = {
  live: "bg-success/12 text-success",
  ended: "bg-white/[0.05] text-text-dim",
  upcoming: "bg-warning/12 text-warning",
};

function fmt(d) {
  return d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function TestsList({ tests, testsLoading, deletingId, handleDeleteTest }) {
  return (
    <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl text-text-primary">Existing tests</h2>
        {!testsLoading && tests.length > 0 ? (
          <span className="text-[13px] tabular-nums text-text-dim">{tests.length} scheduled</span>
        ) : null}
      </div>

      {testsLoading ? (
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-[rgb(var(--rule))] bg-surface/30" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <EmptyState
          compact
          className="mt-4 border-none bg-transparent"
          title="No scheduled tests yet"
          body="Create one above: give it a title, a time window and at least one challenge."
        />
      ) : (
        <ul data-stagger="up" className="mt-4 divide-y divide-[rgb(var(--rule))]">
          <AnimatePresence initial={false}>
            {tests.map((test) => {
              const isActive =
                new Date(test.startDate) <= new Date() &&
                new Date(test.endDate) >= new Date();
              const isPast = new Date(test.endDate) < new Date();
              const state = isActive ? "live" : isPast ? "ended" : "upcoming";

              return (
                <motion.li
                  key={test._id}
                  layout
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {test.title || "Untitled Test"}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATE_STYLE[state]}`}>
                        {state === "live" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> : null}
                        {isActive ? "Live" : isPast ? "Ended" : "Upcoming"}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-text-dim">
                      <span className="tabular-nums">{test.challenges?.length || 0} challenges</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                        {fmt(test.startDate)} to {fmt(test.endDate)}
                      </span>
                    </p>
                    {test.description && (
                      <p className="mt-1 line-clamp-1 text-[13px] text-text-muted">
                        {test.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteTest(test._id)}
                    loading={deletingId === test._id}
                    className="self-start sm:self-auto"
                  >
                    Delete
                  </Button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
