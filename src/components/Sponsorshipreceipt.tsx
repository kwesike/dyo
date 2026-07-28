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
 * Sponsorship receipt.
 *
 * After paying to sponsor N registrations, the sponsor lands here: their name
 * (or Anonymous), the programme, the amount, and the N voucher codes minted for
 * them to hand out. Codes appear once the payment settles (verifier or webhook
 * mints them), so the page polls briefly until they show.
 */
export default function SponsorshipReceipt() {
  const { id } = useParams<{ id: string }>();
  const cardRef = useRef<HTMLDivElement>(null);

  const [sponsorship, setSponsorship] = useState<any>(null);
  const [programme, setProgramme] = useState<any>(null);
  const [vouchers, setVouchers] = useState<{ code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    const { data: sp } = await supabase
      .from("sponsorships").select("*").eq("id", id).maybeSingle();
    setSponsorship(sp);
    if (sp) {
      const [{ data: prog }, { data: vs }] = await Promise.all([
        supabase.from("programmes").select("title, starts_at").eq("id", sp.programme_id).maybeSingle(),
        supabase.from("vouchers").select("code").eq("sponsor_ref", sp.id).order("created_at"),
      ]);
      setProgramme(prog);
      setVouchers(vs ?? []);
    }
    setLoading(false);
  }

  // Codes appear when payment settles — poll until they do (up to ~90s).
  useEffect(() => {
    if (!sponsorship || vouchers.length >= (sponsorship?.quantity ?? 0)) return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 90_000) return clearInterval(t);
      const { data: vs } = await supabase
        .from("vouchers").select("code").eq("sponsor_ref", id).order("created_at");
      if (vs && vs.length > 0) {
        setVouchers(vs);
        if (vs.length >= (sponsorship?.quantity ?? 0)) clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [sponsorship, vouchers.length, id]);

  async function download() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: "#fff", useCORS: true });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `sponsorship-${(id ?? "").slice(0, 8)}.png`;
      a.click();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="rcpt"><Navbar /><p className="rcpt-status">Loading…</p><SiteFooter /></div>;
  if (!sponsorship) {
    return (
      <div className="rcpt"><Navbar />
        <div className="rcpt-status">
          <h2>We can't find that sponsorship</h2>
          <Link to="/programmes" className="rcpt-btn">Back to programmes</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const who = sponsorship.is_anonymous ? "Anonymous" : (sponsorship.sponsor_name || "Anonymous");
  const settled = vouchers.length > 0;

  return (
    <div className="rcpt">
      <Navbar />

      <div className="rcpt-head">
        <p className="rcpt-eyebrow">{settled ? "Thank you for sponsoring" : "Confirming your payment"}</p>
        <h1>{settled ? "Your sponsorship is ready" : "Almost there…"}</h1>
        <p className="rcpt-sub">
          {settled
            ? `Share these ${vouchers.length} code${vouchers.length === 1 ? "" : "s"} — each lets one person register free.`
            : "Your voucher codes will appear here the moment payment settles."}
        </p>
      </div>

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
            <p className="rcpt-label">Sponsorship receipt</p>
            <p className="rcpt-amount">{naira(Number(sponsorship.amount_naira))}</p>

            <dl className="rcpt-lines">
              <div><dt>Sponsor</dt><dd>{who}</dd></div>
              <div><dt>Programme</dt><dd>{programme?.title ?? "—"}</dd></div>
              <div><dt>People sponsored</dt><dd>{sponsorship.quantity}</dd></div>
              <div><dt>Date</dt><dd>{new Date(sponsorship.created_at).toLocaleDateString("en-NG",
                { day: "numeric", month: "long", year: "numeric" })}</dd></div>
            </dl>

            {/* the codes */}
            <div className="rcpt-codes">
              <p className="rcpt-codes-title">Voucher codes</p>
              {settled ? (
                <div className="rcpt-code-grid">
                  {vouchers.map((v) => (
                    <span key={v.code} className="rcpt-code">{v.code}</span>
                  ))}
                </div>
              ) : (
                <p className="rcpt-codes-wait">Generating your codes…</p>
              )}
            </div>
          </div>

          <div className="rcpt-card-foot">
            <p className="rcpt-thanks">
              Each code registers one attendee free. Give one to each person you're sponsoring.
            </p>
          </div>
        </div>
      </div>

      <div className="rcpt-actions">
        <button className="rcpt-btn" onClick={download} disabled={saving || !settled}>
          {saving ? "Preparing…" : "Download receipt"}
        </button>
        <Link to="/programmes" className="rcpt-btn rcpt-btn--quiet">Back to programmes</Link>
      </div>

      <SiteFooter />
    </div>
  );
}