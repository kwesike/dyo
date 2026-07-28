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
 * Body payment receipt — for an archdeaconry/parish/church that paid for its
 * members. Shows who was covered, how many, and any loose voucher codes minted
 * for members who haven't registered yet. Polls until settlement mints codes.
 */
export default function BodyReceipt() {
  const { id } = useParams<{ id: string }>();
  const cardRef = useRef<HTMLDivElement>(null);

  const [bp, setBp] = useState<any>(null);
  const [programme, setProgramme] = useState<any>(null);
  const [vouchers, setVouchers] = useState<{ code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    const { data } = await supabase.from("body_payments").select("*").eq("id", id).maybeSingle();
    setBp(data);
    if (data) {
      const [{ data: prog }, { data: vs }] = await Promise.all([
        supabase.from("programmes").select("title").eq("id", data.programme_id).maybeSingle(),
        supabase.from("vouchers").select("code").eq("body_ref", data.id).order("created_at"),
      ]);
      setProgramme(prog);
      setVouchers(vs ?? []);
    }
    setLoading(false);
  }

  const covered = bp ? (bp.covered_ids?.length ?? 0) : 0;
  const expectedCodes = bp ? Math.max(bp.quantity - covered, 0) : 0;

  useEffect(() => {
    if (!bp || bp.status === "paid") return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 90_000) return clearInterval(t);
      const { data } = await supabase.from("body_payments").select("status").eq("id", id).maybeSingle();
      if (data?.status === "paid") {
        void load();
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [bp, id]);

  async function download() {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: "#fff", useCORS: true });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `body-payment-${(id ?? "").slice(0, 8)}.png`;
    a.click();
  }

  if (loading) return <div className="rcpt"><Navbar /><p className="rcpt-status">Loading…</p><SiteFooter /></div>;
  if (!bp) return <div className="rcpt"><Navbar /><div className="rcpt-status"><h2>Not found</h2><Link to="/programmes" className="rcpt-btn">Back</Link></div><SiteFooter /></div>;

  const settled = bp.status === "paid";

  return (
    <div className="rcpt">
      <Navbar />
      <div className="rcpt-head">
        <p className="rcpt-eyebrow">{settled ? "Payment received" : "Confirming payment"}</p>
        <h1>{settled ? "Thank you" : "Almost there…"}</h1>
        <p className="rcpt-sub">
          {settled
            ? `${bp.body_name} has covered ${bp.quantity} ${bp.quantity === 1 ? "place" : "places"}.`
            : "Your receipt updates the moment payment settles."}
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
            <p className="rcpt-label">{bp.body_type} payment</p>
            <p className="rcpt-amount">{naira(Number(bp.amount_naira))}</p>

            <dl className="rcpt-lines">
              <div><dt>{bp.body_type}</dt><dd>{bp.body_name}</dd></div>
              {bp.community && <div><dt>Community</dt><dd>{bp.community}</dd></div>}
              <div><dt>Programme</dt><dd>{programme?.title ?? "—"}</dd></div>
              <div><dt>Total places</dt><dd>{bp.quantity}</dd></div>
              <div><dt>Existing members covered</dt><dd>{covered}</dd></div>
            </dl>

            {expectedCodes > 0 && (
              <div className="rcpt-codes">
                <p className="rcpt-codes-title">Voucher codes ({expectedCodes})</p>
                {settled && vouchers.length ? (
                  <div className="rcpt-code-grid">
                    {vouchers.map((v) => <span key={v.code} className="rcpt-code">{v.code}</span>)}
                  </div>
                ) : (
                  <p className="rcpt-codes-wait">Generating codes…</p>
                )}
              </div>
            )}
          </div>

          <div className="rcpt-card-foot">
            <p className="rcpt-thanks">
              Covered members are confirmed. Give each voucher code to a member who
              hasn't registered yet — each registers one person free.
            </p>
          </div>
        </div>
      </div>

      <div className="rcpt-actions">
        <button className="rcpt-btn" onClick={download} disabled={!settled}>Download receipt</button>
        <Link to="/programmes" className="rcpt-btn rcpt-btn--quiet">Back to programmes</Link>
      </div>
      <SiteFooter />
    </div>
  );
}