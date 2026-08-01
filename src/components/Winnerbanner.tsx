import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Winnerbanner.css";

/**
 * Winner announcement banner — a news-style ticker on the homepage.
 *
 * Shows draws won in the last 20 hours: the winner's name and the item.
 * Slides across like breaking news, then the announcement expires (drops
 * out) once it's older than 20 hours.
 */
type Won = {
  id: string;
  product_name: string;
  winner_name: string;
  won_at: string;
};

const WINDOW_HOURS = 20;

export default function WinnerBanner() {
  const [wins, setWins] = useState<Won[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

    // Draws won within the window (won or closed both count as "won").
    const { data: draws } = await supabase
      .from("lucky_draws")
      .select("id, product_id, winner_user, won_at, state")
      .in("state", ["won", "closed"])
      .gte("won_at", since)
      .order("won_at", { ascending: false });

    if (!draws?.length) { setWins([]); return; }

    // Resolve product names and winner names.
    const productIds = [...new Set(draws.map((d: any) => d.product_id))];
    const winnerIds = [...new Set(draws.map((d: any) => d.winner_user).filter(Boolean))];

    const [{ data: prods }, { data: people }] = await Promise.all([
      supabase.from("products").select("id, name").in("id", productIds),
      winnerIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", winnerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = Object.fromEntries((prods ?? []).map((p: any) => [p.id, p.name]));
    const peopleMap = Object.fromEntries((people ?? []).map((p: any) => [p.id, p.full_name]));

    setWins(draws.map((d: any) => ({
      id: d.id,
      product_name: prodMap[d.product_id] ?? "a prize",
      winner_name: peopleMap[d.winner_user] ?? "A lucky member",
      won_at: d.won_at,
    })));
  }

  if (wins.length === 0) return null;

  // Build the ticker text — repeat so it reads continuously.
  const items = wins.map((w) => (
    <span className="wb-item" key={w.id}>
      🎉 <strong>{w.winner_name}</strong> just won <strong>{w.product_name}</strong>!
    </span>
  ));

  return (
    <div className="wb-banner" role="status" aria-label="Recent lucky draw winners">
      <span className="wb-label">🏆 Winner</span>
      <div className="wb-track">
        <div className="wb-slide">
          {items}
          {items /* duplicate for a seamless loop */}
        </div>
      </div>
    </div>
  );
}