import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { naira, startPayment } from "../lib/Payments";
import {
  composeAttendingCard, uploadAttendingCard, shareCard,
  DEFAULT_CARD_CONFIG,
} from "../lib/Attendingcard";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Programmes.css";

interface ExtraField {
  key: string;
  label: string;
  type: "text" | "select" | "textarea";
  options?: string[];
  required?: boolean;
}

export default function ProgrammeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [programme, setProgramme] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);

  useEffect(() => { void load(); }, [slug, session?.user.id]);

  async function load() {
    setLoading(true);
    const { data: prog } = await supabase
      .from("programmes").select("*").eq("slug", slug).maybeSingle();
    setProgramme(prog);

    if (prog && session) {
      const { data: reg } = await supabase
        .from("programme_registrations")
        .select("*")
        .eq("programme_id", prog.id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      setRegistration(reg);
      if (reg?.attending_card_url) setCardPreview(reg.attending_card_url);
    }
    setLoading(false);
  }

  if (loading || authLoading) {
    return <div className="pg-detail"><Navbar /><p className="pg-status">Loading…</p></div>;
  }
  if (!programme) {
    return (
      <div className="pg-detail">
        <Navbar />
        <div className="pg-status">
          <h2>That programme isn't listed</h2>
          <p>It may have been taken down. <Link to="/programmes">See what's on</Link>.</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const extras: ExtraField[] = programme.extra_fields ?? [];
  const closesAt = programme.registration_closes_at
    ? new Date(programme.registration_closes_at) : null;
  const closed = closesAt ? closesAt < new Date() : false;
  const owes = registration && registration.payment_status === "pending";

  /* ---------------- register ---------------- */

  async function register() {
    if (!session || !profile) {
      navigate(`/signup?next=${encodeURIComponent(`/programmes/${slug}`)}`);
      return;
    }

    const missing = extras.filter((f) => f.required && !answers[f.key]?.trim());
    if (missing.length) {
      setNotice(`Answer: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setBusy(true);
    setNotice("");

    const needsPayment = programme.fee_naira > 0;

    const { data, error } = await supabase
      .from("programme_registrations")
      .insert({
        programme_id: programme.id,
        user_id: session.user.id,
        full_name: profile.full_name,
        gender: profile.gender,
        phone: profile.phone,
        email: profile.email,
        archdeaconry: profile.archdeaconry,
        church: profile.church,
        photo_url: profile.photo_url,
        answers,
        amount_naira: programme.fee_naira,
        payment_status: needsPayment ? "pending" : "not_required",
      })
      .select()
      .single();

    setBusy(false);

    if (error) {
      setNotice(
        error.code === "23505"
          ? "You're already registered for this one."
          : "We couldn't save that. Try again.",
      );
      void load();
      return;
    }

    setRegistration(data);
    if (needsPayment) await pay(data);
  }

  /* ---------------- pay ---------------- */

  async function pay(reg = registration) {
    if (!reg || !profile) return;
    setBusy(true);

    const result = await startPayment({
      purpose: "registration",
      referenceId: reg.id,
      amountNaira: reg.amount_naira,
      customer: { email: profile.email!, name: profile.full_name!, phone: profile.phone ?? "" },
      title: programme.title,
      description: "Programme registration",
    });

    setBusy(false);

    if (result.status === "success") { setNotice(""); void load(); }
    else if (result.status === "failed") setNotice(result.message ?? "Payment didn't go through.");
  }

  /* ---------------- attendance card ---------------- */

  async function makeCard() {
    if (!programme.attending_template_url) {
      setNotice("The attendance card for this programme isn't ready yet.");
      return;
    }

    // The photo is the whole point of the card — say plainly what's missing
    // and where to fix it, rather than failing quietly.
    const photo = registration?.photo_url ?? profile?.photo_url;
    if (!photo) {
      setNotice("You haven't added a photo yet — add one in My account, then come back.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const blob = await composeAttendingCard({
        templateUrl: programme.attending_template_url,
        photoUrl: photo,
        details: {
          name: profile?.full_name ?? registration?.full_name ?? "",
          church: registration?.church ?? profile?.church,
          archdeaconry: registration?.archdeaconry ?? profile?.archdeaconry,
        },
        config: programme.card_config ?? DEFAULT_CARD_CONFIG,
      });

      const url = await uploadAttendingCard(blob, registration.id);
      await supabase.from("programme_registrations")
        .update({ attending_card_url: url }).eq("id", registration.id);

      setCardBlob(blob);
      setCardPreview(URL.createObjectURL(blob));
    } catch (err) {
      setNotice(
        (err as Error)?.message?.toLowerCase().includes("load")
          ? "Couldn't load your photo or the flyer. Both need to be uploaded and public before the card can build."
          : "Couldn't build the card. Try a different profile photo.",
      );
    }
    setBusy(false);
  }

  async function share() {
    let blob = cardBlob;
    if (!blob && cardPreview) blob = await (await fetch(cardPreview)).blob();
    if (!blob) return;
    await shareCard(
      blob,
      `${programme.slug}-attending.png`,
      `I will be attending ${programme.title}!`,
    );
  }

  /* ---------------- render ---------------- */

  return (
    <div className="pg-detail">
      <Navbar />

      {programme.banner_url && (
        <div className="pg-hero" style={{ backgroundImage: `url(${programme.banner_url})` }}>
          <div className="pg-hero-inner">
            <p className="pg-eyebrow">
              {programme.starts_at
                ? new Date(programme.starts_at).toLocaleDateString("en-NG",
                    { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : "Date to be announced"}
            </p>
            <h1>{programme.title}</h1>
            {programme.tagline && <p className="pg-tagline">{programme.tagline}</p>}
          </div>
        </div>
      )}

      <div className="pg-body">
        <article className="pg-about">
          <Link to="/programmes" className="pg-back">← All programmes</Link>
          <p className="pg-meta">
            {programme.venue && <span>{programme.venue}</span>}
            <span>{programme.fee_naira > 0 ? naira(programme.fee_naira) : "Free"}</span>
            {closesAt && <span>Registration closes {closesAt.toLocaleDateString("en-NG")}</span>}
          </p>
          <p className="pg-description">{programme.description}</p>
          {programme.flyer_url && (
            <img className="pg-flyer" src={programme.flyer_url} alt={`${programme.title} flyer`} />
          )}
        </article>

        <aside className="pg-panel">
          {!session && (
            <>
              <h3>Register for this programme</h3>
              <p className="pg-note">
                Create an account once and your details fill themselves in every
                time after this.
              </p>
              <Link className="pg-button"
                    to={`/signup?next=${encodeURIComponent(`/programmes/${slug}`)}`}>
                Create an account
              </Link>
              <Link className="pg-button pg-button--quiet"
                    to={`/login?next=${encodeURIComponent(`/programmes/${slug}`)}`}>
                I already have one
              </Link>
            </>
          )}

          {session && !registration && (
            <>
              <h3>Register as {profile?.full_name}</h3>
              <ul className="pg-prefill">
                <li>{profile?.church} · {profile?.archdeaconry}</li>
                <li>{profile?.phone}</li>
                <li>{profile?.email}</li>
              </ul>
              <Link className="pg-editlink" to="/account">Not right? Update your details</Link>

              {extras.map((f) => (
                <label key={f.key} className="pg-field">
                  <span>{f.label}{f.required && " *"}</span>
                  {f.type === "select" ? (
                    <select value={answers[f.key] ?? ""}
                            onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })}>
                      <option value="">Choose one</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea rows={3} value={answers[f.key] ?? ""}
                              onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} />
                  ) : (
                    <input value={answers[f.key] ?? ""}
                           onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}

              <button className="pg-button" onClick={register} disabled={busy || closed}>
                {closed ? "Registration closed"
                  : busy ? "Registering…"
                  : programme.fee_naira > 0
                    ? `Register and pay ${naira(programme.fee_naira)}`
                    : "Register"}
              </button>
            </>
          )}

          {registration && (
            <>
              <h3>You're registered</h3>
              {owes ? (
                <>
                  <p className="pg-note pg-note--warn">
                    Your place is held until payment clears.
                  </p>
                  <button className="pg-button" onClick={() => pay()} disabled={busy}>
                    Pay {naira(registration.amount_naira)}
                  </button>
                  <Link className="pg-button pg-button--quiet"
                        to={`/programmes/${slug}/voucher`}>
                    I have a voucher code
                  </Link>
                </>
              ) : (
                <p className="pg-confirmed">Confirmed · {registration.id.slice(0, 8).toUpperCase()}</p>
              )}

              <hr />
              <h4>Your attendance card</h4>
              {cardPreview ? (
                <>
                  <img className="pg-attending-card" src={cardPreview} alt="Your attendance card" />
                  <button className="pg-button" onClick={share}>Share it</button>
                  <button className="pg-button pg-button--quiet" onClick={makeCard} disabled={busy}>
                    Rebuild with my latest photo
                  </button>
                </>
              ) : (
                <>
                  <p className="pg-note">
                    We'll drop your photo into the "I will be attending" design.
                  </p>
                  <button className="pg-button" onClick={makeCard} disabled={busy}>
                    {busy ? "Building…" : "Make my card"}
                  </button>
                </>
              )}
            </>
          )}

          {notice && <p className="pg-notice">{notice}</p>}
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}