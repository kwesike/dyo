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

  useEffect(() => {
    (async () => {
      const [{ data: programmes }, { data: stats }] = await Promise.all([
        supabase.from("programmes").select("*")
          .order("starts_at", { ascending: false, nullsFirst: false }),
        supabase.from("programme_stats").select("*"),
      ]);

      const byId = Object.fromEntries((stats ?? []).map((s: any) => [s.id, s]));
      setRows((programmes ?? []).map((p) => ({ ...p, stats: byId[p.id] ?? {} })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">Programmes</p>
          <h1>Registrations</h1>
          <p>Pick a programme to see everyone registered, check people in, or export the list.</p>
        </div>
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
                  <td>
                    <Link to={`/admin/programmes/${p.id}/registrations`}
                          className="a-btn a-btn--ghost">
                      Open →
                    </Link>
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