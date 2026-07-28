import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile } from "../lib/Storage";
import logo from "../assets/LOGO.jpeg";
import { ARCHDEACONRIES } from "../lib/Constants";
import "./Auth.css";

/**
 * One sign-up, then every future programme registration is three taps.
 *
 * Network handling matters more here than anywhere else on the site: this runs
 * on Nigerian mobile data, and a request that dies mid-flight must not strand
 * someone on a dead button. Every path below resets the form state.
 */

const SIGNUP_TIMEOUT_MS = 20_000;

/** Rejects if a promise takes too long, so the UI can never hang forever. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

const isNetworkError = (err: unknown) => {
  const m = (err as Error)?.message?.toLowerCase() ?? "";
  return m.includes("fetch") || m.includes("network") || m.includes("timeout");
};

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/programmes";

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", phone: "", gender: "",
    date_of_birth: "", archdeaconry: "", church: "", occupation: "",
    educational_qualification: "", address: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!navigator.onLine) {
      return setError("You're offline. Reconnect and try again — nothing has been lost.");
    }

    setBusy(true);

    try {
      // Upload the photo first (if any) so its URL rides along in signup
      // metadata and the profile trigger picks it up.
      let photoUrl = "";
      if (photoFile) {
        try {
          const key = form.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
          photoUrl = await uploadPublicFile("member-photos", photoFile, `signup/${key}`);
        } catch {
          // Photo is optional — press on without it rather than block signup.
        }
      }

      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            data: {
              full_name: form.full_name.trim(),
              phone: form.phone.trim(),
              gender: form.gender,
              date_of_birth: form.date_of_birth || "",
              archdeaconry: form.archdeaconry,
              church: form.church.trim(),
              occupation: form.occupation.trim(),
              educational_qualification: form.educational_qualification.trim(),
              address: form.address.trim(),
              photo_url: photoUrl,
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        }),
        SIGNUP_TIMEOUT_MS,
      );

      if (signUpError) {
        setError(
          signUpError.message.toLowerCase().includes("already registered")
            ? "That email already has an account — sign in instead."
            : signUpError.message,
        );
        return;
      }

      /**
       * The account now exists. Everything after this is a bonus: if the
       * profile write fails we must NOT leave them stuck here, because
       * signing up again with the same email will just be rejected. Send
       * them on and let them finish their details in /account.
       */
      // The profile is filled by the handle_new_user trigger from the signup
      // metadata above — no client-side profile write needed, and crucially
      // none that would fail against RLS before the session exists.

      if (!data.session) {
        navigate("/check-your-email", { state: { email: form.email } });
      } else {
        navigate(next, { replace: true });
      }
    } catch (err) {
      setError(
        isNetworkError(err)
          ? "We couldn't reach the server — check your connection and try again. Your details are still here."
          : "Something went wrong creating the account. Try again.",
      );
    } finally {
      // Runs whatever happened above, so the button always comes back.
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src={logo} alt="Diocesan Youth Organization" className="auth-logo" />
        <h1>Create your account</h1>

        {/* Profile photo — this becomes the face on attendance cards, so
            capturing it now saves a trip to the account page later. */}
        <div className="signup-photo">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="signup-photo-preview" />
          ) : (
            <div className="signup-photo-blank">Add a photo</div>
          )}
          <label className="signup-photo-btn">
            {photoPreview ? "Change photo" : "Upload a photo"}
            <input type="file" accept="image/*" hidden
                   onChange={(e) => {
                     const f = e.target.files?.[0];
                     if (f) {
                       setPhotoFile(f);
                       setPhotoPreview(URL.createObjectURL(f));
                     }
                   }} />
          </label>
        </div>
        <p className="auth-sub">
          Register once. After this, signing up for a programme takes seconds and
          your attendance card is generated for you.
        </p>

        <div className="grid-2">
          <input name="full_name" placeholder="Full name" value={form.full_name}
                 onChange={set} required disabled={busy} />
          <select name="gender" value={form.gender} onChange={set} required disabled={busy}>
            <option value="">Gender</option>
            <option>Male</option>
            <option>Female</option>
          </select>

          <input type="email" name="email" placeholder="Email" value={form.email}
                 onChange={set} required disabled={busy} autoComplete="email" />
          <input name="phone" placeholder="Phone number" value={form.phone}
                 onChange={set} required disabled={busy} autoComplete="tel" />

          <input type="password" name="password" placeholder="Password (min. 8 characters)"
                 minLength={8} value={form.password} onChange={set} required
                 disabled={busy} autoComplete="new-password" />
          <input type="date" name="date_of_birth" value={form.date_of_birth}
                 onChange={set} required disabled={busy} />

          <select name="archdeaconry" value={form.archdeaconry} onChange={set}
                  required disabled={busy}>
            <option value="">Archdeaconry</option>
            {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input name="church" placeholder="Church" value={form.church}
                 onChange={set} required disabled={busy} />

          <input name="occupation" placeholder="Occupation" value={form.occupation}
                 onChange={set} disabled={busy} />
          <input name="educational_qualification" placeholder="Highest qualification"
                 value={form.educational_qualification} onChange={set} disabled={busy} />
        </div>

        <input name="address" placeholder="Address" value={form.address}
               onChange={set} disabled={busy} />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>

        <p className="auth-alt">
          Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}