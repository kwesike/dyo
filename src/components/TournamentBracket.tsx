import { supabase } from "../lib/supabaseClient";
import { useEffect, useState } from "react";

/**
 * Visual knockout bracket — renders the rounds left-to-right as a tree
 * (round of 16 → quarters → semis → final), each match a small card, with
 * the winner highlighted. Reads knockout fixtures (stage <> 'group').
 */
const STAGE_ORDER = ["round_32", "round_16", "quarter", "semi", "final"];
const STAGE_LABEL: Record<string, string> = {
  round_32: "Round of 32", round_16: "Round of 16", quarter: "Quarter-finals",
  semi: "Semi-finals", final: "Final",
};

export default function TournamentBracket({ tournamentId, teams }: {
  tournamentId: string; teams: Record<string, string>;
}) {
  const [fixtures, setFixtures] = useState<any[]>([]);

  useEffect(() => { void load(); }, [tournamentId]);

  async function load() {
    const { data } = await supabase.from("fixtures").select("*")
      .eq("tournament_id", tournamentId).neq("stage", "group")
      .order("bracket_slot");
    setFixtures(data ?? []);
  }

  const stages = STAGE_ORDER.filter((st) => fixtures.some((f) => f.stage === st));
  if (stages.length === 0) {
    return <p className="text-gray-500">No knockout matches yet. Build the bracket in the Fixtures tab.</p>;
  }

  const name = (id: string | null) => id ? (teams[id] ?? "—") : "TBD";
  const winner = (f: any) =>
    f.status !== "finished" ? null
      : f.home_score > f.away_score ? f.home_team
      : f.away_score > f.home_score ? f.away_team : null;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 16 }}>
      <div style={{ display: "flex", gap: 32, minWidth: "min-content" }}>
        {stages.map((st) => {
          const matches = fixtures.filter((f) => f.stage === st).sort((a, b) => a.bracket_slot - b.bracket_slot);
          return (
            <div key={st} style={{ display: "flex", flexDirection: "column",
                   justifyContent: "space-around", gap: 16, minWidth: 190 }}>
              <p style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase",
                          color: "#800000", textAlign: "center" }}>{STAGE_LABEL[st]}</p>
              {matches.map((f) => {
                const w = winner(f);
                return (
                  <div key={f.id} style={{ border: "1px solid #e0d5d5", borderRadius: 8,
                         overflow: "hidden", background: "#fff" }}>
                    <Row name={name(f.home_team)} score={f.home_score}
                         win={w === f.home_team && w !== null} live={f.status === "live"} />
                    <div style={{ height: 1, background: "#eee" }} />
                    <Row name={name(f.away_team)} score={f.away_score}
                         win={w === f.away_team && w !== null} live={f.status === "live"} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ name, score, win, live }: { name: string; score: number; win: boolean; live: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", background: win ? "#f4ffe9" : "transparent",
                  fontWeight: win ? 700 : 400 }}>
      <span style={{ fontSize: "0.85rem", color: name === "TBD" ? "#aaa" : "#222" }}>{name}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 700,
                     color: live ? "#b00020" : "#555" }}>{score}</span>
    </div>
  );
}