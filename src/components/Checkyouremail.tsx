import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/LOGO.jpeg";
import "./Auth.css";

/**
 * Shown straight after sign-up when Supabase requires email confirmation.
 * The account already exists at this point — the person just can't sign in
 * until they click the link. Saying that plainly avoids them trying to sign
 * up again and hitting "already registered", which reads like a failure.
 */

const RESEND_COOLDOWN_S = 60;

export default function CheckYourEmail() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { email?: string } };

  const [email, setEmail] = useState(location.state?.email ?? "");
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Someone who signs in from the confirmation email in another tab
  // shouldn't be left staring at this page.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/account", { replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email.trim()) return setMessage("Enter the email you signed up with.");
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });

    setBusy(false);

    if (error) {
      setMessage(
        error.message.toLowerCase().includes("already confirmed")
          ? "That address is already confirmed — you can sign in now."
          : "We couldn't resend it. Wait a moment and try again.",
      );
      return;
    }

    setCooldown(RESEND_COOLDOWN_S);
    setMessage("Sent. It can take a minute or two to arrive.");
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--narrow">
        <img src={logo} alt="Diocesan Youth Organization" className="auth-logo" />
        <h1>Check your email</h1>

        <p className="auth-sub">
          Your account is created. We've sent a confirmation link
          {email ? <> to <strong>{email}</strong></> : ""} — open it and you'll
          be able to sign in.
        </p>

        <p className="auth-sub">
          Nothing yet? Check your spam or promotions folder. Gmail in particular
          likes to file these away.
        </p>

        {!location.state?.email && (
          <input
            type="email"
            placeholder="The email you signed up with"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {message && <p className="auth-error">{message}</p>}

        <button type="button" onClick={resend} disabled={busy || cooldown > 0}>
          {busy ? "Sending…"
            : cooldown > 0 ? `Resend in ${cooldown}s`
            : "Resend the link"}
        </button>

        <p className="auth-alt">
          Already confirmed? <Link to="/login">Sign in</Link>
        </p>
        <p className="auth-alt">
          <Link to="/">Back to the home page</Link>
        </p>
      </div>
    </div>
  );
}