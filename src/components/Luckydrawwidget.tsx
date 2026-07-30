import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import "./Luckydraw.css";

/**
 * Floating lucky-draw widget.
 *
 * Mounts once at the app root so it shows on every page. It surfaces the most
 * recent ACTIVE draw. Everyone sees it; only signed-in users can enter — a
 * signed-out click sends them to login. First-claim draws resolve instantly;
 * spin/timed just record the entry.
 *
 * The winner and any secret rig live server-side and are never sent here.
 */
type Draw = {
  id: string;
  product_id: string;
  product_name?: string;
  product_image?: string;
  sponsor_display: string | null;
  draw_type: string | null;
  state: string;
  winner_user: string | null;
};

export default function LuckyDrawWidget() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [open, setOpen] = useState(true);
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => { void load(); }, [session?.user.id]);

  // Light polling so a newly-activated draw appears, and a resolved one clears.
  useEffect(() => {
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [session?.user.id]);

  async function load() {
    // First: has this user won a draw they haven't claimed yet? (spin/timed
    // winners find out here even if they weren't watching when it was drawn.)
    if (session) {
      const { data: wonDraw } = await supabase
        .from("lucky_draws")
        .select("*")
        .eq("winner_user", session.user.id)
        .is("claimed_order", null)
        .order("won_at", { ascending: false })
        .limit(1);
      if (wonDraw?.[0]) {
        const w = wonDraw[0] as Draw;
        const { data: prod } = await supabase
          .from("products").select("name, images").eq("id", w.product_id).maybeSingle();
        w.product_name = prod?.name;
        w.product_image = prod?.images?.[0];
        setDraw(w);
        setResult("won");
        setEntered(true);
        return;
      }
    }

    // Otherwise: most recent active draw (RLS lets everyone read active draws).
    const { data } = await supabase
      .from("lucky_draws")
      .select("*")
      .eq("state", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    const d = data?.[0] as Draw | undefined;
    if (!d) { setDraw(null); return; }

    // fetch product name/image for display
    const { data: prod } = await supabase
      .from("products").select("name, images").eq("id", d.product_id).maybeSingle();
    d.product_name = prod?.name;
    d.product_image = prod?.images?.[0];

    setDraw(d);

    // has this user already entered?
    if (session) {
      const { data: e } = await supabase
        .from("draw_entries").select("id").eq("draw_id", d.id).eq("user_id", session.user.id).maybeSingle();
      setEntered(!!e);
    }
  }

  async function enter() {
    if (!session) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setResult("");
    const { data, error } = await supabase.rpc("enter_draw", { p_draw_id: draw!.id });
    const res = Array.isArray(data) ? data[0] : data;
    setBusy(false);

    if (error || !res?.ok) { setResult(res?.reason ?? "Couldn't enter. Try again."); return; }

    setEntered(true);
    if (res.won) {
      setResult("won");
      void load();
    } else {
      setResult(res.reason ?? "You're in the draw. Good luck!");
    }
  }

  if (!draw) return null;
  if (dismissed.includes(draw.id)) return null;

  return (
    <div className={`ld-widget${open ? "" : " ld-widget--min"}`}>
      {open ? (
        <div className="ld-card">
          <button className="ld-close" onClick={() => setOpen(false)} aria-label="Minimise">–</button>

          <div className="ld-shine">🎁 Lucky draw</div>

          {draw.product_image && (
            <img className="ld-img" src={draw.product_image} alt={draw.product_name ?? ""} />
          )}
          <p className="ld-item">{draw.product_name ?? "A prize"}</p>
          <p className="ld-sponsor">Sponsored by {draw.sponsor_display ?? "a supporter"}</p>

          <p className="ld-how">
            {draw.draw_type === "first_claim" ? "First to claim wins it!"
              : draw.draw_type === "timed" ? "Enter — a winner is drawn soon."
              : "Enter — a lucky winner will be spun."}
          </p>

          {result === "won" ? (
            <div className="ld-won">
              <p className="ld-won-text">🎉 You won!</p>
              <button className="ld-enter" onClick={() => navigate(`/claim/${draw.id}`)}>
                Claim your prize
              </button>
            </div>
          ) : result ? (
            <p className="ld-result">{result}</p>
          ) : null}

          {result !== "won" && (!entered ? (
            <button className="ld-enter" onClick={enter} disabled={busy}>
              {busy ? "…" : session
                ? (draw.draw_type === "first_claim" ? "Claim it!" : "Enter draw")
                : "Sign in to enter"}
            </button>
          ) : (
            <p className="ld-entered">✓ You're in</p>
          ))}

          <button className="ld-dismiss" onClick={() => setDismissed((d) => [...d, draw.id])}>
            Not interested
          </button>
        </div>
      ) : (
        <button className="ld-bubble" onClick={() => setOpen(true)}>🎁</button>
      )}
    </div>
  );
}