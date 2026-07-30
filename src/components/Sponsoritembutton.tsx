import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira, startPayment } from "../lib/Payments";
import { useAuth } from "./Authcontext";
import "./Store.css";

/**
 * "Sponsor this item" — drop-in button + modal for a store product.
 *
 * The sponsor pays the item's price and chooses what happens:
 *   • Voucher — they get a code to give someone, who claims the item free.
 *   • Lucky draw — a sitewide draw for the item; the winner claims it free.
 *
 * On payment the settle function mints the voucher or creates the draw
 * (awaiting admin setup). Voucher sponsors land on a receipt with the code.
 */
export default function SponsorItemButton({
  product,
}: {
  product: { id: string; name: string; price_naira: number };
}) {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"voucher" | "lucky_draw">("voucher");
  const [anon, setAnon] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function sponsor() {
    if (!profile) { navigate("/login"); return; }
    setBusy(true);
    setNotice("");

    const { data: sp, error } = await supabase.from("item_sponsorships").insert({
      product_id: product.id,
      sponsor_user: profile.id,
      sponsor_name: anon ? null : (name.trim() || profile.full_name || null),
      is_anonymous: anon,
      mode,
      amount_naira: product.price_naira,
    }).select().single();

    if (error || !sp) { setBusy(false); setNotice("Couldn't start. Try again."); return; }

    const result = await startPayment({
      purpose: "item_sponsorship",
      referenceId: sp.id,
      amountNaira: product.price_naira,
      customer: { email: profile.email ?? "", name: anon ? "Anonymous" : (name.trim() || profile.full_name || "") },
      title: `Sponsor · ${product.name}`,
      description: mode === "voucher" ? "Item sponsorship (voucher)" : "Item sponsorship (lucky draw)",
    });

    setBusy(false);
    if (result.status === "closed" || result.status === "failed") {
      setNotice("Payment wasn't completed.");
      return;
    }

    // Voucher sponsors get a receipt with their code; draw sponsors get a
    // short confirmation (the draw goes to admin for setup).
    if (mode === "voucher") navigate(`/item-sponsorship/${sp.id}`);
    else navigate(`/item-sponsorship/${sp.id}`);
  }

  return (
    <>
      <button className="store-sponsor-btn" onClick={() => setOpen(true)}>
        Sponsor this item
      </button>

      {open && (
        <div className="store-modal-scrim" onClick={() => setOpen(false)}>
          <div className="store-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sponsor {product.name}</h3>
            <p className="store-modal-price">{naira(product.price_naira)}</p>

            <p className="store-modal-label">How should it be given?</p>
            <div className="store-mode-row">
              <button className={`store-mode${mode === "voucher" ? " is-active" : ""}`}
                      onClick={() => setMode("voucher")}>
                <strong>Voucher code</strong>
                <span>You get a code to give to someone specific.</span>
              </button>
              <button className={`store-mode${mode === "lucky_draw" ? " is-active" : ""}`}
                      onClick={() => setMode("lucky_draw")}>
                <strong>Lucky draw</strong>
                <span>A sitewide draw — a lucky member wins it.</span>
              </button>
            </div>

            <label className="store-anon">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              Sponsor anonymously
            </label>
            {!anon && (
              <input className="store-input" placeholder="Your name (shown as the sponsor)"
                     value={name} onChange={(e) => setName(e.target.value)} />
            )}

            {notice && <p className="store-note">{notice}</p>}

            <button className="store-sponsor-btn store-sponsor-btn--go"
                    onClick={sponsor} disabled={busy}>
              {busy ? "Starting…" : `Pay ${naira(product.price_naira)}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}