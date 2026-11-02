import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Clock } from "lucide-react";
import Loader from "@/components/ui/Loader";
import { events as eventsApi } from "@/lib/api";

export default function EventsAttendedSection() {
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.list()
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        // Show events where user has registered (user_registration exists)
        const attended = all.filter(e => e.user_registration && e.user_registration.status === "attended");
        const registered = all.filter(e => e.user_registration && e.user_registration.status !== "cancelled" && e.user_registration.status !== "attended");
        setEventsList([...attended, ...registered].slice(0, 8));
      })
      .catch(() => setEventsList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
      <h3 className="text-lg text-text-primary">My events</h3>
      {loading ? (
        <div className="mt-4 flex justify-center"><Loader variant="dots" size="sm" /></div>
      ) : eventsList.length === 0 ? (
        <div className="mt-3">
          <p className="text-[13px] text-text-dim">You haven&apos;t registered for an event yet.</p>
          <Link to="/events" className="mt-2 inline-flex h-10 items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            Browse events <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <ul data-stagger="left" className="mt-3 space-y-1">
            {eventsList.map(ev => {
              const status = ev.user_registration?.status;
              const when = ev.starts_at || ev.date;
              return (
                <li key={ev.id} className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-2">
                  {when ? (
                    <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-primary/25 bg-primary/[0.07] py-1 leading-none text-primary">
                      <span className="text-[11px]">{new Date(when).toLocaleDateString(undefined, { month: "short" })}</span>
                      <span className="lamp-numerals mt-0.5 text-base">{new Date(when).getDate()}</span>
                    </span>
                  ) : (
                    <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-text-dim">
                      {status === "attended" ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Clock className="h-4 w-4" strokeWidth={1.75} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{ev.title}</p>
                    {ev.xp_reward > 0 && <p className="text-[12px] tabular-nums text-primary">+{ev.xp_reward} XP</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] capitalize ${
                    status === "attended" ? "bg-success/10 text-success"
                    : status === "waitlisted" ? "bg-warning/10 text-warning"
                    : "bg-secondary/12 text-secondary"
                  }`}>
                    {status || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link to="/events" className="mt-2 inline-flex h-10 items-center gap-1 text-[13px] font-medium text-primary transition hover:text-text-primary">
            View all events <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}
