import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { naira } from "../lib/Payments";
import {
  composeAttendingCard, uploadAttendingCard, shareCard, DEFAULT_CARD_CONFIG,
} from "../lib/Attendingcard";
import Navbar from "./Navbar";
import "./Programmes.css";

/**
 * Confirmation page after a programme registration payment.
 *
 * THIS PAGE NEVER WRITES PAYMENT STATUS. The old version's pattern — land on
 * the page, assume success, update the row — is exactly the hole the
 * verify-payment function exists to close. Anyone can navigate straight to
 * /success/<some-id> by typing it in the address bar. If arriving here were
 * enough to mark a registration paid, the entire payment flow would be
 * decorative.
 *
 * All this does is READ the row and report what the server already decided.
 */

type Row = {
  id: string;
  full_name: string;
  payment_status: string;
  amount_naira?: number;
  attending_card_url?: string | null;
  photo_url?: string | null;
  programmes?: {
    title: string;
    slug: string;
    starts_at: string | null;
    venue: string | null;
    attending_template_url: string | null;
    card_config?: unknown;
  } | null;
};

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 90_000;

export default function SuccessPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [legacy, setLegacy] = useState(false);
  const [waitedOut, setWaitedOut] = useState(false);

  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    // New table first.
    const { data } = await supabase
      .from("programme_registrations")
      .select(`
        id, full_name, payment_status, amount_naira, attending_card_url, photo_url,
        programmes ( title, slug, starts_at, venue, attending_template_url, card_config )
      `)
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setRow(data as unknown as Row);
      if (data.attending_card_url) setCardUrl(data.attending_card_url);
      setLoading(false);
      return data.payment_status;
    }

    // Fall back to the original convention table so links issued before the
    // restructure still resolve. Remove this once that data is migrated.
    const { data: old } = await supabase
      .from("registrations")
      .select("id, full_name, payment_status, photo_url")
      .eq("id", id)
      .maybeSingle();

    if (old) {
      setLegacy(true);
      setRow({
        id: String(old.id),
        full_name: old.full_name,
        payment_status: old.payment_status ?? "pending",
        photo_url: old.photo_url,
      });
    }

    setLoading(false);
    return old?.payment_status;
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  /**
   * A payment can settle a moment after the browser returns — the webhook may
   * land before or after the callback. Poll briefly rather than telling someone
   * their payment failed when it is merely a few seconds behind.
   */
  useEffect(() => {
    if (!row || isSettled(row.payment_status)) return;

    const timer = setInterval(async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setWaitedOut(true);
        clearInterval(timer);
        return;
      }
      const status = await load();
      if (status && isSettled(status)) clearInterval(timer);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [row, load]);

  async function makeCard() {
    const programme = row?.programmes;
    if (!programme?.attending_template_url) {
      return setNotice("The attendance card for this programme isn't ready yet.");
    }
    const photo = row?.photo_url ?? profile?.photo_url;
    if (!photo) {
      return setNotice("Add a photo to your profile and the card can be generated.");
    }

    setBusy(true);
    setNotice("");
    try {
      const blob = await composeAttendingCard({
        templateUrl: programme.attending_template_url,
        photoUrl: photo,
        name: row!.full_name,
        config: (programme.card_config as never) ?? DEFAULT_CARD_CONFIG,
      });
      const url = await uploadAttendingCard(blob, row!.id);
      await supabase.from("programme_registrations")
        .update({ attending_card_url: url }).eq("id", row!.id);

      setCardBlob(blob);
      setCardUrl(URL.createObjectURL(blob));
    } catch {
      setNotice("Couldn't build the card. Try a different profile photo.");
    }
    setBusy(false);
  }

  async function share() {
    let blob = cardBlob;
    if (!blob && cardUrl) blob = await (await fetch(cardUrl)).blob();
    if (!blob || !row) return;
    await shareCard(
      blob,
      `${row.programmes?.slug ?? "programme"}-attending.png`,
      `I will be attending ${row.programmes?.title ?? "this programme"}!`,
    );
  }

  if (loading) return <><Navbar /><p className="pg-status">Loading…</p></>;

  if (!row) {
    return (
      <>
        <Navbar />
        <div className="pg-status">
          <h2>We can't find that registration</h2>
          <p>
            If you were debited, send your transaction reference to the youth
            office and it will be sorted out.
          </p>
          <Link to="/programmes">See all programmes</Link>
        </div>
      </>
    );
  }

  const paid = row.payment_status === "paid" || row.payment_status === "not_required";
  const pending = !paid && !waitedOut;

  return (
    <div className="pg-detail">
      <Navbar />

      <div className="pg-success">
        <span className={`pg-pill pg-pill--${paid ? "open" : "opens_later"}`}>
          {paid ? "Confirmed" : pending ? "Confirming payment…" : "Not confirmed yet"}
        </span>

        <h1>
          {paid
            ? `You're in, ${row.full_name.split(" ")[0]}`
            : "Hold on a moment"}
        </h1>

        {row.programmes && (
          <p className="pg-success-event">
            <strong>{row.programmes.title}</strong>
            {row.programmes.starts_at &&
              ` · ${new Date(row.programmes.starts_at).toLocaleDateString("en-NG",
                { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
            {row.programmes.venue && <><br />{row.programmes.venue}</>}
          </p>
        )}

        {paid ? (
          <>
            <p className="pg-note">
              Your reference is <strong>{row.id.slice(0, 8).toUpperCase()}</strong>.
              Bring it with you — a screenshot is fine.
            </p>

            {row.programmes?.attending_template_url && (
              <div className="pg-success-card">
                <h3>Tell people you're coming</h3>
                {cardUrl ? (
                  <>
                    <img className="pg-attending-card" src={cardUrl}
                         alt="Your attendance card" />
                    <button className="pg-button" onClick={share}>Share it</button>
                  </>
                ) : (
                  <>
                    <p className="pg-note">
                      We'll put your photo into the "I will be attending" design.
                    </p>
                    <button className="pg-button" onClick={makeCard} disabled={busy}>
                      {busy ? "Building…" : "Make my card"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : pending ? (
          <p className="pg-note">
            Your payment is still clearing with the bank. This page updates itself —
            you don't need to pay again or refresh.
          </p>
        ) : (
          <p className="pg-note pg-note--warn">
            We haven't had confirmation from the bank yet. If you were debited,
            it usually lands within a few minutes and your place is held.
            {row.amount_naira ? ` Amount: ${naira(row.amount_naira)}.` : ""} If
            nothing changes in an hour, contact the youth office with your
            transaction reference.
          </p>
        )}

        {notice && <p className="pg-notice">{notice}</p>}

        {legacy && (
          <p className="pg-note">
            This is a registration from before the site was updated.
          </p>
        )}

        <div className="pg-success-actions">
          <Link className="pg-button pg-button--quiet" to="/account">
            My account
          </Link>
          <Link className="pg-button pg-button--quiet" to="/programmes">
            Other programmes
          </Link>
        </div>
      </div>
    </div>
  );
}

const isSettled = (status?: string) =>
  status === "paid" || status === "not_required" || status === "refunded";