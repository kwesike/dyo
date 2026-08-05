import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import TournamentBracket from "./TournamentBracket";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

/**
 * Public tournaments — list, and a detail view that adapts to the format:
 *   league          → one table
 *   group_knockout  → per-group tables + bracket
 *   knockout        → bracket only
 * Plus live scores, fixtures, results and top scorers.
 */
export default function TournamentsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [scorers, setScorers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [slug]);

  // Realtime: when the admin logs a goal/card or changes a match, the fixtures
  // and events tables change — re-pull so scores, the bracket and scorers
  // update live without a refresh. Only subscribe on a specific tournament.
  useEffect(() => {
    if (!slug || !detail?.id) return;
    const channel = supabase
      .channel(`tournament-${detail.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "fixtures", filter: `tournament_id=eq.${detail.id}` },
        () => void refresh())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "match_events", filter: `tournament_id=eq.${detail.id}` },
        () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [slug, detail?.id]);

  // Lightweight re-pull (no full-page spinner) used by realtime.
  async function refresh() {
    if (!detail?.id) return;
    const [{ data: tm }, { data: fx }, { data: sc }] = await Promise.all([
      supabase.from("tournament_teams").select("*").eq("tournament_id", detail.id),
      supabase.from("fixtures").select("*").eq("tournament_id", detail.id).order("kickoff_at"),
      supabase.from("player_stats").select("*").eq("tournament_id", detail.id).order("goals", { ascending: false }).limit(10),
    ]);
    setTeams(tm ?? []);
    setFixtures(fx ?? []);
    setScorers((sc ?? []).filter((s: any) => s.goals > 0));
  }

  async function load() {
    setLoading(true);
    if (slug) {
      const { data: t } = await supabase.from("tournaments").select("*").eq("slug", slug).maybeSingle();
      setDetail(t);
      if (t) {
        const [{ data: tm }, { data: fx }, { data: sc }] = await Promise.all([
          supabase.from("tournament_teams").select("*").eq("tournament_id", t.id),
          supabase.from("fixtures").select("*").eq("tournament_id", t.id).order("kickoff_at"),
          supabase.from("player_stats").select("*").eq("tournament_id", t.id).order("goals", { ascending: false }).limit(10),
        ]);
        setTeams(tm ?? []);
        setFixtures(fx ?? []);
        setScorers((sc ?? []).filter((s: any) => s.goals > 0));
      }
    } else {
      const { data } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
      setTournaments(data ?? []);
    }
    setLoading(false);
  }

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "TBD";
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  if (loading) return <div className="store"><Navbar /><p className="store-status">Loading…</p><SiteFooter /></div>;

  // ---- list view ----
  if (!slug) {
    return (
      <div className="store">
        <Navbar />
        <header className="store-head">
          <div>
            <p className="store-eyebrow">Diocesan Youth Organization</p>
            <h1>Tournaments</h1>
            <p className="store-sub">Football competitions across the diocese — fixtures, scores and tables.</p>
          </div>
        </header>
        {tournaments.length === 0 ? (
          <div className="store-status"><h2>No tournaments yet</h2><p>Check back soon.</p></div>
        ) : (
          <div className="store-grid">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/tournaments/${t.slug}`} className="store-card">
                <div className="store-card-link">
                  <div className="store-card-image">
                    {t.banner_url ? <img src={t.banner_url} alt="" />
                      : <div className="store-card-placeholder">🏆</div>}
                  </div>
                  <h3>{t.name}</h3>
                  <p className="store-price" style={{ textTransform: "capitalize" }}>{t.status.replace("_", " ")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        <SiteFooter />
      </div>
    );
  }

  if (!detail) return (
    <div className="store"><Navbar />
      <div className="store-status"><h2>Tournament not found</h2>
        <Link to="/tournaments" className="product-add">All tournaments</Link></div>
      <SiteFooter />
    </div>
  );

  const live = fixtures.filter((f) => f.status === "live" || f.status === "half_time");
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const done = fixtures.filter((f) => f.status === "finished");
  const groups = Array.from(new Set(teams.map((t) => t.group_name).filter(Boolean))).sort() as string[];
  const showTables = detail.format !== "knockout";
  const showBracket = detail.format !== "league";

  const sortTable = (list: any[]) => [...list].sort((a, b) =>
    b.points - a.points ||
    (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) ||
    b.goals_for - a.goals_for);

  return (
    <div className="store">
      <Navbar />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px" }}>
        <Link to="/tournaments" className="checkout-back">← All tournaments</Link>
        <h1 style={{ fontFamily: "Georgia, serif", color: "#5c0000" }}>{detail.name}</h1>
        {detail.status === "registration_open" && (
          <Link to={`/tournaments/${slug}/register`} className="product-add"
                style={{ display: "inline-block", marginBottom: 20 }}>
            Register for this tournament
          </Link>
        )}

        {/* Live */}
        {live.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ color: "#b00020" }}>🔴 Live now</h2>
            {live.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "center",
                     gap: 16, padding: 14, border: "2px solid #b00020", borderRadius: 12, marginBottom: 10 }}>
                <span style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>{teamName(f.home_team)}</span>
                <span style={{ fontSize: "1.6rem", fontWeight: 800 }}>{f.home_score} – {f.away_score}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{teamName(f.away_team)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Tables — per group, or one league table */}
        {showTables && (
          <section style={{ marginBottom: 28 }}>
            <h2>{groups.length > 0 ? "Groups" : "Table"}</h2>
            {(groups.length > 0
              ? groups.map((g) => ({ title: `Group ${g}`, rows: teams.filter((t) => t.group_name === g) }))
              : [{ title: "", rows: teams }]
            ).map((block) => (
              <div key={block.title} style={{ marginBottom: 20 }}>
                {block.title && <h3 style={{ fontSize: "1rem" }}>{block.title}</h3>}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ background: "#f4ece9" }}>
                        <th style={{ padding: 8, textAlign: "left" }}>Team</th>
                        <th style={{ padding: 8 }}>P</th><th style={{ padding: 8 }}>W</th>
                        <th style={{ padding: 8 }}>D</th><th style={{ padding: 8 }}>L</th>
                        <th style={{ padding: 8 }}>GD</th><th style={{ padding: 8 }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortTable(block.rows).map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: 8 }}>{t.name}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{t.played}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{t.won}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{t.drawn}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{t.lost}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{t.goals_for - t.goals_against}</td>
                          <td style={{ padding: 8, textAlign: "center", fontWeight: 700 }}>{t.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Bracket */}
        {showBracket && (
          <section style={{ marginBottom: 28 }}>
            <h2>Knockout</h2>
            <TournamentBracket tournamentId={detail.id} teams={teamMap} />
          </section>
        )}

        {/* Top scorers */}
        {scorers.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2>Top scorers</h2>
            <div style={{ display: "grid", gap: 4 }}>
              {scorers.map((s, i) => (
                <div key={s.registration_id} style={{ display: "flex", alignItems: "center",
                       gap: 10, padding: "6px 0", borderBottom: "1px solid #eee" }}>
                  <span style={{ width: 20, color: "#888" }}>{i + 1}</span>
                  {s.photo_url && <img src={s.photo_url} alt="" style={{ width: 28, height: 28,
                                       borderRadius: "50%", objectFit: "cover" }} />}
                  <span style={{ flex: 1 }}>{s.full_name} <span style={{ color: "#888" }}>· {s.team_name}</span></span>
                  <span style={{ fontWeight: 700 }}>{s.goals} ⚽</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fixtures */}
        {upcoming.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2>Fixtures</h2>
            {upcoming.map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between",
                     padding: "10px 0", borderBottom: "1px solid #eee" }}>
                <span>{teamName(f.home_team)} vs {teamName(f.away_team)}</span>
                <span style={{ color: "#888" }}>
                  {f.kickoff_at ? new Date(f.kickoff_at).toLocaleString("en-NG",
                    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "TBD"}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Results */}
        {done.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2>Results</h2>
            {done.map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between",
                     padding: "10px 0", borderBottom: "1px solid #eee" }}>
                <span>{teamName(f.home_team)} vs {teamName(f.away_team)}</span>
                <span style={{ fontWeight: 700 }}>{f.home_score} – {f.away_score}</span>
              </div>
            ))}
          </section>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}