import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./WinnerBanner.css";

/**
 * Live matches on the homepage — shows any match currently in play, updating
 * in real time as the admin logs goals. Hidden when nothing is live.
 */
export default function LiveMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [tourneys, setTourneys] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "fixtures" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const { data: live } = await supabase.from("fixtures").select("*")
      .in("status", ["live", "half_time"]).order("kickoff_at");
    if (!live?.length) { setMatches([]); return; }

    const teamIds = [...new Set(live.flatMap((f: any) => [f.home_team, f.away_team]).filter(Boolean))];
    const tourneyIds = [...new Set(live.map((f: any) => f.tournament_id))];
    const [{ data: tm }, { data: tn }] = await Promise.all([
      supabase.from("tournament_teams").select("id, name").in("id", teamIds),
      supabase.from("tournaments").select("id, name, slug").in("id", tourneyIds),
    ]);
    setTeams(Object.fromEntries((tm ?? []).map((t: any) => [t.id, t.name])));
    setTourneys(Object.fromEntries((tn ?? []).map((t: any) => [t.id, t.slug])));
    setMatches(live);
  }

  if (matches.length === 0) return null;
  const name = (id: string | null) => id ? (teams[id] ?? "—") : "TBD";

  return (
    <div className="wb-banner" style={{ background: "linear-gradient(90deg, #7a0000, #b00020)" }}>
      <span className="wb-label" style={{ background: "#fff", color: "#b00020" }}>🔴 LIVE</span>
      <div className="wb-track">
        <div className="wb-slide">
          {matches.concat(matches).map((m, i) => (
            <Link key={i} to={`/tournaments/${tourneys[m.tournament_id] ?? ""}`}
                  className="wb-item" style={{ color: "#fff", textDecoration: "none" }}>
              <strong>{name(m.home_team)} {m.home_score}–{m.away_score} {name(m.away_team)}</strong>
              {m.minute != null && <span style={{ opacity: 0.85 }}> · {m.minute}'</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}