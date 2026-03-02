import { dataClient, endpoints } from "../api"
import { lightTheme as t } from "../assets/theme"
import { useEffect, useMemo, useState } from "react"
import { Mail, PoundSterling, BookOpen, User, Star } from "lucide-react"
import { BookingSidebar } from "../components/BookingSidebar"

export default function Book() {
  const [tutors, setTutors] = useState([])
  const [currentTutor, setCurrentTutor] = useState(null)

  async function updateTutors() {
    // endpoints.tutors already contains full URL in your api.js
    const res = await dataClient.get(endpoints.tutors)
    setTutors(res.data ?? [])
  }

  useEffect(() => {
    updateTutors()
  }, [])

  const selectedTutorLabel = useMemo(() => {
    if (!currentTutor) return "No tutor selected"
    const fn = currentTutor.first_name ?? ""
    const ln = currentTutor.last_name ?? ""
    return `${fn} ${ln}`.trim() || "Selected tutor"
  }, [currentTutor])

  return (
    <div className="min-h-screen flex flex-col pt-4">
      {/* Page header */}
      <div className={`${t.components.card.base} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className={t.typography.huge}>Book a session</h1>
            <p className={t.typography.muted}>
              Pick a tutor, then choose a time and create a booking.
            </p>
          </div>

          {/* Stub controls (wire later): search / filters */}
          <div className="flex gap-2 shrink-0">
            <button className={t.components.button.secondary}>Filters</button>
            <button className={t.components.button.secondary}>Sort</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4">
        {/* Tutors list */}
        <section className="flex-1 min-w-0">
          <div className={`${t.components.card.base} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={t.typography.heading}>Tutors</h2>
                <div className={t.typography.muted}>
                  {tutors.length} available
                </div>
              </div>

              {/* Stub: add a search input later */}
              <button className={t.components.button.secondary}>Search</button>
            </div>
          </div>

          <div className="mt-4">
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {tutors.map((tutor) => (
                <TutorCard
                  key={tutor.id}
                  tutor={tutor}
                  selected={currentTutor?.id === tutor.id}
                  onClick={() => setCurrentTutor(tutor)}
                />
              ))}
            </ul>

            {tutors.length === 0 && (
              <div className={`${t.typography.muted} mt-6`}>
                No tutors found.
              </div>
            )}
          </div>
        </section>

        {/* Sidebar panel (NOT fixed yet) */}
        <aside className="w-full lg:w-96 shrink-0">
          <div className={`${t.components.card.base} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className={t.typography.heading}>Booking</h2>
                <div className={`${t.typography.muted} truncate`}>
                  {selectedTutorLabel}
                </div>
              </div>

              {currentTutor && (
                <button
                  className={t.components.button.secondary}
                  onClick={() => setCurrentTutor(null)}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className={`${t.components.card.base} p-4`}>
              <BookingSidebar
                selectedTutor={currentTutor}
                onClearTutor={() => setCurrentTutor(null)}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TutorCard({ tutor, onClick, selected }) {
  const fullName = `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim()
  const avgRating =
    tutor.no_ratings && tutor.no_ratings > 0
      ? tutor.rating_sum / tutor.no_ratings
      : null

  // Use your interactive card token, and add a subtle “selected” emphasis.
  // (No hardcoded colors; just use ring utility if your theme doesn't have a token for selected.)
  const base = t.components.card.interactive
  const selectedClass = selected ? "ring-2 ring-black/10" : ""

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${selectedClass} text-left w-full`}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 opacity-60" />
              <h3 className={`${t.typography.heading} text-base truncate`}>
                {fullName || "Unnamed tutor"}
              </h3>
            </div>

            <div className="mt-2 flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 opacity-60" />
              <div className={`${t.typography.muted} truncate`}>
                {tutor.email || "No email"}
              </div>
            </div>
          </div>

          {/* rating */}
          <div className={`${t.components.badge} shrink-0`}>
            <span className="inline-flex items-center gap-1.5">
              <Star className="w-4 h-4 opacity-70" />
              <span className="font-bold">
                {avgRating === null ? "—" : avgRating.toFixed(1)}
              </span>
              <span className="opacity-70">({tutor.no_ratings ?? 0})</span>
            </span>
          </div>
        </div>

        {/* price + subjects */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 font-semibold">
            <PoundSterling className="w-4 h-4 opacity-60" />
            <span>{tutor.hourly_gbp ?? "-"}/hr</span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 opacity-60" />
            <span className={t.typography.muted}>
              {Array.isArray(tutor.subjects) ? tutor.subjects.length : 0} subjects
            </span>
          </div>
        </div>

        {/* bio */}
        <p className={`${t.typography.body} text-sm line-clamp-2`}>
          {tutor.bio || "No bio provided."}
        </p>

        {/* subjects */}
        {Array.isArray(tutor.subjects) && tutor.subjects.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tutor.subjects.slice(0, 5).map((s) => (
              <span key={s} className={t.components.badge}>
                {s}
              </span>
            ))}
            {tutor.subjects.length > 5 && (
              <span className={t.components.badge}>
                +{tutor.subjects.length - 5}
              </span>
            )}
          </div>
        ) : (
          <div className={t.typography.muted}>No subjects listed.</div>
        )}
      </div>
    </button>
  )
}