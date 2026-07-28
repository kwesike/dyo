import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Audit trail — who did what.
 *
 * Reads public.audit_log, which RLS only exposes to super admins and admins
 * granted the "audit" section. Actions are written by database triggers and
 * the log_action() RPC, so this screen is read-only: it can't be used to
 * fabricate or erase history.
 */

interface Entry {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string | null;
  details: any;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  access_changed: "Access changed",
  order_deleted: "Order deleted",
  order_cancelled: "Order cancelled",
  programme_deleted: "Programme deleted",
  product_deleted: "Product deleted",
  registration_deleted: "Registration removed",
  card_deleted: "Attending card deleted",
  payment_settled: "Payment settled manually",
};

const ACTION_COLOUR: Record<string, string> = {
  access_changed: "bg-purple-100 text-purple-800",
  order_deleted: "bg-red-100 text-red-800",
  programme_deleted: "bg-red-100 text-red-800",
  product_deleted: "bg-red-100 text-red-800",
  registration_deleted: "bg-amber-100 text-amber-800",
  card_deleted: "bg-amber-100 text-amber-800",
};

export default function AdminAudit() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    // RLS returns an empty set (not an error) to the unauthorised, but a
    // policy error can also land here — treat either as "not for you".
    if (error) setDenied(true);
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }

  const q = search.toLowerCase();
  const shown = entries.filter((e) =>
    !q ||
    e.actor_email?.toLowerCase().includes(q) ||
    e.summary?.toLowerCase().includes(q) ||
    e.action?.toLowerCase().includes(q));

  if (loading) return <div className="p-6">Loading…</div>;

  if (denied) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Audit trail</h1>
        <p className="text-gray-600">You don't have access to the audit trail.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Audit trail</h1>
      <p className="text-gray-600 mb-5">
        A record of significant actions — role changes, deletions, manual payment
        settlements. Read-only, and it can't be edited from here.
      </p>

      <input className="border rounded px-3 py-2 w-full mb-5"
             placeholder="Search by person, action or description…"
             value={search} onChange={(e) => setSearch(e.target.value)} />

      {shown.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">Nothing recorded yet.</p>
      ) : (
        <div className="border rounded divide-y">
          {shown.map((e) => (
            <div key={e.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${ACTION_COLOUR[e.action] ?? "bg-gray-100 text-gray-700"}`}>
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                <span className="flex-1 min-w-[200px] text-sm">{e.summary ?? "—"}</span>
                <span className="text-xs text-gray-500">
                  {e.actor_email ?? "system"} · {new Date(e.created_at).toLocaleString("en-NG")}
                </span>
                {e.details && (
                  <button onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          className="text-xs underline">
                    {expanded === e.id ? "hide" : "details"}
                  </button>
                )}
              </div>
              {expanded === e.id && e.details && (
                <pre className="mt-2 bg-gray-50 rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}