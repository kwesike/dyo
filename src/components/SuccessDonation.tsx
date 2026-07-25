import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import logo from "../assets/LOGO.jpeg";
import "./Receipt.css";

/**
 * Donation receipt.
 *
 * A donation is a small act of trust, so the page thanks the person plainly
 * and hands them something that looks worth keeping — a proper receipt with
 * the org's mark, the amount in words the finance team would recognise, and a
 * reference they can quote. The card is what html2canvas captures, so it's
 * built to look right both on screen and as a downloaded image.
 */
export default function SuccessDonation() {
  const { id } = useParams<{ id: string }>();
  const cardRef = useRef<HTMLDivElement>(null);

  const [donation, setDonation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("donations").select("*").eq("id", id).maybeSingle();
      setDonation(data);
      setLoading(false);
    })();
  }, [id]);

  // A donation settles via the webhook a moment after the browser returns —
  // poll briefly so "pending" turns into "received" without a manual refresh.
  useEffect(() => {
    if (donation?.status !== "pending") return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 90_000) return clearInterval(t);
      const { data } = await supabase
        .from("donations").select("status").eq("id", id).maybeSingle();
      if (data?.status && data.status !== "pending") {
        setDonation((d: any) => ({ ...d, status: data.status }));
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [donation?.status, id]);

  async function download() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, backgroundColor: "#ffffff", useCORS: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `DYO-donation-${(id ?? "").slice(0, 8)}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rcpt"><Navbar /><p className="rcpt-status">Loading…</p><SiteFooter /></div>;
  }
  if (!donation) {
    return (
      <div className="rcpt">
        <Navbar />
        <div className="rcpt-status">
          <h2>We can't find that donation</h2>
          <p>If you were debited, contact the youth office with your reference.</p>
          <Link to="/donate" className="rcpt-btn">Back to Give</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const settled = donation.status === "paid" || donation.status === "successful";
  const ref = (id ?? "").slice(0, 8).toUpperCase();
  const when = new Date(donation.created_at).toLocaleDateString("en-NG",
    { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="rcpt">
      <Navbar />

      <div className="rcpt-head">
        <p className="rcpt-eyebrow">{settled ? "Received with thanks" : "Almost there"}</p>
        <h1>{settled ? "Thank you for your gift" : "We're confirming your gift"}</h1>
        <p className="rcpt-sub">
          {settled
            ? "Your generosity keeps the work of the youth moving. Here's your receipt."
            : "Your payment is settling — this page will update in a moment."}
        </p>
      </div>

      {/* The card html2canvas captures */}
      <div className="rcpt-card-wrap">
        <div className="rcpt-card" ref={cardRef}>
          <div className="rcpt-card-top">
            <img src={logo} alt="" className="rcpt-logo" />
            <div>
              <p className="rcpt-org">Diocesan Youth Organization</p>
              <p className="rcpt-org-sub">Ibadan North</p>
            </div>
          </div>

          <div className="rcpt-card-body">
            <p className="rcpt-label">Donation receipt</p>

            <p className="rcpt-amount">{naira(Number(donation.amount))}</p>

            <dl className="rcpt-lines">
              <div><dt>From</dt><dd>{donation.full_name || "Anonymous"}</dd></div>
              {donation.email && <div><dt>Email</dt><dd>{donation.email}</dd></div>}
              <div><dt>Date</dt><dd>{when}</dd></div>
              <div><dt>Reference</dt><dd className="rcpt-ref">{ref}</dd></div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`rcpt-pill ${settled ? "is-ok" : "is-wait"}`}>
                    {settled ? "Received" : "Confirming…"}
                  </span>
                </dd>
              </div>
            </dl>

            {donation.message && (
              <p className="rcpt-message">"{donation.message}"</p>
            )}
          </div>

          <div className="rcpt-card-foot">
            <img
              className="rcpt-barcode"
              src={`https://barcodeapi.org/api/128/${id}`}
              alt=""
              crossOrigin="anonymous"
            />
            <p className="rcpt-thanks">
              "God loves a cheerful giver." — 2 Corinthians 9:7
            </p>
          </div>
        </div>
      </div>

      <div className="rcpt-actions">
        <button className="rcpt-btn" onClick={download} disabled={saving}>
          {saving ? "Preparing…" : "Download receipt"}
        </button>
        <Link to="/" className="rcpt-btn rcpt-btn--quiet">Back to home</Link>
      </div>

      <SiteFooter />
    </div>
  );
}