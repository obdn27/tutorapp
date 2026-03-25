import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import { useAuth } from "../Auth";
import {
  getTutorMe,
  patchTutorMe,
  putTutorSubjects, // MUST be "replace all subjects" endpoint
  getBookings,
  changePassword, // you will add backend for this
} from "../api";
import {
  User,
  Mail,
  Shield,
  PoundSterling,
  BookOpen,
  NotebookPen,
  Save,
  Plus,
  X,
  Star,
  KeyRound,
} from "lucide-react";

export default function Profile() {
  const { me } = useAuth();
  if (!me) return null;

  const isTutor = me.role === 1;

  return (
    <div className={`${t.components.container.page} h-full`}>
      <div
        className={`${t.components.container.content} ${t.components.container.section}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className={t.typography.h1}>Profile</h1>
            <div className={t.typography.muted}>
              Account details and settings.
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-6">
            <AccountCard me={me} />
            <ChangePasswordCard />
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 min-w-0 flex flex-col gap-6">
            {isTutor ? (
              <>
                <TutorProfileEditor />
                <TutorRatingsCard />
              </>
            ) : (
              // <StudentInfoCard />
              <></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------------- Basic cards ---------------- */

function AccountCard({ me }) {
  const roleLabel = me.role === 1 ? "Tutor" : me.role === 0 ? "Student" : "Admin";

  return (
    <div className={t.components.card.base}>
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <h2 className={t.typography.h3}>Account</h2>
      </div>

      <div className="p-5 sm:p-6 space-y-3">
        <Row
          icon={<User className="w-4 h-4" />}
          label="Name"
          value={`${me.first_name} ${me.last_name}`}
        />
        <Row icon={<Mail className="w-4 h-4" />} label="Email" value={me.email} />
        <Row
          icon={<Shield className="w-4 h-4" />}
          label="Role"
          value={roleLabel}
        />
      </div>
    </div>
  );
}

function StudentInfoCard() {
  return (
    <div className={t.components.card.base}>
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <h2 className={t.typography.h3}>Student</h2>
        <div className={t.typography.muted}>
          Nothing else required right now.
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className={t.typography.muted}>
          Later you can add goals / subjects / preferred times, etc.
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-slate-900 font-semibold break-words">{value}</div>
      </div>
    </div>
  );
}

/** ---------------- Change password ----------------
 * Requires you to implement backend. UI is ready.
 */

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!current || !next) throw new Error("missing_fields");
      if (next.length < 6) throw new Error("weak_password");
      if (next !== confirm) throw new Error("password_mismatch");
      return changePassword({ current_password: current, new_password: next });
    },
    onSuccess: async () => {
      setCurrent("");
      setNext("");
      setConfirm("");
    },
  });

  const err = mut.error ? String(mut.error.message || mut.error) : null;

  return (
    <div className={t.components.card.base}>
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <h2 className={t.typography.h3}>Security</h2>
        <div className={t.typography.muted}>Change your password.</div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {err ? (
          <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
            {err}
          </div>
        ) : null}

        <Field
          label="Current password"
          icon={<KeyRound className="w-4 h-4 text-slate-400" />}
        >
          <input
            type="password"
            className={t.components.input.soft}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>

        <Field
          label="New password"
          icon={<KeyRound className="w-4 h-4 text-slate-400" />}
        >
          <input
            type="password"
            className={t.components.input.soft}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>

        <Field
          label="Confirm new password"
          icon={<KeyRound className="w-4 h-4 text-slate-400" />}
        >
          <input
            type="password"
            className={t.components.input.soft}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className={`${t.components.button.base} ${t.components.button.primary} w-full`}
        >
          {mut.isPending ? "Saving…" : "Change password"}
        </button>
      </div>
    </div>
  );
}

/** ---------------- Tutor editor ----------------
 * Assumes:
 * - GET /data/tutor/me returns { bio, hourly_gbp, subjects: [] }
 * - PATCH /data/tutor/me accepts { bio, hourly_gbp }
 * - PUT /data/tutor/me/subjects accepts { subjects: [] } and REPLACES ALL (delete+insert)
 */

function TutorProfileEditor() {
  const qc = useQueryClient();

  const tutorQ = useQuery({
    queryKey: ["tutorMe"],
    queryFn: getTutorMe,
  });

  const [bio, setBio] = useState("");
  const [hourly, setHourly] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");

  useMemo(() => {
    const d = tutorQ.data;
    if (!d) return;
    setBio((prev) => (prev === "" ? (d.bio ?? "") : prev));
    setHourly((prev) => (prev === "" ? String(d.hourly_gbp ?? "") : prev));
    setSubjects((prev) => (prev.length === 0 ? (d.subjects ?? []) : prev));
  }, [tutorQ.data]);

  const patchMut = useMutation({
    mutationFn: async () =>
      patchTutorMe({
        bio,
        hourly_gbp: hourly === "" ? null : Number(hourly),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tutorMe"] });
      await qc.invalidateQueries({ queryKey: ["tutors"] });
    },
  });

  const subjectsMut = useMutation({
    mutationFn: async () => putTutorSubjects({ subjects }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tutorMe"] });
      await qc.invalidateQueries({ queryKey: ["tutors"] });
    },
  });

  const addSubject = () => {
    const s = newSubject.trim();
    if (!s) return;
    if (subjects.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    setSubjects([...subjects, s]);
    setNewSubject("");
  };

  const removeSubject = (i) => {
    setSubjects(subjects.filter((_, idx) => idx !== i));
  };

  const err = tutorQ.isError
    ? "Failed to load tutor profile."
    : patchMut.error
      ? String(patchMut.error.message || patchMut.error)
      : subjectsMut.error
        ? String(subjectsMut.error.message || subjectsMut.error)
        : null;

  return (
    <div className={t.components.card.base}>
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <h2 className={t.typography.h3}>Tutor profile</h2>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {err ? (
          <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
            {err}
          </div>
        ) : null}

        {tutorQ.isLoading ? (
          <div className={t.typography.muted}>Loading…</div>
        ) : null}

        <Field
          label="Hourly rate (£)"
          icon={<PoundSterling className="w-4 h-4 text-slate-400" />}
        >
          <input
            type="number"
            min={0}
            className={t.components.input.soft}
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
          />
        </Field>

        <Field label="Bio" icon={<NotebookPen className="w-4 h-4 text-slate-400" />}>
          <textarea
            rows={6}
            className={t.components.input.soft}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write a short bio…"
          />
        </Field>

        <div className="flex items-center gap-2">
          <button
            disabled={patchMut.isPending}
            onClick={() => patchMut.mutate()}
            className={`${t.components.button.base} ${t.components.button.primary}`}
          >
            <Save className="w-4 h-4" />
            {patchMut.isPending ? "Saving…" : "Save details"}
          </button>

          <div className={t.typography.faint}>Updates bio + hourly rate.</div>
        </div>

        <div className={t.components.divider.soft} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <div className="font-bold text-slate-900">Subjects</div>
              </div>
              <div className={t.typography.muted}>
                This should replace the entire list (so deletes work).
              </div>
            </div>

            <button
              disabled={subjectsMut.isPending}
              onClick={() => subjectsMut.mutate()}
              className={`${t.components.button.base} ${t.components.button.secondary}`}
            >
              <Save className="w-4 h-4" />
              {subjectsMut.isPending ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {subjects.length ? (
              subjects.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className={`${t.components.badge.base} ${t.components.badge.neutral} inline-flex items-center gap-2`}
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSubject(i)}
                    className="text-slate-400 hover:text-slate-700"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <div className={t.typography.muted}>No subjects set.</div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className={t.components.input.soft}
              placeholder="Add subject…"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubject();
                }
              }}
            />
            <button
              type="button"
              onClick={addSubject}
              className={`${t.components.button.base} ${t.components.button.neutral}`}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------------- Tutor ratings (best-effort) ---------------- */

function TutorRatingsCard() {
  const bookingsQ = useQuery({
    queryKey: ["bookings"],
    queryFn: getBookings,
  });

  const rated = useMemo(() => {
    const rows = Array.isArray(bookingsQ.data) ? bookingsQ.data : [];
    // expects booking rows to optionally include rating / review / feedback
    const withRating = rows.filter(
      (b) => Number(b?.rating) > 0 || b?.review || b?.feedback
    );
    withRating.sort((a, b) => Number(b.end_ts) - Number(a.end_ts));
    return withRating.slice(0, 8);
  }, [bookingsQ.data]);

  return (
    <div className={t.components.card.base}>
      <div className="p-5 sm:p-6 border-b border-slate-100">
        <h2 className={t.typography.h3}>Recent ratings</h2>
        <div className={t.typography.muted}>
          Latest rated bookings (if your API includes rating fields).
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {bookingsQ.isLoading ? (
          <div className={t.typography.muted}>Loading…</div>
        ) : bookingsQ.isError ? (
          <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
            Failed to load bookings.
          </div>
        ) : rated.length === 0 ? (
          <div className={t.typography.muted}>No ratings yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {rated.map((b) => (
              <RatingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RatingRow({ booking }) {
  const when = new Date(booking.end_ts * 1000);
  const date = when.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  const studentName = booking.student_first_name
    ? `${booking.student_first_name} ${booking.student_last_name ?? ""}`.trim()
    : "Student";

  const rating = Number(booking.rating || 0);
  const text = booking.review || booking.feedback || "";

  return (
    <div className={`${t.components.card.subtle} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate">{studentName}</div>
          <div className={t.typography.faint}>{date}</div>
        </div>

        <div className="shrink-0 inline-flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < rating ? "text-indigo-600" : "text-slate-300"}`}
              fill={i < rating ? "currentColor" : "none"}
            />
          ))}
        </div>
      </div>

      {text ? (
        <div className={`${t.typography.muted} mt-2 whitespace-pre-wrap`}>{text}</div>
      ) : (
        <div className={`${t.typography.muted} mt-2`}>No written feedback.</div>
      )}
    </div>
  );
}

/** ---------------- shared ---------------- */

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}