import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "./Cartcontext";
import { useAuth } from "./Authcontext";
import { naira, startPayment } from "../lib/Payments";
import { ARCHDEACONRIES, DELIVERY_FEE_NAIRA, PICKUP_POINTS } from "../lib/Constants";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

type Delivery = "pickup" | "ibadan" | "outside_ibadan";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { lines, subtotal, setQuantity, remove, clear } = useCart();
  const { session, profile } = useAuth();

  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    archdeaconry: "", pickup_point: PICKUP_POINTS[0], delivery_address: "", note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      full_name: f.full_name || profile.full_name || "",
      email: f.email || profile.email || "",
      phone: f.phone || profile.phone || "",
      archdeaconry: f.archdeaconry || profile.archdeaconry || "",
      delivery_address: f.delivery_address || profile.address || "",
    }));
  }, [profile]);

  const deliveryFee = DELIVERY_FEE_NAIRA[delivery];
  const total = subtotal + deliveryFee;

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  if (lines.length === 0) {
    return (
      <div className="store">
        <Navbar />
        <div className="store-status">
          <h2>Your cart is empty</h2>
          <p>Pick something out and it'll show up here.</p>
          <Link className="product-add" to="/store">Go to the store</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  async function placeOrder() {
    setError("");

    if (!form.full_name || !form.email || !form.phone) {
      return setError("We need your name, email and phone to reach you about this order.");
    }
    if (delivery !== "pickup" && !form.delivery_address.trim()) {
      return setError("Add the address we should deliver to.");
    }

    setBusy(true);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: session?.user.id ?? null,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        delivery_method: delivery === "pickup" ? "pickup" : "delivery",
        delivery_address: delivery === "pickup" ? form.pickup_point : form.delivery_address.trim(),
        archdeaconry: form.archdeaconry,
        subtotal_naira: subtotal,
        delivery_fee_naira: deliveryFee,
        total_naira: total,
        note: form.note.trim() || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      setBusy(false);
      return setError("We couldn't create that order. Try again.");
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        variant_id: l.variant_id,
        name_snapshot: l.name,
        variant_snapshot: l.variant_label,
        unit_price_naira: l.unit_price_naira,
        quantity: l.quantity,
      })),
    );

    if (itemsError) {
      setBusy(false);
      return setError("We couldn't save the items. Try again.");
    }

    const result = await startPayment({
      purpose: "order",
      referenceId: order.id,
      amountNaira: total,
      customer: { email: form.email, name: form.full_name, phone: form.phone },
      title: "Diocesan Youth Organization",
      description: `Order ${order.order_number}`,
    });

    setBusy(false);

    if (result.status === "success") {
      clear();
      navigate(`/orders/${order.id}`, { replace: true });
    } else if (result.status === "failed") {
      setError(result.message ?? "That payment didn't complete. Your order is saved as unpaid.");
    }
  }

  return (
    <div className="store">
      <Navbar />

      <div className="checkout">
        <Link to="/store" className="checkout-back">← Keep shopping</Link>
        <h1>Checkout</h1>

        <div className="checkout-layout">
          <section className="checkout-items">
            <h2>Your items</h2>
            {lines.map((l) => (
              <div key={l.key} className="checkout-line">
                {l.image && <img src={l.image} alt="" />}
                <div className="checkout-line-body">
                  <p className="checkout-line-name">{l.name}</p>
                  {l.variant_label && <p className="checkout-line-variant">Size {l.variant_label}</p>}
                  <p className="checkout-line-price">{naira(l.unit_price_naira)}</p>
                </div>
                <div className="checkout-line-actions">
                  <div className="product-stepper">
                    <button onClick={() => setQuantity(l.key, l.quantity - 1)}>−</button>
                    <span>{l.quantity}</span>
                    <button onClick={() => setQuantity(l.key, l.quantity + 1)}>+</button>
                  </div>
                  <button className="linkish" onClick={() => remove(l.key)}>Remove</button>
                </div>
              </div>
            ))}
          </section>

          <section className="checkout-form">
            {!session && (
              <p className="checkout-tip">
                <Link to={`/login?next=${encodeURIComponent("/cart")}`}>Sign in</Link> and
                we'll fill this in for you — and keep your order history.
              </p>
            )}

            <h2>Where it's going</h2>

            <div className="checkout-choices">
              {([
                ["pickup", "Collect it", "Free"],
                ["ibadan", "Deliver in Ibadan", naira(DELIVERY_FEE_NAIRA.ibadan)],
                ["outside_ibadan", "Deliver outside Ibadan", naira(DELIVERY_FEE_NAIRA.outside_ibadan)],
              ] as [Delivery, string, string][]).map(([value, label, price]) => (
                <button key={value}
                        className={delivery === value ? "is-active" : ""}
                        onClick={() => setDelivery(value)}>
                  <span>{label}</span>
                  <span className="checkout-choice-price">{price}</span>
                </button>
              ))}
            </div>

            <input name="full_name" placeholder="Full name" value={form.full_name} onChange={set} />
            <input name="email" type="email" placeholder="Email" value={form.email} onChange={set} />
            <input name="phone" placeholder="Phone number" value={form.phone} onChange={set} />

            <select name="archdeaconry" value={form.archdeaconry} onChange={set}>
              <option value="">Your archdeaconry</option>
              {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
            </select>

            {delivery === "pickup" ? (
              <select name="pickup_point" value={form.pickup_point} onChange={set}>
                {PICKUP_POINTS.map((p) => <option key={p}>{p}</option>)}
              </select>
            ) : (
              <textarea name="delivery_address" rows={3}
                        placeholder="Delivery address — street, area, landmark"
                        value={form.delivery_address} onChange={set} />
            )}

            <textarea name="note" rows={2} placeholder="Anything we should know? (optional)"
                      value={form.note} onChange={set} />
          </section>

          <aside className="checkout-summary">
            <h2>Summary</h2>
            <dl>
              <div><dt>Items</dt><dd>{naira(subtotal)}</dd></div>
              <div><dt>Delivery</dt><dd>{deliveryFee ? naira(deliveryFee) : "Free"}</dd></div>
              <div className="checkout-total"><dt>Total</dt><dd>{naira(total)}</dd></div>
            </dl>

            {error && <p className="checkout-error">{error}</p>}

            <button className="product-add" onClick={placeOrder} disabled={busy}>
              {busy ? "Opening payment…" : `Pay ${naira(total)}`}
            </button>
            <p className="product-fineprint">
              Card, transfer and USSD, handled by Flutterwave.
            </p>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}