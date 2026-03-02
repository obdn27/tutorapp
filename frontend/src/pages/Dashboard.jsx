import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import { getBookings } from "../api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className={`${t.components.container.page}`}>
      <div className={`${t.components.container.content} ${t.components.container.section}`}>
        <div className="flex flex-col gap-6">
          <DashboardHeader />
          <DashboardContent />
        </div>
      </div>
    </div>
  );
}

/** ---------- Header ---------- */

function DashboardHeader() {
  const navigate = useNavigate();
  // Stub: later swap this for `me` from Auth context (`useAuth`)
  const displayName = "Welcome back";

  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className={`${t.typography.h2} truncate`}>{displayName}</h1>
          <p className={`${t.typography.muted} mt-1`}>
            Your sessions, bookings, and next actions in one place.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={() => navigate("/book")}
            className={`${t.components.button.base} ${t.components.button.neutral}`}
          >
            Find tutor
          </button>
          <button
            onClick={() => navigate("/book")}
            className={`${t.components.button.base} ${t.components.button.primary}`}
          >
            Book session
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------- Content ---------- */

function DashboardContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Main column */}
      <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
        <UpcomingSummary />
        <SessionsPanel />
        <QuickActions />
      </div>

      {/* Side column */}
      <div className="lg:col-span-1 flex flex-col gap-6 min-w-0">
        <NotificationsStub />
        <ProfileCompletionStub />
        <AvailabilityStub />
      </div>
    </div>
  );
}

/** ---------- Upcoming summary ---------- */

function UpcomingSummary() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const next48 = now + 48 * 3600 * 1000;

    const upcoming = sessions.filter((s) => {
      const start = new Date(s.start_ts).getTime();
      return start >= now && start <= next48;
    });

    const next = upcoming
      .slice()
      .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts))[0];

    return {
      upcomingCount48: upcoming.length,
      nextSession: next ?? null,
    };
  }, [sessions]);

  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className={t.typography.h3}>Next 48 hours</div>
            <div className={t.typography.muted}>
              {isLoading ? "Loading…" : `${stats.upcomingCount48} session(s) scheduled`}
            </div>
          </div>

          <div className="flex gap-2">
            <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
              This week
            </button>
            <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
              All
            </button>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className={t.typography.muted}>Fetching your upcoming sessions…</div>
          ) : stats.nextSession ? (
            <NextSessionCard session={stats.nextSession} />
          ) : (
            <div className={t.typography.muted}>
              No upcoming sessions. Book one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextSessionCard({ session }) {
  const start = new Date(session.start_ts);
  const end = new Date(session.end_ts);

  const name =
    session.tutor_first_name
      ? `${session.tutor_first_name} ${session.tutor_last_name}`
      : session.student_first_name
        ? `${session.student_first_name} ${session.student_last_name}`
        : "Unknown";

  const badgeClass = statusBadgeClass(session.status);

  return (
    <div className={`${t.components.card.interactive}`}>
      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-bold truncate">Next: {name}</div>
            <span className={`${t.components.badge.base} ${badgeClass} shrink-0`}>
              {session.status}
            </span>
          </div>

          <div className={`${t.typography.muted} mt-1`}>
            {start.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {" · "}
            {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button className={`${t.components.button.base} ${t.components.button.neutral}`}>
            Details
          </button>
          <button className={`${t.components.button.base} ${t.components.button.primary}`}>
            Join
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------- Sessions list panel ---------- */

function SessionsPanel() {
  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  });

  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className={t.typography.h3}>Upcoming sessions</h3>
            <div className={t.typography.muted}>Manage bookings and session status.</div>
          </div>

          <div className="flex gap-2">
            <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
              Upcoming
            </button>
            <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
              Past
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {isLoading && <div className={t.typography.muted}>Loading sessions…</div>}

          {isError && (
            <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
              Failed to load sessions: {String(error)}
            </div>
          )}

          {!isLoading && !isError && sessions.length === 0 && (
            <div className={t.typography.muted}>No sessions yet.</div>
          )}

          {!isLoading &&
            !isError &&
            sessions.map((session) => <SessionRow key={session.id} session={session} />)}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session }) {
  const start = new Date(session.start_ts);
  const end = new Date(session.end_ts);

  const name =
    session.tutor_first_name
      ? `${session.tutor_first_name} ${session.tutor_last_name}`
      : session.student_first_name
        ? `${session.student_first_name} ${session.student_last_name}`
        : "Unknown";

  const badgeClass = statusBadgeClass(session.status);

  return (
    <div className={`${t.components.card.interactive}`}>
      <div className="p-4 flex items-center gap-4">
        {/* time */}
        <div className="w-24 shrink-0 text-center">
          <div className="font-bold leading-none text-slate-900">
            {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className={`${t.typography.faint} leading-none mt-1`}>
            {start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        </div>

        {/* details */}
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate text-slate-900">Session with {name}</div>
          <div className={`${t.typography.muted} truncate mt-0.5`}>
            {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {session.notes ? (
            <div className={`${t.typography.faint} truncate mt-1`}>{session.notes}</div>
          ) : null}
        </div>

        {/* actions */}
        <div className="shrink-0 flex items-center gap-2">
          <span className={`${t.components.badge.base} ${badgeClass}`}>
            {session.status}
          </span>

          <button className={`${t.components.button.base} ${t.components.button.neutral}`}>
            View
          </button>
          <button className={`${t.components.button.base} ${t.components.button.ghost}`}>
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------- Feature stubs ---------- */

function QuickActions() {
  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <h3 className={t.typography.h3}>Quick actions</h3>
        <div className={`${t.typography.muted} mt-1`}>
          Shortcuts you’ll use often. Wire these as you add booking lifecycle.
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button className={`${t.components.card.interactive} text-left`}>
            <div className="p-4">
              <div className="font-bold text-slate-900">Change booking status</div>
              <div className={t.typography.muted}>Confirm / cancel / complete sessions.</div>
            </div>
          </button>

          <button className={`${t.components.card.interactive} text-left`}>
            <div className="p-4">
              <div className="font-bold text-slate-900">Create availability</div>
              <div className={t.typography.muted}>Set weekly hours and time off.</div>
            </div>
          </button>

          <button className={`${t.components.card.interactive} text-left`}>
            <div className="p-4">
              <div className="font-bold text-slate-900">Message</div>
              <div className={t.typography.muted}>Chat tied to each booking (stub).</div>
            </div>
          </button>

          <button className={`${t.components.card.interactive} text-left`}>
            <div className="p-4">
              <div className="font-bold text-slate-900">Payments</div>
              <div className={t.typography.muted}>Hold payment until confirmed (stub).</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsStub() {
  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className={t.typography.h3}>Notifications</h3>
          <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
            Settings
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className={`${t.components.card.muted}`}>
            <div className="p-3">
              <div className="font-bold text-slate-900">Reminder</div>
              <div className={t.typography.muted}>Your next session reminder will appear here.</div>
            </div>
          </div>
          <div className={`${t.components.card.muted}`}>
            <div className="p-3">
              <div className="font-bold text-slate-900">Booking updates</div>
              <div className={t.typography.muted}>Confirmations/cancellations show up here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCompletionStub() {
  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <h3 className={t.typography.h3}>Profile</h3>
        <div className={`${t.typography.muted} mt-1`}>
          Stub: push tutors to add subjects/bio/rate; students to add goals.
        </div>

        <div className="mt-4">
          <div className={`${t.components.card.muted}`}>
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">Complete your profile</div>
                <div className={t.typography.muted}>Add bio, subjects, and hourly rate.</div>
              </div>
              <button className={`${t.components.button.base} ${t.components.button.primary} ${t.components.button.sm}`}>
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailabilityStub() {
  return (
    <div className={`${t.components.card.base}`}>
      <div className="p-5 sm:p-6">
        <h3 className={t.typography.h3}>Availability</h3>
        <div className={`${t.typography.muted} mt-1`}>
          Stub: weekly availability + exceptions (time off).
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className={`${t.components.card.muted}`}>
            <div className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Weekly hours</div>
                <div className={t.typography.muted}>Set when you can be booked.</div>
              </div>
              <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
                Set
              </button>
            </div>
          </div>

          <div className={`${t.components.card.muted}`}>
            <div className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Time off</div>
                <div className={t.typography.muted}>Block specific dates/times.</div>
              </div>
              <button className={`${t.components.button.base} ${t.components.button.neutral} ${t.components.button.sm}`}>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------- util ---------- */

function statusBadgeClass(status) {
  switch (status) {
    case "confirmed":
      return t.components.badge.success;
    case "requested":
      return t.components.badge.brand;
    case "canceled":
    case "rejected":
      return t.components.badge.error;
    case "completed":
      return t.components.badge.neutral;
    default:
      return t.components.badge.neutral;
  }
}