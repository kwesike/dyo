import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Lucky draw management.
 *
 * When a sponsor picks "lucky draw", a draw lands here awaiting setup.
 * The admin chooses how it's won — first to claim, a random spin, or a
 * timed draw — and may secretly pre-attach a winner. Active draws can be
 * drawn (for spin/timed) to pick the winner.
 */
type Draw = {
  id: string;
  product_id: string;
  sponsor_display: string | null;
  state: string;
  draw_type: string | null;
  winner_user: string | null;
  rigged_user: string | null;
  created_at: string;
};

export default function AdminDraws() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // setup form state per draw
  const [setup, setSetup] = useState<Record<string, { type: string; drawsAt: string; rigged: string }>>({});

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: d }, { data: prods }, { data: mem }] = await Promise.all([
      supabase.from("lucky_draws").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);
    setDraws(d ?? []);
    setProducts(Object.fromEntries((prods ?? []).map((p: any) => [p.id, p.name])));
    setMembers(mem ?? []);
    setLoading(false);
  }

  const field = (id: string) => setup[id] ?? { type: "first_claim", drawsAt: "", rigged: "" };
  const setField = (id: string, patch: Partial<{ type: string; drawsAt: string; rigged: string }>) =>
    setSetup((s) => ({ ...s, [id]: { ...field(id), ...patch } }));

  async function activate(d: Draw) {
    const f = field(d.id);
    if (f.type === "timed" && !f.drawsAt) { alert("Pick a draw time."); return; }
    setBusyId(d.id);
    const { error } = await supabase.rpc("activate_draw", {
      p_draw_id: d.id,
      p_type: f.type,
      p_draws_at: f.type === "timed" ? new Date(f.drawsAt).toISOString() : null,
      p_rigged_user: f.rigged || null,
    });
    setBusyId(null);
    if (error) { alert(error.message); return; }
    void load();
  }

  async function drawWinner(d: Draw) {
    if (!confirm("Draw the winner now?")) return;
    setBusyId(d.id);
    const { data, error } = await supabase.rpc("draw_winner", { p_draw_id: d.id });
    setBusyId(null);
    if (error) { alert(error.message); return; }
    if (!data) { alert("Nobody entered this draw yet."); return; }
    void load();
  }

  const memberName = (uid: string | null) => {
    if (!uid) return "—";
    const m = members.find((x) => x.id === uid);
    return m?.full_name || m?.email || uid.slice(0, 8);
  };

  const awaiting = draws.filter((d) => d.state === "awaiting_setup");
  const active = draws.filter((d) => d.state === "active");
  const done = draws.filter((d) => d.state === "won" || d.state === "closed");

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Lucky draws</h1>
      <p className="text-gray-600 mb-6">
        When someone sponsors an item as a lucky draw, set it up here and pick a winner.
      </p>

      {/* Awaiting setup — needs the admin's attention */}
      {awaiting.length > 0 && (
        <>
          <h2 className="font-semibold text-lg mb-2">Needs setup ({awaiting.length})</h2>
          <div className="grid gap-4 mb-8">
            {awaiting.map((d) => {
              const f = field(d.id);
              return (
                <div key={d.id} className="border rounded-lg p-4 bg-amber-50">
                  <p className="font-semibold">{products[d.product_id] ?? "Item"}</p>
                  <p className="text-sm text-gray-600 mb-3">Sponsored by {d.sponsor_display ?? "someone"}</p>

                  <label className="block text-sm font-medium mb-1">How is it won?</label>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {[
                      ["first_claim", "First to claim"],
                      ["random_spin", "Random spin"],
                      ["timed", "Timed draw"],
                    ].map(([val, label]) => {
                      const isOn = f.type === val;
                      return (
                        <button key={val}
                                onClick={() => setField(d.id, { type: val })}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  fontSize: "0.9rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: isOn ? "2px solid #800000" : "2px solid #e0d5d5",
                                  background: isOn ? "#800000" : "#fff",
                                  color: isOn ? "#fff" : "#5c0000",
                                }}>
                          {isOn ? "✓ " : ""}{label}
                        </button>
                      );
                    })}
                  </div>

                  {f.type === "timed" && (
                    <div className="mb-3">
                      <label className="block text-sm mb-1">Draw at</label>
                      <input type="datetime-local" className="border rounded px-3 py-2"
                             value={f.drawsAt} onChange={(e) => setField(d.id, { drawsAt: e.target.value })} />
                    </div>
                  )}

                  <label className="block text-sm mb-1">
                    Secretly pre-attach a winner <span className="text-gray-400">(optional — kept hidden)</span>
                  </label>
                  <select className="border rounded px-3 py-2 w-full mb-4 text-sm"
                          value={f.rigged} onChange={(e) => setField(d.id, { rigged: e.target.value })}>
                    <option value="">No — let it play out</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                    ))}
                  </select>

                  <button onClick={() => activate(d)} disabled={busyId === d.id}
                          className="bg-[#800000] text-white px-4 py-2 rounded">
                    {busyId === d.id ? "Activating…" : "Activate draw"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Active */}
      {active.length > 0 && (
        <>
          <h2 className="font-semibold text-lg mb-2">Live ({active.length})</h2>
          <div className="grid gap-3 mb-8">
            {active.map((d) => (
              <div key={d.id} className="border rounded-lg p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{products[d.product_id] ?? "Item"}</p>
                  <p className="text-sm text-gray-600">
                    {d.draw_type === "first_claim" ? "First to claim wins"
                      : d.draw_type === "random_spin" ? "Random spin"
                      : "Timed draw"}
                    {d.rigged_user && <span className="ml-2 text-purple-700">· pre-attached winner set</span>}
                  </p>
                </div>
                {d.draw_type !== "first_claim" && (
                  <button onClick={() => drawWinner(d)} disabled={busyId === d.id}
                          className="bg-[#800000] text-white px-4 py-2 rounded">
                    {busyId === d.id ? "Drawing…" : "Draw winner"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Finished */}
      {done.length > 0 && (
        <>
          <h2 className="font-semibold text-lg mb-2">Finished ({done.length})</h2>
          <div className="grid gap-2">
            {done.map((d) => (
              <div key={d.id} className="border rounded p-3 flex justify-between text-sm">
                <span>{products[d.product_id] ?? "Item"}</span>
                <span className="text-gray-600">Winner: {memberName(d.winner_user)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {draws.length === 0 && (
        <p className="text-gray-500 py-10 text-center">
          No lucky draws yet. They appear when someone sponsors a store item as a draw.
        </p>
      )}
    </div>
  );
}