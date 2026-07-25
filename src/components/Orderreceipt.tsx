import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

export default function OrderReceipt() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
      setOrder(data);
      setLoading(false);
    })();
  }, [id]);

  // A payment can land via webhook a moment after the browser returns.
  useEffect(() => {
    if (order?.status !== "pending") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
      if (data?.status && data.status !== "pending") {
        setOrder((o: any) => ({ ...o, status: data.status }));
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [order?.status, id]);

  if (loading) {
    return <div className="store"><Navbar /><p className="store-status">Loading your order…</p></div>;
  }
  if (!order) {
    return (
      <div className="store">
        <Navbar />
        <div className="store-status">
          <h2>We can't find that order</h2>
          <p>If you were debited, contact the youth office with your transaction reference.</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="store">
      <Navbar />

      <div className="receipt">
        <p className="receipt-status" data-status={order.status}>
          {order.status === "paid" ? "Payment received"
            : order.status === "pending" ? "Waiting for payment to clear"
            : "Payment didn't complete"}
        </p>

        <h1>Order {order.order_number}</h1>
        <p className="receipt-sub">
          {new Date(order.created_at).toLocaleString("en-NG")} · {order.full_name}
        </p>

        <ul className="receipt-items">
          {(order.order_items ?? []).map((i: any) => (
            <li key={i.id}>
              <span>{i.quantity} × {i.name_snapshot}{i.variant_snapshot ? ` (${i.variant_snapshot})` : ""}</span>
              <span>{naira(i.unit_price_naira * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <dl className="receipt-totals">
          <div><dt>Items</dt><dd>{naira(order.subtotal_naira)}</dd></div>
          <div><dt>Delivery</dt><dd>{order.delivery_fee_naira ? naira(order.delivery_fee_naira) : "Free"}</dd></div>
          <div className="receipt-total"><dt>Total</dt><dd>{naira(order.total_naira)}</dd></div>
        </dl>

        <p className="receipt-delivery">
          {order.delivery_method === "pickup"
            ? `Collect from: ${order.delivery_address}`
            : `Delivering to: ${order.delivery_address}`}
        </p>

        {order.status === "paid" && (
          <p className="receipt-next">We'll text {order.phone} when it's ready.</p>
        )}

        <div className="receipt-actions">
          <button onClick={() => window.print()}>Print this</button>
          <Link to="/store">Keep shopping</Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}