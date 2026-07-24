import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/LOGO.jpeg";
import { useAuth } from "./Authcontext";
import "./Auth.css";

/**
 * One sign-in for everyone. The role on the profile decides what they see,
 * which is why the old separate AdminLogin page is gone.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [params] = useSearchParams();
  const { session, loading, isAdmin } = useAuth();

  /**
   * Two different cases:
   *  - `requestedNext` is set when a guard sent them here mid-task ("register
   *    for this programme"). That always wins — finish what they started.
   *  - Otherwise we choose the landing page by role: admins run the office
   *    from /admin, so dropping them on the public home page just adds a click.
   */
  const requestedNext = location.state?.from ?? params.get("next") ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Someone already signed in has no business on this page — this also covers
  // landing here from the confirmation email with a live session.
  useEffect(() => {
    if (loading || !session) return;
    if (requestedNext) navigate(requestedNext, { replace: true });
    else navigate(isAdmin ? "/admin" : "/", { replace: true });
  }, [loading, session, isAdmin, requestedNext, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!navigator.onLine) {
      return setError("You're offline. Reconnect and try again.");
    }

    setBusy(true);

    try {
      const { error: signInError } = await Promise.race([
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20_000)),
      ]);

      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes("not confirmed")
            ? "Confirm your email first — check your inbox for the link we sent."
            : "That email and password don't match an account.",
        );
        return;
      }

      if (requestedNext) {
        navigate(requestedNext, { replace: true });
        return;
      }

      /**
       * Read the role straight from the table rather than waiting for the
       * context to catch up. AuthContext deliberately defers its profile fetch
       * (it deadlocks the auth lock otherwise), so `isAdmin` is still false at
       * this exact moment even for an admin — which is why admins were being
       * sent to the home page.
       */
      const { data: { user } } = await supabase.auth.getUser();
      let destination = "/";

      if (user) {
        const { data: row } = await supabase
          .from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (row?.role === "admin" || row?.role === "super_admin") destination = "/admin";
      }

      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        (err as Error)?.message === "timeout"
          ? "That's taking longer than it should. Check your connection and try again."
          : "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) return setError("Enter your email first, then tap reset.");
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setError("Reset link sent. Check your email.");
  };

  return (
    <div className="auth-page">
      <form className="auth-card auth-card--narrow" onSubmit={submit}>
        <img src={logo} alt="Diocesan Youth Organization" className="auth-logo" />
        <h1>Sign in</h1>

        <input type="email" placeholder="Email" value={email} autoComplete="email"
               onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
        <input type="password" placeholder="Password" value={password}
               autoComplete="current-password"
               onChange={(e) => setPassword(e.target.value)} required disabled={busy} />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

        <button type="button" className="linkish" onClick={resetPassword}>
          Forgot your password?
        </button>

        <p className="auth-alt">
          New here? <Link to={requestedNext
            ? `/signup?next=${encodeURIComponent(requestedNext)}`
            : "/signup"}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}