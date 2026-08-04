import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Live match console — the admin runs a match from here.
 *
 * Logging a goal (with the scorer) updates the score automatically (a DB
 * trigger recomputes it from events) AND feeds player stats. Cards and
 * assists are logged the same way. This is what makes scores and scorers
 * update live.
 */
type Player = { id: string; full_name: string; team_id: string | null };
type Event = { id: string; event_type: string; minute: number | null;
  player_id: string | null; team_id: string | null };

export default function MatchConsole({ fixture, onClose }: {
  fixture: any; onClose: () => void;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [minute, setMinute] = useState("");

  useEffect(() => { void load(); }, [fixture.id]);

  async function load() {
    const [{ data: regs }, { data: evs }, { data: tm }] = await Promise.all([
      supabase.from("tournament_registrations")
        .select("id, full_name, team_id")
        .eq("tournament_id", fixture.tournament_id).eq("status", "approved").eq("role_in_team", "player"),
      supabase.from("match_events").select("*").eq("fixture_id", fixture.id).order("minute"),
      supabase.from("tournament_teams").select("id, name").eq("tournament_id", fixture.tournament_id),
    ]);
    setPlayers(regs ?? []);
    setEvents(evs ?? []);
    setTeams(Object.fromEntries((tm ?? []).map((t: any) => [t.id, t.name])));
  }

  // players on each side
  const homePlayers = players.filter((p) => p.team_id === fixture.home_team);
  const awayPlayers = players.filter((p) => p.team_id === fixture.away_team);

  async function addEvent(type: string, playerId: string, teamId: string | null) {
    if (!playerId && type !== "own_goal") return;
    const player = players.find((p) => p.id === playerId);
    await supabase.from("match_events").insert({
      fixture_id: fixture.id,
      tournament_id: fixture.tournament_id,
      team_id: teamId ?? player?.team_id ?? null,
      player_id: playerId || null,
      event_type: type,
      minute: minute ? Number(minute) : null,
    });
    void load();
  }

  async function removeEvent(id: string) {
    await supabase.from("match_events").delete().eq("id", id);
    void load();
  }

  const playerName = (id: string | null) =>
    id ? (players.find((p) => p.id === id)?.full_name ?? "—") : "—";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {teams[fixture.home_team]} vs {teams[fixture.away_team]}
          </h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm">Minute:</label>
          <input type="number" className="border rounded px-2 py-1 w-20"
                 value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="min" />
        </div>

        {/* Two columns — home and away, each with goal/card actions per player */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: teams[fixture.home_team], list: homePlayers, teamId: fixture.home_team },
            { label: teams[fixture.away_team], list: awayPlayers, teamId: fixture.away_team },
          ].map((side) => (
            <div key={side.teamId}>
              <p className="font-semibold mb-2">{side.label}</p>
              {side.list.length === 0 && <p className="text-xs text-gray-400">No approved players.</p>}
              {side.list.map((p) => (
                <div key={p.id} className="border rounded p-2 mb-1.5 text-sm">
                  <p className="font-medium mb-1">{p.full_name}</p>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => addEvent("goal", p.id, side.teamId)}
                            className="text-xs px-2 py-0.5 rounded bg-green-600 text-white">⚽ Goal</button>
                    <button onClick={() => addEvent("assist", p.id, side.teamId)}
                            className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">Assist</button>
                    <button onClick={() => addEvent("yellow", p.id, side.teamId)}
                            className="text-xs px-2 py-0.5 rounded bg-yellow-400">🟨</button>
                    <button onClick={() => addEvent("red", p.id, side.teamId)}
                            className="text-xs px-2 py-0.5 rounded bg-red-600 text-white">🟥</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Event log */}
        <div>
          <p className="font-semibold mb-2">Match events</p>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">No events yet.</p>
          ) : (
            <div className="grid gap-1">
              {events.map((e) => (
                <div key={e.id} className="flex justify-between items-center text-sm border-b py-1">
                  <span>
                    {e.minute != null ? `${e.minute}' ` : ""}
                    {e.event_type === "goal" ? "⚽" : e.event_type === "assist" ? "🅰️"
                      : e.event_type === "yellow" ? "🟨" : e.event_type === "red" ? "🟥" : "•"}
                    {" "}{playerName(e.player_id)}
                    <span className="text-gray-400"> · {teams[e.team_id ?? ""] ?? ""}</span>
                  </span>
                  <button onClick={() => removeEvent(e.id)} className="text-red-500 text-xs">remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}