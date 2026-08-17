import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./Auth.css";
import logo from "../assets/LOGO.jpeg";

/**
 * Reset password — where the emailed link lands. Supabase puts a recovery
 * session in place when the user arrives here from the email, so we can set
 * a new password directly.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // When the user arrives from the email link, Supabase fires a
    // PASSWORD_RECOVERY event and establishes a temporary session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check if a session already exists (link already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => navigate("/login"), 2500);
  };

  return (
    <div className="auth-page">
      <form className="auth-card auth-card--narrow" onSubmit={submit}>
        <img src={logo} alt="Diocesan Youth Organization" className="auth-logo" />
        <h1>Set a new password</h1>

        {done ? (
          <p className="auth-note">Password updated. Taking you to sign in…</p>
        ) : !ready ? (
          <p className="auth-note">
            Open this page from the reset link in your email. If you came from the
            email and still see this, the link may have expired — request a new one.
          </p>
        ) : (
          <>
            <input type="password" placeholder="New password" value={password}
                   autoComplete="new-password"
                   onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
            <input type="password" placeholder="Confirm new password" value={confirm}
                   autoComplete="new-password"
                   onChange={(e) => setConfirm(e.target.value)} required disabled={busy} />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
          </>
        )}
      </form>
    </div>
  );
}