import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { PICKUP_POINTS, ARCHDEACONRIES } from "../lib/Constants";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

/**
 * Claim a won lucky-draw prize.
 *
 * Only the winner (checked server-side) can claim. They give pickup/delivery
 * details, and claim_draw creates a free order — from there it's a normal
 * order they collect like any other.
 */
export default function ClaimPrize() {
  const { drawId } = useParams<{ drawId: string }>();
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  const [draw, setDraw] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "",
    pickup_point: "", delivery_address: "", archdeaconry: "",
  });

  useEffect(() => { void load(); }, [drawId, session?.user.id]);

  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      full_name: f.full_name || profile.full_name || "",
      phone: f.phone || profile.phone || "",
      email: f.email || profile.email || "",
      archdeaconry: f.archdeaconry || profile.archdeaconry || "",
    }));
  }, [profile]);

  async function load() {
    const { data: d } = await supabase.from("lucky_draws").select("*").eq("id", drawId).maybeSingle();
    setDraw(d);
    if (d) {
      const { data: p } = await supabase.from("products").select("name, images").eq("id", d.product_id).maybeSingle();
      setProduct(p);
    }
    setLoading(false);
  }

  async function claim() {
    setError("");
    if (!form.full_name || !form.phone || !form.email) {
      return setError("We need your name, phone and email.");
    }
    if (delivery === "pickup" && !form.pickup_point) return setError("Choose a pickup point.");
    if (delivery === "delivery" && !form.delivery_address.trim()) return setError("Add a delivery address.");

    setBusy(true);
    const { data, error: err } = await supabase.rpc("claim_draw", {
      p_draw_id: drawId,
      p_full_name: form.full_name.trim(),
      p_phone: form.phone.trim(),
      p_email: form.email.trim(),
      p_delivery_method: delivery,
      p_delivery_address: delivery === "pickup" ? form.pickup_point : form.delivery_address.trim(),
      p_archdeaconry: form.archdeaconry || null,
    });
    const res = Array.isArray(data) ? data[0] : data;
    setBusy(false);

    if (err || !res?.ok) { setError(res?.reason ?? "Couldn't claim. Try again."); return; }
    navigate(`/orders/${res.order_id}`, { replace: true });
  }

  if (loading) return <div className="store"><Navbar /><p className="store-status">Loading…</p><SiteFooter /></div>;

  if (!session) {
    return (
      <div className="store"><Navbar />
        <div className="store-status">
          <h2>Sign in to claim your prize</h2>
          <Link className="product-add" to="/login">Sign in</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!draw || draw.winner_user !== session.user.id) {
    return (
      <div className="store"><Navbar />
        <div className="store-status">
          <h2>This prize isn't yours to claim</h2>
          <p>Only the winner can claim it.</p>
          <Link className="product-add" to="/store">Back to store</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (draw.claimed_order) {
    return (
      <div className="store"><Navbar />
        <div className="store-status">
          <h2>Already claimed 🎉</h2>
          <p>You've claimed this prize.</p>
          <Link className="product-add" to={`/orders/${draw.claimed_order}`}>View your order</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="store">
      <Navbar />
      <div className="checkout">
        <h1>Claim your prize 🎉</h1>
        <p className="checkout-tip">
          You won <strong>{product?.name ?? "a prize"}</strong>! Tell us where to send it —
          it's completely free.
        </p>

        <div className="checkout-form" style={{ maxWidth: 480 }}>
          <div className="checkout-choices">
            <button className={delivery === "pickup" ? "is-active" : ""} onClick={() => setDelivery("pickup")}>
              <span>Collect it</span><span className="checkout-choice-price">Free</span>
            </button>
            <button className={delivery === "delivery" ? "is-active" : ""} onClick={() => setDelivery("delivery")}>
              <span>Deliver it</span><span className="checkout-choice-price">—</span>
            </button>
          </div>

          <input placeholder="Full name" value={form.full_name}
                 onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input placeholder="Phone" value={form.phone}
                 onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="email" placeholder="Email" value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <select value={form.archdeaconry} onChange={(e) => setForm({ ...form, archdeaconry: e.target.value })}>
            <option value="">Your archdeaconry</option>
            {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
          </select>

          {delivery === "pickup" ? (
            <select value={form.pickup_point} onChange={(e) => setForm({ ...form, pickup_point: e.target.value })}>
              <option value="">— Select your pickup point —</option>
              {PICKUP_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <textarea rows={3} placeholder="Delivery address" value={form.delivery_address}
                      onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
          )}

          {error && <p className="checkout-error">{error}</p>}

          <button className="product-add" onClick={claim} disabled={busy}>
            {busy ? "Claiming…" : "Claim my prize"}
          </button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}