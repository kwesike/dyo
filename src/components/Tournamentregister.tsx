import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile } from "../lib/Storage";
import { useAuth } from "./Authcontext";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

/**
 * Public tournament registration.
 *
 * A signed-in user registers as a player or coach under a team, filling the
 * custom fields the admin defined (text/number/date/select/file). Account
 * info (name/email/phone) is taken from their profile — they don't retype it.
 * After submitting, they're pending until an admin approves.
 */
type Field = {
  id: string; label: string; field_type: string;
  options: string[] | null; required: boolean; applies_to: string;
};

export default function TournamentRegister() {
  const { slug } = useParams<{ slug: string }>();
  const { session, profile } = useAuth();

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState<"player" | "coach">("player");
  const [teamId, setTeamId] = useState("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => { void load(); }, [slug]);

  async function load() {
    const { data: t } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
    setTournament(t);
    if (t) {
      const [{ data: tm }, { data: fl }] = await Promise.all([
        supabase.from("tournament_teams").select("id, name").eq("tournament_id", t.id).order("name"),
        supabase.from("tournament_fields").select("*").eq("tournament_id", t.id).order("sort_order"),
      ]);
      setTeams(tm ?? []);
      setFields(fl ?? []);
    }
    setLoading(false);
  }

  const shownFields = fields.filter((f) => f.applies_to === "both" || f.applies_to === role);

  async function handleFile(field: Field, file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadPublicFile("programme-media", file, `tournaments/${slug}`);
      setAnswers((a) => ({ ...a, [field.id]: url }));
    } catch {
      setError(`Couldn't upload ${field.label}. Try again.`);
    }
    setBusy(false);
  }

  async function submit() {
    setError("");
    if (!teamId) return setError("Pick your team.");
    // check required fields
    for (const f of shownFields) {
      if (f.required && !answers[f.id]) {
        return setError(`${f.label} is required.`);
      }
    }

    setBusy(true);
    const { error: err } = await supabase.from("tournament_registrations").insert({
      tournament_id: tournament.id,
      team_id: teamId,
      user_id: session!.user.id,
      role_in_team: role,
      full_name: profile?.full_name ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      answers,
    });
    setBusy(false);

    if (err) {
      setError(err.message.includes("duplicate")
        ? "You've already registered for this tournament in this role."
        : err.message);
      return;
    }
    setDone(true);
  }

  if (loading) return <div className="store"><Navbar /><p className="store-status">Loading…</p><SiteFooter /></div>;

  if (!tournament) return (
    <div className="store"><Navbar />
      <div className="store-status"><h2>Tournament not found</h2>
        <Link to="/" className="product-add">Home</Link></div>
      <SiteFooter />
    </div>
  );

  if (!session) return (
    <div className="store"><Navbar />
      <div className="store-status">
        <h2>Sign in to register</h2>
        <p>You need an account to register for {tournament.name}.</p>
        <Link to={`/login?next=/tournaments/${slug}/register`} className="product-add">Sign in</Link>
      </div>
      <SiteFooter />
    </div>
  );

  if (done) return (
    <div className="store"><Navbar />
      <div className="store-status">
        <h2>Registration submitted 🎉</h2>
        <p>Your registration for {tournament.name} is pending approval. You'll be
           part of the tournament once an organiser approves you.</p>
        <Link to="/" className="product-add">Back home</Link>
      </div>
      <SiteFooter />
    </div>
  );

  return (
    <div className="store">
      <Navbar />
      <div className="checkout">
        <h1>Register · {tournament.name}</h1>
        <p className="checkout-tip">
          You're registering as <strong>{profile?.full_name}</strong>. Your name,
          email and phone come from your account.
        </p>

        <div className="checkout-form" style={{ maxWidth: 560 }}>
          <label className="checkout-voucher-label">I am registering as</label>
          <div className="checkout-choices" style={{ marginBottom: 16 }}>
            <button className={role === "player" ? "is-active" : ""} onClick={() => setRole("player")}>
              <span>Player</span>
            </button>
            <button className={role === "coach" ? "is-active" : ""} onClick={() => setRole("coach")}>
              <span>Coach</span>
            </button>
          </div>

          <label className="checkout-voucher-label">Your team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                  style={{ width: "100%", marginBottom: 16, padding: "10px 12px" }}>
            <option value="">Choose your team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {shownFields.map((f) => (
            <div key={f.id} style={{ marginBottom: 14 }}>
              <label className="checkout-voucher-label">
                {f.label}{f.required && <span style={{ color: "#b00020" }}> *</span>}
              </label>
              {f.field_type === "text" && (
                <input style={{ width: "100%", padding: "10px 12px" }}
                       value={answers[f.id] ?? ""}
                       onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
              )}
              {f.field_type === "number" && (
                <input type="number" style={{ width: "100%", padding: "10px 12px" }}
                       value={answers[f.id] ?? ""}
                       onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
              )}
              {f.field_type === "date" && (
                <input type="date" style={{ width: "100%", padding: "10px 12px" }}
                       value={answers[f.id] ?? ""}
                       onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
              )}
              {f.field_type === "select" && (
                <select style={{ width: "100%", padding: "10px 12px" }}
                        value={answers[f.id] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}>
                  <option value="">Choose…</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {f.field_type === "file" && (
                <div>
                  <input type="file" onChange={(e) => handleFile(f, e.target.files?.[0])} />
                  {answers[f.id] && <span style={{ fontSize: "0.8rem", color: "green", marginLeft: 8 }}>✓ uploaded</span>}
                </div>
              )}
            </div>
          ))}

          {error && <p className="checkout-error">{error}</p>}

          <button className="product-add" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit registration"}
          </button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}