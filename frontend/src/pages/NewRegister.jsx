import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";

import { lightTheme as t } from "../assets/theme";
import { registerStudent, registerTutor, signin } from "../api";
import { useAuth } from "../Auth";

export default function Register() {
  const [role, setRole] = useState("student"); // "student" | "tutor"

  return (
    <div className={`${t.components.container.page} flex items-center justify-center`}>
      <div className={`${t.components.container.narrow} ${t.components.container.section}`}>
        <div className="text-center">
          <h1 className={t.typography.h1}>Create account</h1>
          <p className={`${t.typography.muted} mt-2`}>
            Register as a student or tutor. You can start booking immediately.
          </p>
        </div>

        <div className={`${t.components.card.base} mt-6`}>
          <div className="p-5 sm:p-6">
            <RoleSwitch role={role} setRole={setRole} />
            <div className="mt-5">
              <RegisterForm role={role} />
            </div>

            <div className="mt-6">
              <div className={t.components.divider.soft} />
              <div className="mt-4 text-center">
                <Link to="/signin" className={t.typography.link}>
                  Sign in instead
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleSwitch({ role, setRole }) {
  const studentCls =
    role === "student" ? t.components.nav.linkActive : t.components.nav.link;
  const tutorCls = role === "tutor" ? t.components.nav.linkActive : t.components.nav.link;

  return (
    <div className={`${t.components.tabs.wrapper} w-full`}>
      <button
        type="button"
        onClick={() => setRole("student")}
        className={`${t.components.tabs.tab} ${role === "student" ? t.components.tabs.tabActive : ""} flex-1`}
      >
        Student
      </button>
      <button
        type="button"
        onClick={() => setRole("tutor")}
        className={`${t.components.tabs.tab} ${role === "tutor" ? t.components.tabs.tabActive : ""} flex-1`}
      >
        Tutor
      </button>
    </div>
  );
}

function RegisterForm({ role }) {
  const nav = useNavigate();
  const { setMe } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // tutor-only
  const [hourlyRate, setHourlyRate] = useState(15);
  const [bio, setBio] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectDraft, setSubjectDraft] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isTutor = role === "tutor";

  const canAddSubject = useMemo(() => {
    const s = subjectDraft.trim();
    if (!s) return false;
    return !subjects.some((x) => x.toLowerCase() === s.toLowerCase());
  }, [subjectDraft, subjects]);

  function addSubject() {
    if (!canAddSubject) return;
    setSubjects((prev) => prev.concat([subjectDraft.trim()]));
    setSubjectDraft("");
  }

  function removeSubject(idx) {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      let ok = false;

      if (isTutor) {
        ok = await registerTutor(
          firstName,
          lastName,
          email,
          password,
          subjects,
          hourlyRate,
          bio,
          setErrorMessage
        );
      } else {
        ok = await registerStudent(firstName, lastName, email, password, setErrorMessage);
      }

      if (!ok) return;

      // sign in + setMe flow (your current working fix)
      const tokenOk = await signin(email, password, setErrorMessage, setMe);
      if (tokenOk) nav("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errorMessage ? (
        <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={t.components.input.soft}
            placeholder="Jane"
            autoComplete="given-name"
          />
        </Field>

        <Field label="Last name">
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={t.components.input.soft}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={t.components.input.soft}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={t.components.input.soft}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </Field>

      {isTutor ? (
        <>
          <div className={`${t.components.card.muted}`}>
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Hourly rate (£)">
                  <input
                    type="number"
                    value={hourlyRate}
                    min={1}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    required
                    className={t.components.input.soft}
                    placeholder="20"
                  />
                </Field>

                <Field label="Subjects (add)">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={subjectDraft}
                      onChange={(e) => setSubjectDraft(e.target.value)}
                      className={t.components.input.soft}
                      placeholder="e.g. Maths"
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
                      disabled={!canAddSubject}
                      className={`${t.components.button.icon} ${t.components.button.iconMd}`}
                      title="Add subject"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
              </div>

              <div>
                <div className={t.components.input.label}>Selected subjects</div>
                {subjects.length === 0 ? (
                  <div className={t.typography.muted}>Add at least one subject.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s, idx) => (
                      <span
                        key={`${s}-${idx}`}
                        className={`${t.components.badge.base} ${t.components.badge.neutral} inline-flex items-center gap-2`}
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSubject(idx)}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Bio">
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  required
                  className={t.components.input.soft}
                  placeholder="Tell students what you can help with…"
                />
              </Field>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="submit"
        disabled={submitting || (isTutor && subjects.length === 0)}
        className={`${t.components.button.base} ${t.components.button.primary} ${t.components.button.lg} w-full`}
      >
        {submitting ? "Creating account…" : "Register"}
      </button>

      {isTutor && subjects.length === 0 ? (
        <div className={t.typography.faint}>Tutors must add at least one subject.</div>
      ) : null}
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className={t.components.input.label}>{label}</label>
      {children}
    </div>
  );
}