import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { lightTheme as t } from "../assets/theme"
import { getBookings } from "../api"

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6 h-screen">
      <DashboardHeader />
      <DashboardContent />
    </div>
  )
}

/** ---------- Header ---------- */

function DashboardHeader() {
  // Stub: later swap this for `me` from Auth context (`useAuth`)
  const displayName = "Welcome back!"

  return (
    <div className={`${t.components.card.base} p-5 flex items-start justify-between gap-4 mt-4`}>
      <div className="min-w-0">
        <h1 className={`${t.typography.huge} truncate`}>{displayName}</h1>
        <p className={`${t.typography.muted}`}>
          Your sessions, bookings, and next actions in one place.
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        {/* Stubs: wire these to real flows */}
        <button className={t.components.button.secondary}>Find tutor</button>
        <button className={t.components.button.primary}>Book session</button>
      </div>
    </div>
  )
}

/** ---------- Content ---------- */

function DashboardContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main column */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <UpcomingSummary />
        <SessionsPanel />
        <QuickActions />
      </div>

      {/* Side column */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        <NotificationsStub />
        <ProfileCompletionStub />
        <AvailabilityStub />
      </div>
    </div>
  )
}

/** ---------- Upcoming summary ---------- */

function UpcomingSummary() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  })

  const stats = useMemo(() => {
    const now = Date.now()
    const next48 = now + 48 * 3600 * 1000

    const upcoming = sessions.filter((s) => {
      const start = new Date(s.start_ts).getTime()
      return start >= now && start <= next48
    })

    const next = upcoming
      .slice()
      .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts))[0]

    return {
      upcomingCount48: upcoming.length,
      nextSession: next ?? null,
    }
  }, [sessions])

  return (
    <div className={`${t.components.card.base} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`${t.typography.heading}`}>Next 48 hours</div>
          <div className={`${t.typography.muted}`}>
            {isLoading ? "Loading…" : `${stats.upcomingCount48} session(s) scheduled`}
          </div>
        </div>

        {/* Stub: later add filters */}
        <div className="flex gap-2">
          <button className={t.components.button.secondary}>This week</button>
          <button className={t.components.button.secondary}>All</button>
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
  )
}

function NextSessionCard({ session }) {
  const start = new Date(session.start_ts)
  const end = new Date(session.end_ts)

  const name =
    session.tutor_first_name
      ? `${session.tutor_first_name} ${session.tutor_last_name}`
      : session.student_first_name
        ? `${session.student_first_name} ${session.student_last_name}`
        : "Unknown"

  return (
    <div className={`${t.components.card.interactive} p-4 flex items-center justify-between gap-4`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-bold truncate">Next: {name}</div>
          <span className={`${t.components.badge}`}>{session.status}</span>
        </div>
        <div className={t.typography.muted}>
          {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          {" · "}
          {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          {" – "}
          {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        {/* Stubs: wire up */}
        <button className={t.components.button.secondary}>Details</button>
        <button className={t.components.button.primary}>Join</button>
      </div>
    </div>
  )
}

/** ---------- Sessions list panel ---------- */

function SessionsPanel() {
  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  })

  return (
    <div className={`${t.components.card.base} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`${t.typography.heading}`}>Upcoming sessions</h3>
          <div className={t.typography.muted}>Manage bookings and session status.</div>
        </div>

        {/* Stub: session list filters */}
        <div className="flex gap-2">
          <button className={t.components.button.secondary}>Upcoming</button>
          <button className={t.components.button.secondary}>Past</button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <div className={t.typography.muted}>Loading sessions…</div>}

        {isError && (
          <div className={t.typography.muted}>
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
  )
}

function SessionRow({ session }) {
  const start = new Date(session.start_ts)
  const end = new Date(session.end_ts)

  const name =
    session.tutor_first_name
      ? `${session.tutor_first_name} ${session.tutor_last_name}`
      : session.student_first_name
        ? `${session.student_first_name} ${session.student_last_name}`
        : "Unknown"

  return (
    <div className={`${t.components.card.interactive} p-4 flex items-center gap-4`}>
      {/* time */}
      <div className="w-24 shrink-0 text-center">
        <div className="font-bold leading-none">
          {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className={`${t.typography.muted} leading-none mt-1`}>
          {start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </div>
      </div>

      {/* details */}
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate">Session with {name}</div>
        <div className={`${t.typography.muted} truncate`}>
          {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          {" – "}
          {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>

        {session.notes && <div className={`${t.typography.muted} truncate mt-1`}>{session.notes}</div>}
      </div>

      {/* right actions */}
      <div className="shrink-0 flex items-center gap-2">
        <span className={`${t.components.badge}`}>{session.status}</span>

        {/* Stubs: wire up based on role + status */}
        <button className={t.components.button.secondary}>View</button>
        <button className={t.components.button.secondary}>Reschedule</button>
      </div>
    </div>
  )
}

/** ---------- Feature stubs ---------- */

function QuickActions() {
  return (
    <div className={`${t.components.card.base} p-5`}>
      <h3 className={t.typography.heading}>Quick actions</h3>
      <div className={`${t.typography.muted} mt-1`}>
        Shortcuts you’ll use often. Wire these as you add booking lifecycle.
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className={`${t.components.card.interactive} p-4 text-left`}>
          <div className="font-bold">Change booking status</div>
          <div className={t.typography.muted}>Confirm / cancel / complete sessions.</div>
        </button>

        <button className={`${t.components.card.interactive} p-4 text-left`}>
          <div className="font-bold">Create availability</div>
          <div className={t.typography.muted}>Set weekly hours and time off.</div>
        </button>

        <button className={`${t.components.card.interactive} p-4 text-left`}>
          <div className="font-bold">Message</div>
          <div className={t.typography.muted}>Chat tied to each booking (stub).</div>
        </button>

        <button className={`${t.components.card.interactive} p-4 text-left`}>
          <div className="font-bold">Payments</div>
          <div className={t.typography.muted}>Hold payment until confirmed (stub).</div>
        </button>
      </div>
    </div>
  )
}

function NotificationsStub() {
  return (
    <div className={`${t.components.card.base} p-5`}>
      <div className="flex items-start justify-between">
        <h3 className={t.typography.heading}>Notifications</h3>
        <button className={t.components.button.secondary}>Settings</button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {/* Stub list items */}
        <div className={`${t.components.card.interactive} p-3`}>
          <div className="font-bold">Reminder</div>
          <div className={t.typography.muted}>Your next session reminder will appear here.</div>
        </div>
        <div className={`${t.components.card.interactive} p-3`}>
          <div className="font-bold">Booking updates</div>
          <div className={t.typography.muted}>Confirmations/cancellations show up here.</div>
        </div>
      </div>
    </div>
  )
}

function ProfileCompletionStub() {
  return (
    <div className={`${t.components.card.base} p-5`}>
      <h3 className={t.typography.heading}>Profile</h3>
      <div className={`${t.typography.muted} mt-1`}>
        Stub: use this to push tutors to add subjects, rate, bio; students to add goals.
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className={`${t.components.card.interactive} p-3 flex items-center justify-between`}>
          <div className="min-w-0">
            <div className="font-bold truncate">Complete your profile</div>
            <div className={t.typography.muted}>Add bio, subjects, and hourly rate.</div>
          </div>
          <button className={t.components.button.primary}>Edit</button>
        </div>
      </div>
    </div>
  )
}

function AvailabilityStub() {
  return (
    <div className={`${t.components.card.base} p-5`}>
      <h3 className={t.typography.heading}>Availability</h3>
      <div className={`${t.typography.muted} mt-1`}>
        Stub: weekly availability + exceptions (time off).
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className={`${t.components.card.interactive} p-3 flex items-center justify-between`}>
          <div>
            <div className="font-bold">Weekly hours</div>
            <div className={t.typography.muted}>Set when you can be booked.</div>
          </div>
          <button className={t.components.button.secondary}>Set</button>
        </div>

        <div className={`${t.components.card.interactive} p-3 flex items-center justify-between`}>
          <div>
            <div className="font-bold">Time off</div>
            <div className={t.typography.muted}>Block specific dates/times.</div>
          </div>
          <button className={t.components.button.secondary}>Add</button>
        </div>
      </div>
    </div>
  )
}