import { Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { lightTheme as t } from "../assets/theme";
import { signin } from "../api";
import { useAuth } from "../Auth";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { me, loading, setMe } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await signin(email, password, setErrorMessage, setMe);
  }

  if (!loading && me) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={`${t.components.container.page} flex items-center justify-center`}>
      <div className={`${t.components.container.narrow} ${t.components.container.section}`}>
        <div className="text-center">
          <h1 className={t.typography.h1}>Sign in</h1>
          <p className={`${t.typography.muted} mt-2`}>
            Welcome back. Sign in to manage your bookings.
          </p>
        </div>

        <div className={`${t.components.card.base} mt-6`}>
          <div className="p-5 sm:p-6">
            {errorMessage ? (
              <div className={`${t.components.alert.base} ${t.components.alert.error} mb-4`}>
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="email" className={t.components.input.label}>
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className={t.components.input.soft}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className={t.components.input.label}>
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className={t.components.input.soft}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className={`${t.components.button.base} ${t.components.button.primary} ${t.components.button.lg} w-full`}
              >
                Sign in
              </button>

              <div className={t.components.divider.soft} />

              <div className="text-center">
                <Link to="/register" className={t.typography.link}>
                  Create an account
                </Link>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 text-center">
          <span className={t.typography.faint}>
            If you’re already signed in, you’ll be taken to your dashboard automatically.
          </span>
        </div>
      </div>
    </div>
  );
}
