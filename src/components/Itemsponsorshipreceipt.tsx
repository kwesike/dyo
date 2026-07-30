import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import logo from "../assets/LOGO.jpeg";
import "./Receipt.css";

/**
 * Item sponsorship receipt.
 *
 * Voucher mode: shows the code to hand out.
 * Lucky draw mode: confirms the draw is being set up by the organisers.
 * Polls until settlement mints the code / creates the draw.
 */
export default function ItemSponsorshipReceipt() {
  const { id } = useParams<{ id: string }>();
  const [sp, setSp] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [voucher, setVoucher] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    const { data } = await supabase.from("item_sponsorships").select("*").eq("id", id).maybeSingle();
    setSp(data);
    if (data) {
      const { data: prod } = await supabase.from("products").select("name").eq("id", data.product_id).maybeSingle();
      setProduct(prod);
      if (data.mode === "voucher") {
        const { data: v } = await supabase.from("vouchers")
          .select("code").eq("product_id", data.product_id)
          .eq("source", "item_sponsorship").order("created_at", { ascending: false }).limit(1);
        setVoucher(v?.[0]?.code ?? null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!sp || sp.status === "paid") return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 90_000) return clearInterval(t);
      const { data } = await supabase.from("item_sponsorships").select("status").eq("id", id).maybeSingle();
      if (data?.status === "paid") { void load(); clearInterval(t); }
    }, 4000);
    return () => clearInterval(t);
  }, [sp, id]);

  if (loading) return <div className="rcpt"><Navbar /><p className="rcpt-status">Loading…</p><SiteFooter /></div>;
  if (!sp) return <div className="rcpt"><Navbar /><div className="rcpt-status"><h2>Not found</h2><Link to="/store" className="rcpt-btn">Back to store</Link></div><SiteFooter /></div>;

  const settled = sp.status === "paid";
  const isVoucher = sp.mode === "voucher";

  return (
    <div className="rcpt">
      <Navbar />
      <div className="rcpt-head">
        <p className="rcpt-eyebrow">{settled ? "Thank you for sponsoring" : "Confirming payment"}</p>
        <h1>{settled ? (isVoucher ? "Your voucher is ready" : "Your lucky draw is on the way") : "Almost there…"}</h1>
        <p className="rcpt-sub">
          {!settled ? "This updates the moment payment settles."
            : isVoucher ? "Give this code to the person you're sponsoring — they claim the item free."
            : "The organisers will set up the draw shortly. Watch for it across the site."}
        </p>
      </div>

      <div className="rcpt-card-wrap">
        <div className="rcpt-card">
          <div className="rcpt-card-top">
            <img src={logo} alt="" className="rcpt-logo" />
            <div>
              <p className="rcpt-org">Diocesan Youth Organization</p>
              <p className="rcpt-org-sub">Ibadan North</p>
            </div>
          </div>
          <div className="rcpt-card-body">
            <p className="rcpt-label">Item sponsorship</p>
            <p className="rcpt-amount">{naira(Number(sp.amount_naira))}</p>
            <dl className="rcpt-lines">
              <div><dt>Item</dt><dd>{product?.name ?? "—"}</dd></div>
              <div><dt>Sponsor</dt><dd>{sp.is_anonymous ? "Anonymous" : (sp.sponsor_name || "You")}</dd></div>
              <div><dt>Type</dt><dd>{isVoucher ? "Voucher" : "Lucky draw"}</dd></div>
            </dl>

            {isVoucher && (
              <div className="rcpt-codes">
                <p className="rcpt-codes-title">Voucher code</p>
                {settled && voucher ? (
                  <div className="rcpt-code-grid"><span className="rcpt-code">{voucher}</span></div>
                ) : (
                  <p className="rcpt-codes-wait">Generating your code…</p>
                )}
              </div>
            )}
          </div>
          <div className="rcpt-card-foot">
            <p className="rcpt-thanks">
              {isVoucher
                ? "The recipient enters this code at the store to claim the item free."
                : "Thank you for making someone's day — the draw goes live once the organisers set it up."}
            </p>
          </div>
        </div>
      </div>

      <div className="rcpt-actions">
        <Link to="/store" className="rcpt-btn">Back to store</Link>
      </div>
      <SiteFooter />
    </div>
  );
}