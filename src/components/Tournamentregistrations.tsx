import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PlayerCardButton from "./PlayerCardButton";

/**
 * Registration review — approve or reject players and coaches.
 *
 * Tournament admins see all; an archdeaconry admin sees only registrations
 * for teams in their archdeaconry (enforced by RLS). Shows each registrant's
 * answers to the custom fields.
 */
type Reg = {
  id: string; team_id: string | null; role_in_team: string;
  full_name: string | null; email: string | null; phone: string | null;
  answers: Record<string, any>; status: string; created_at: string; photo_url: string | null;
};
type Field = { id: string; label: string; field_type: string };
type Team = { id: string; name: string };

export default function TournamentRegistrations({ tournamentId }: { tournamentId: string }) {
  const [regs, setRegs] = useState<Reg[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { void load(); }, [tournamentId]);

  async function load() {
    const [{ data: r }, { data: fl }, { data: t }, { data: tourney }] = await Promise.all([
      supabase.from("tournament_registrations").select("*")
        .eq("tournament_id", tournamentId).order("created_at", { ascending: false }),
      supabase.from("tournament_fields").select("id, label, field_type").eq("tournament_id", tournamentId),
      supabase.from("tournament_teams").select("id, name").eq("tournament_id", tournamentId),
      supabase.from("tournaments").select("card_template_url").eq("id", tournamentId).maybeSingle(),
    ]);
    setRegs(r ?? []);
    setFields(fl ?? []);
    setTeams(t ?? []);
    setTemplateUrl(tourney?.card_template_url ?? null);
  }

  async function review(reg: Reg, decision: "approved" | "rejected") {
    setBusy(reg.id);
    const { error } = await supabase.rpc("review_registration", {
      p_registration_id: reg.id, p_decision: decision,
    });
    setBusy(null);
    if (error) { alert(error.message); return; }
    void load();
  }

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const shown = filter === "all" ? regs : regs.filter((r) => r.status === filter);

  const counts = {
    pending: regs.filter((r) => r.status === "pending").length,
    approved: regs.filter((r) => r.status === "approved").length,
    rejected: regs.filter((r) => r.status === "rejected").length,
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded text-sm capitalize ${
                    filter === s ? "bg-[#800000] text-white" : "bg-gray-100"}`}>
            {s}{s !== "all" && ` (${counts[s]})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-gray-500">No {filter === "all" ? "" : filter} registrations.</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">
                    {r.full_name}
                    <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-100 capitalize">{r.role_in_team}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {teamName(r.team_id)} · {r.email} · {r.phone}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  r.status === "approved" ? "bg-green-100 text-green-800"
                    : r.status === "rejected" ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-800"}`}>
                  {r.status}
                </span>
              </div>

              {/* Custom field answers */}
              {Object.keys(r.answers ?? {}).length > 0 && (
                <dl className="text-sm grid sm:grid-cols-2 gap-x-4 gap-y-1 mb-3 border-t pt-2">
                  {Object.entries(r.answers).map(([fid, val]) => (
                    <div key={fid} className="flex gap-2">
                      <dt className="text-gray-500">{fieldLabel(fid)}:</dt>
                      <dd>
                        {typeof val === "string" && val.startsWith("http")
                          ? <a href={val} target="_blank" rel="noreferrer" className="text-blue-600 underline">View file</a>
                          : String(val)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => review(r, "approved")} disabled={busy === r.id}
                          className="bg-green-700 text-white px-4 py-1.5 rounded text-sm">
                    {busy === r.id ? "…" : "Approve"}
                  </button>
                  <button onClick={() => review(r, "rejected")} disabled={busy === r.id}
                          className="bg-red-600 text-white px-4 py-1.5 rounded text-sm">
                    Reject
                  </button>
                </div>
              )}

              {r.status === "approved" && (
                <PlayerCardButton
                  templateUrl={templateUrl}
                  photoUrl={r.photo_url}
                  name={r.full_name ?? ""}
                  team={teamName(r.team_id)}
                  role={r.role_in_team}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}