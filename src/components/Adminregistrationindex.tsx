import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import { formatEventDate } from "../lib/programmeWindow";

/**
 * Registrations, by programme.
 *
 * The nav needs somewhere to land when nobody has picked a programme yet —
 * without this, /admin/registrations is a dead link and the only way in is
 * through the programmes list.
 */
export default function AdminRegistrationsIndex() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: programmes }, { data: stats }] = await Promise.all([
      supabase.from("programmes").select("*")
        .order("starts_at", { ascending: false, nullsFirst: false }),
      supabase.from("programme_stats").select("*"),
    ]);
    const byId = Object.fromEntries((stats ?? []).map((s: any) => [s.id, s]));
    setRows((programmes ?? []).map((p) => ({ ...p, stats: byId[p.id] ?? {} })));
    setLoading(false);
  }

  /**
   * Hard delete. A programme with registrations can't be removed while those
   * rows point at it, so we clear the children first — deliberately, and only
   * after a confirm that says exactly how many registrations will be lost.
   */
  async function remove(p: any) {
    const registered = p.stats.total_registered ?? 0;
    const warning = registered > 0
      ? `Delete "${p.title}"? This also permanently removes ${registered} registration${registered === 1 ? "" : "s"} and their payment records. This cannot be undone.`
      : `Delete "${p.title}"? This cannot be undone.`;

    if (!confirm(warning)) return;
    if (registered > 0 && !confirm(`Really delete ${registered} people's registrations? Type-check: this is permanent.`)) return;

    setBusyId(p.id);

    // Children first, then the programme itself.
    await supabase.from("payments").delete()
      .eq("purpose", "registration")
      .in("reference_id",
        (await supabase.from("programme_registrations").select("id").eq("programme_id", p.id))
          .data?.map((r) => r.id) ?? []);
    await supabase.from("programme_registrations").delete().eq("programme_id", p.id);
    const { error } = await supabase.from("programmes").delete().eq("id", p.id);

    setBusyId(null);

    if (error) {
      alert("Couldn't delete that programme. It may have linked records that need clearing first.");
      return;
    }
    void load();
  }

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">Programmes</p>
          <h1>Registrations</h1>
          <p>Pick a programme to see everyone registered, check people in, or export the list.</p>
        </div>
        <Link to="/admin/programmes" className="a-btn">New programme</Link>
      </div>

      {rows.length === 0 ? (
        <div className="a-empty">
          <h3>No programmes yet</h3>
          <p>Registrations appear here once a programme exists.</p>
          <Link to="/admin/programmes" className="a-btn">Create a programme</Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Date</th>
                <th>Registered</th>
                <th>Paid</th>
                <th>Checked in</th>
                <th>Collected</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    {!p.is_published && (
                      <span className="a-pill a-pill--draft" style={{ marginLeft: 8 }}>
                        Draft
                      </span>
                    )}
                  </td>
                  <td>{p.starts_at ? formatEventDate(p.starts_at) : "—"}</td>
                  <td>{p.stats.total_registered ?? 0}</td>
                  <td>{p.stats.total_paid ?? 0}</td>
                  <td>{p.stats.total_checked_in ?? 0}</td>
                  <td>{naira(p.stats.revenue_naira ?? 0)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link to={`/admin/programmes/${p.id}/registrations`}
                          className="a-btn a-btn--ghost">
                      Open →
                    </Link>
                    <button className="a-btn a-btn--ghost" style={{ color: "var(--red)" }}
                            disabled={busyId === p.id}
                            onClick={() => remove(p)}>
                      {busyId === p.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}