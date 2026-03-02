import { useMemo, useState } from "react"
import { lightTheme as t } from "../assets/theme"
import { CalendarDays, Clock, NotebookPen, User, PoundSterling, X } from "lucide-react"
import { createBooking } from "../api"

export function BookingSidebar({ selectedTutor, onClearTutor, isSubmitting }) {
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [notes, setNotes] = useState("")

  const canSubmit = useMemo(() => {
    if (!selectedTutor) return false
    if (!date || !startTime || !endTime) return false
    return endTime > startTime
  }, [selectedTutor, date, startTime, endTime])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    const startTs = new Date(`${date}T${startTime}`).getTime()
    const endTs = new Date(`${date}T${endTime}`).getTime()

    await createBooking({
      tutor_id: selectedTutor.id,
      start_ts: startTs,
      end_ts: endTs,
      notes,
    })

    // keep date, clear the rest (your choice)
    setNotes("")
    setStartTime("")
    setEndTime("")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className={t.typography.heading}>Make a booking</div>
        <div className={t.typography.muted}>
          {selectedTutor ? "Fill in the details below." : "Pick a tutor from the list."}
        </div>
      </div>

      {!selectedTutor ? (
        <EmptyState />
      ) : (
        <>
          <TutorSummary tutor={selectedTutor} onClearTutor={onClearTutor} />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Date" icon={<CalendarDays className="w-4 h-4 opacity-60" />}>
              <input
                type="date"
                className={t.components.input.base}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" icon={<Clock className="w-4 h-4 opacity-60" />}>
                <input
                  type="time"
                  className={t.components.input.base}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>

              <Field label="End" icon={<Clock className="w-4 h-4 opacity-60" />}>
                <input
                  type="time"
                  className={t.components.input.base}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Notes (optional)" icon={<NotebookPen className="w-4 h-4 opacity-60" />}>
              <textarea
                rows={5}
                className={t.components.input.base}
                placeholder="Anything the tutor should know…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {!canSubmit && (
              <div className={t.typography.muted}>
                Fill the date, start time, and end time (end must be after start).
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={`${t.components.button.primary} w-full`}
            >
              {isSubmitting ? "Booking…" : "Request booking"}
            </button>

            <div className={t.typography.muted}>
              Booking will be created with status <span className="font-semibold">requested</span>.
            </div>
          </form>

          {/* Stubs for later */}
          <div className={`${t.components.card.base} p-4`}>
            <div className="font-bold">Policy (stub)</div>
            <div className={t.typography.muted}>
              Add cancellation window, working hours, and clash checks messaging here.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className={`${t.components.card.base} p-4`}>
      <div className="flex items-center gap-2 font-semibold">
        <User className="w-4 h-4 opacity-60" />
        Pick a tutor to book
      </div>
      <div className={`${t.typography.muted} mt-1`}>
        Select a tutor from the grid and their details will show here.
      </div>
    </div>
  )
}

function TutorSummary({ tutor, onClearTutor }) {
  const fullName = `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim() || "Unnamed tutor"

  return (
    <div className={`${t.components.card.base} p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold truncate">{fullName}</div>
          <div className={`${t.typography.muted} truncate`}>{tutor.email ?? "No email"}</div>
        </div>

        <div className={`${t.components.badge} shrink-0`}>
          <span className="inline-flex items-center gap-1.5">
            <PoundSterling className="w-4 h-4 opacity-60" />
            <span className="font-semibold">{tutor.hourly_gbp ?? "-"}/hr</span>
          </span>
        </div>
      </div>

      {Array.isArray(tutor.subjects) && tutor.subjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tutor.subjects.slice(0, 6).map((s) => (
            <span key={s} className={t.components.badge}>
              {s}
            </span>
          ))}
          {tutor.subjects.length > 6 && (
            <span className={t.components.badge}>+{tutor.subjects.length - 6}</span>
          )}
        </div>
      ) : (
        <div className={t.typography.muted}>No subjects listed.</div>
      )}

      <button
        type="button"
        onClick={onClearTutor}
        className={`${t.components.button.ghostBase} ${t.components.button.ghostHover} w-full justify-start`}
      >
        <X className="w-4 h-4" />
        Clear selected tutor
      </button>
    </div>
  )
}

function Field({ label, icon, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className={`${t.components.input.label} flex items-center gap-2`}>
        <span className="opacity-70">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}