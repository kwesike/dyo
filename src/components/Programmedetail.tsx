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

  // Paid-programme registration: after the row is created, we ask HOW they're
  // paying before taking money. null = chooser not open.
  const [payMode, setPayMode] = useState<null | "choose" | "voucher" | "body">(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [bodyType, setBodyType] = useState<"archdeaconry" | "parish" | "church">("church");
  const [bodyName, setBodyName] = useState("");
  const [bodyCommunity, setBodyCommunity] = useState("");
  const [bodyNeedsVoucher, setBodyNeedsVoucher] = useState(false);

  // Sponsor-others flow
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorQty, setSponsorQty] = useState(1);
  const [sponsorAnon, setSponsorAnon] = useState(false);
  const [sponsorName, setSponsorName] = useState("");

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
    // Paid programme → open the "how are you paying?" chooser.
    // Free programme → nothing more to do.
    if (needsPayment) setPayMode("choose");
  }

  /* ---------- sponsor others ---------- */
  async function sponsorPay() {
    if (sponsorQty < 1) { setNotice("How many people are you sponsoring?"); return; }
    if (!sponsorAnon && !sponsorName.trim()) { setNotice("Enter your name, or choose anonymous."); return; }

    setBusy(true);
    setNotice("");

    const amount = programme.fee_naira * sponsorQty;
    const { data: sp, error } = await supabase.from("sponsorships").insert({
      programme_id: programme.id,
      sponsor_name: sponsorAnon ? null : sponsorName.trim(),
      is_anonymous: sponsorAnon,
      quantity: sponsorQty,
      amount_naira: amount,
      sponsor_user: profile?.id ?? null,
    }).select().single();

    if (error || !sp) { setBusy(false); setNotice("Couldn't start the sponsorship."); return; }

    // Pay through the same secure path; verifier mints the vouchers on success.
    const result = await startPayment({
      purpose: "sponsorship",
      referenceId: sp.id,
      amountNaira: amount,
      customer: {
        email: profile?.email ?? "",
        name: sponsorAnon ? "Anonymous" : sponsorName.trim(),
      },
      title: `Sponsor ${sponsorQty} · ${programme.title}`,
      description: `Sponsoring ${sponsorQty} registration${sponsorQty === 1 ? "" : "s"}`,
    });

    setBusy(false);

    const _status = (result as any)?.status as string | undefined;
    if (_status === "success" || _status === "already_verified") {
      navigate(`/sponsorship/${sp.id}`);
    } else if (_status === "cancelled") {
      setNotice("Payment cancelled.");
    } else {
      // Webhook will settle it; send them to the receipt which polls.
      navigate(`/sponsorship/${sp.id}`);
    }
  }

  /* ---------- redeem a voucher ---------- */
  async function redeemVoucher(reg = registration) {
    if (!reg) return;
    if (!voucherCode.trim()) { setNotice("Enter your voucher code."); return; }

    setBusy(true);
    setNotice("");

    const { data, error } = await supabase.rpc("redeem_voucher", {
      p_code: voucherCode.trim(),
      p_programme_id: programme.id,
      p_registration_id: reg.id,
    });

    const result = Array.isArray(data) ? data[0] : data;
    setBusy(false);

    if (error || !result?.ok) {
      setNotice(result?.reason ?? "That voucher couldn't be used.");
      return;
    }

    // Voucher good → mark registration paid and stamp who sponsored it.
    await supabase.from("programme_registrations").update({
      payment_status: "paid",
      sponsor_type: result.identity_type,
      sponsor_name: result.identity_name,
      sponsor_body_type: result.body_type,
    }).eq("id", reg.id);

    setPayMode(null);
    setNotice("Voucher accepted — you're registered.");
    void load();
  }

  /* ---------- body (archdeaconry/parish/church) pays ---------- */
  async function checkBodyPaid() {
    if (!bodyName.trim()) { setNotice("Enter the name."); return; }
    setBusy(true);
    // Has this body already paid for this programme? If so, this registrant
    // must supply one of that body's voucher codes.
    const { data } = await supabase.rpc("body_has_paid", {
      p_programme_id: programme.id,
      p_name: bodyName.trim(),
    });
    setBusy(false);
    setBodyNeedsVoucher(!!data);
    if (data) {
      setNotice("This " + bodyType + " has already paid — enter the voucher code they gave you.");
    } else {
      // Not paid yet → record the body on the registration; it stays pending
      // until the body pays via their payment page.
      void recordBodyPending();
    }
  }

  async function recordBodyPending() {
    if (!registration) return;
    setBusy(true);
    await supabase.from("programme_registrations").update({
      sponsor_type: "body",
      sponsor_body_type: bodyType,
      sponsor_name: bodyName.trim(),
      sponsor_community: bodyType === "church" ? bodyCommunity.trim() || null : null,
      payment_status: "pending",
    }).eq("id", registration.id);
    setBusy(false);
    setPayMode(null);
    setNotice("Recorded. Your place is held — it's confirmed once your " + bodyType + " completes payment.");
    void load();
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

      // Paid programmes: from the same photo + details, also build the printable
      // attendance TAG from the programme's tag template, and file it so it shows
      // in the admin "Paid programme tags" tab. One user action, two images.
      if (programme.fee_naira > 0 && programme.attending_tag_url) {
        try {
          const tagBlob = await composeAttendingCard({
            templateUrl: programme.attending_tag_url,
            photoUrl: photo,
            details: {
              name: profile?.full_name ?? registration?.full_name ?? "",
              church: registration?.church ?? profile?.church,
              archdeaconry: registration?.archdeaconry ?? profile?.archdeaconry,
            },
            config: programme.tag_config ?? programme.card_config ?? DEFAULT_CARD_CONFIG,
          });
          const tagPath = `tag-${registration.id}.png`;
          const { error: upErr } = await supabase.storage
            .from("attending-cards").upload(tagPath, tagBlob, { upsert: true, contentType: "image/png" });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("attending-cards").getPublicUrl(tagPath);
            await supabase.from("programme_registrations")
              .update({ attending_tag_generated_url: `${pub.publicUrl}?v=${Date.now()}` })
              .eq("id", registration.id);
          }
        } catch {
          // The tag is an admin convenience — never block the user's card on it.
        }
      }
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
                  <button className="pg-button pg-button--quiet"
                          onClick={() => setPayMode("choose")}>
                    Use a voucher or body payment instead
                  </button>
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

          {/* Sponsoring others is independent of your own registration —
              always available on a paid programme. */}
          {programme.fee_naira > 0 && (
            <div className="pg-sponsor-cta">
              <hr />
              <h4>Sponsor others</h4>
              <p className="pg-note">
                Pay for one or more people to attend. You'll get a voucher code
                for each — hand them out, and each registers free.
              </p>
              <button className="pg-button pg-button--quiet"
                      onClick={() => setSponsorOpen(true)} disabled={busy}>
                Sponsor people for this programme
              </button>
            </div>
          )}

          {notice && <p className="pg-notice">{notice}</p>}
        </aside>
      </div>


      {/* ---- payment mode chooser (paid programmes) ---- */}
      {payMode && (
        <div className="pg-modal-scrim" onClick={() => setPayMode(null)}>
          <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
            {payMode === "choose" && (
              <>
                <h3>How will you pay?</h3>
                <p className="pg-note">Choose one to complete your registration.</p>
                <button className="pg-button" onClick={() => { setPayMode(null); void pay(); }}>
                  I'll pay myself · {naira(programme.fee_naira)}
                </button>
                <button className="pg-button pg-button--quiet" onClick={() => setPayMode("voucher")}>
                  I have a sponsorship voucher
                </button>
                <button className="pg-button pg-button--quiet" onClick={() => setPayMode("body")}>
                  My archdeaconry / parish / church will pay
                </button>
              </>
            )}

            {payMode === "voucher" && (
              <>
                <h3>Enter your voucher</h3>
                <p className="pg-note">The code from whoever sponsored you.</p>
                <input className="pg-input" placeholder="Voucher code"
                       value={voucherCode}
                       onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
                <button className="pg-button" onClick={() => redeemVoucher()} disabled={busy}>
                  {busy ? "Checking…" : "Use voucher"}
                </button>
                <button className="pg-button pg-button--quiet" onClick={() => setPayMode("choose")}>
                  Back
                </button>
              </>
            )}

            {payMode === "body" && (
              <>
                <h3>Which body is paying?</h3>
                <div className="pg-bodytype">
                  {(["archdeaconry", "parish", "church"] as const).map((b) => (
                    <button key={b} type="button"
                            className={`pg-chip${bodyType === b ? " is-active" : ""}`}
                            onClick={() => { setBodyType(b); setBodyNeedsVoucher(false); }}>
                      {b}
                    </button>
                  ))}
                </div>

                <input className="pg-input"
                       placeholder={bodyType === "church"
                         ? "Full church name — e.g. Bishop Akinyele Memorial Anglican Church"
                         : `Full ${bodyType} name (no abbreviations)`}
                       value={bodyName} onChange={(e) => setBodyName(e.target.value)} />

                {bodyType === "church" && (
                  <input className="pg-input" placeholder="Community / location — e.g. Akinyele"
                         value={bodyCommunity} onChange={(e) => setBodyCommunity(e.target.value)} />
                )}

                {bodyNeedsVoucher ? (
                  <>
                    <p className="pg-note pg-note--warn">
                      This {bodyType} has already paid — enter the voucher code they gave you.
                    </p>
                    <input className="pg-input" placeholder="Voucher code"
                           value={voucherCode}
                           onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
                    <button className="pg-button" onClick={() => redeemVoucher()} disabled={busy}>
                      {busy ? "Checking…" : "Use voucher"}
                    </button>
                  </>
                ) : (
                  <button className="pg-button" onClick={checkBodyPaid} disabled={busy}>
                    {busy ? "Checking…" : "Continue"}
                  </button>
                )}

                <button className="pg-button pg-button--quiet" onClick={() => setPayMode("choose")}>
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- sponsor others modal ---- */}
      {sponsorOpen && (
        <div className="pg-modal-scrim" onClick={() => setSponsorOpen(false)}>
          <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sponsor others</h3>
            <p className="pg-note">
              Pay for one or more people. You'll get a voucher code for each, to
              hand out — they register free with it.
            </p>

            <label className="pg-field-label">How many people?</label>
            <input className="pg-input" type="number" min={1} style={{ textTransform: "none" }}
                   value={sponsorQty}
                   onChange={(e) => setSponsorQty(Math.max(1, Number(e.target.value)))} />

            <label className="pg-field-label">Your name on the receipt</label>
            <input className="pg-input" style={{ textTransform: "none" }}
                   placeholder="Your name"
                   value={sponsorName} disabled={sponsorAnon}
                   onChange={(e) => setSponsorName(e.target.value)} />

            <label className="pg-check">
              <input type="checkbox" checked={sponsorAnon}
                     onChange={(e) => setSponsorAnon(e.target.checked)} />
              Give anonymously
            </label>

            <div className="pg-total">
              Total: <strong>{naira(programme.fee_naira * sponsorQty)}</strong>
              <span className="pg-total-sub">{sponsorQty} × {naira(programme.fee_naira)}</span>
            </div>

            <button className="pg-button" onClick={sponsorPay} disabled={busy}>
              {busy ? "Starting…" : `Pay ${naira(programme.fee_naira * sponsorQty)}`}
            </button>
            <button className="pg-button pg-button--quiet" onClick={() => setSponsorOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}