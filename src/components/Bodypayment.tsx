import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira, startPayment } from "../lib/Payments";
import { useAuth } from "./Authcontext";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Programmes.css";

/**
 * Body payment page — an archdeaconry, parish or church pays for its members.
 *
 * Gated by the programme's access code. Once in, the payer can tick pending
 * registrants who joined under the body's name (settled directly) and/or pay
 * for extra slots that become loose voucher codes. One payment covers both.
 */
export default function BodyPayment() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [programme, setProgramme] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [bodyType, setBodyType] = useState<"archdeaconry" | "parish" | "church">("church");
  const [bodyName, setBodyName] = useState("");
  const [community, setCommunity] = useState("");
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [pending, setPending] = useState<any[]>([]);
  const [coveredIds, setCoveredIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("programmes").select("*").eq("slug", slug).maybeSingle();
      setProgramme(data);
      setLoading(false);
    })();
  }, [slug]);

  async function unlock() {
    setNotice("");
    if (!bodyName.trim()) return setNotice("Enter the body's name.");
    if (!code.trim()) return setNotice("Enter the access code.");

    setBusy(true);
    const { data: ok } = await supabase.rpc("check_access_code", {
      p_programme_id: programme.id, p_code: code.trim(),
    });
    if (!ok) { setBusy(false); return setNotice("That access code isn't correct."); }

    // Load any pending registrations under this body name.
    const { data: regs } = await supabase.rpc("pending_registrations_for_body", {
      p_programme_id: programme.id, p_name: bodyName.trim(),
    });
    setPending(regs ?? []);
    // default: cover all pending, quantity at least that many
    const ids = new Set<string>((regs ?? []).map((r: any) => r.id));
    setCoveredIds(ids);
    setQuantity(Math.max(1, ids.size));
    setUnlocked(true);
    setBusy(false);
  }

  const toggleCover = (id: string) =>
    setCoveredIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      // quantity can't drop below the number covered
      setQuantity((q) => Math.max(q, next.size));
      return next;
    });

  const coveredCount = coveredIds.size;
  const looseCodes = Math.max(quantity - coveredCount, 0);
  const total = quantity * (programme?.fee_naira ?? 0);

  async function pay() {
    if (quantity < coveredCount) {
      setNotice("You can't pay for fewer people than you're covering.");
      return;
    }
    setBusy(true);
    setNotice("");

    const { data: bp, error } = await supabase.from("body_payments").insert({
      programme_id: programme.id,
      payer_user: profile?.id ?? null,
      body_type: bodyType,
      body_name: bodyName.trim(),
      community: bodyType === "church" ? community.trim() || null : null,
      quantity,
      covered_ids: Array.from(coveredIds),
      amount_naira: total,
    }).select().single();

    if (error || !bp) { setBusy(false); return setNotice("Couldn't start payment."); }

    const result = await startPayment({
      purpose: "body_payment",
      referenceId: bp.id,
      amountNaira: total,
      customer: {
        email: profile?.email ?? "",
        name: bodyName.trim(),
      },
      title: `${bodyType} payment · ${programme.title}`,
      description: `${bodyType} paying for ${quantity} place${quantity === 1 ? "" : "s"}`,
    });

    setBusy(false);
    if (result.status === "closed" || result.status === "failed") {
      setNotice("Payment wasn't completed.");
      return;
    }
    navigate(`/body-receipt/${bp.id}`);
  }

  if (loading) return <div><Navbar /><p style={{ padding: 40, textAlign: "center" }}>Loading…</p><SiteFooter /></div>;
  if (!programme) return <div><Navbar /><p style={{ padding: 40, textAlign: "center" }}>Programme not found.</p><SiteFooter /></div>;
  if (programme.fee_naira <= 0) return <div><Navbar /><p style={{ padding: 40, textAlign: "center" }}>This programme is free — no body payment needed.</p><SiteFooter /></div>;

  return (
    <div>
      <Navbar />
      <div className="pg-body-pay">
        <h1>{programme.title}</h1>
        <p className="pg-sub">Archdeaconry / parish / church payment</p>

        {!unlocked ? (
          <div className="pg-card">
            <div className="pg-bodytype">
              {(["archdeaconry", "parish", "church"] as const).map((b) => (
                <button key={b} type="button"
                        className={`pg-chip${bodyType === b ? " is-active" : ""}`}
                        onClick={() => setBodyType(b)}>{b}</button>
              ))}
            </div>
            <input className="pg-input"
                   placeholder={bodyType === "church"
                     ? "Full church name — e.g. Bishop Akinyele Memorial Anglican Church"
                     : `Full ${bodyType} name`}
                   value={bodyName} onChange={(e) => setBodyName(e.target.value)} />
            {bodyType === "church" && (
              <input className="pg-input" placeholder="Community / location"
                     value={community} onChange={(e) => setCommunity(e.target.value)} />
            )}
            <input className="pg-input" placeholder="Access code (from the programme organisers)"
                   value={code} onChange={(e) => setCode(e.target.value)} />
            {notice && <p className="pg-note pg-note--warn">{notice}</p>}
            <button className="pg-button" onClick={unlock} disabled={busy}>
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
        ) : (
          <div className="pg-card">
            <p className="pg-note">
              Paying as <strong>{bodyName}</strong>. Tick anyone who already registered
              under your name, and set how many people in total you're paying for.
            </p>

            {pending.length > 0 && (
              <div className="pg-pending">
                <p className="pg-pending-title">Already registered ({pending.length})</p>
                {pending.map((r) => (
                  <label key={r.id} className="pg-pending-row">
                    <input type="checkbox" checked={coveredIds.has(r.id)}
                           onChange={() => toggleCover(r.id)} />
                    <span>{r.full_name}{r.church ? ` · ${r.church}` : ""}</span>
                  </label>
                ))}
              </div>
            )}

            <label className="pg-qty-label">Total people to pay for</label>
            <input type="number" min={Math.max(1, coveredCount)} className="pg-input"
                   value={quantity}
                   onChange={(e) => setQuantity(Math.max(coveredCount, Number(e.target.value) || 0))} />

            <div className="pg-summary">
              <div><span>Covering registered</span><span>{coveredCount}</span></div>
              <div><span>New voucher codes</span><span>{looseCodes}</span></div>
              <div className="pg-summary-total"><span>Total</span><span>{naira(total)}</span></div>
            </div>

            {notice && <p className="pg-note pg-note--warn">{notice}</p>}
            <button className="pg-button" onClick={pay} disabled={busy}>
              {busy ? "Starting…" : `Pay ${naira(total)}`}
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}