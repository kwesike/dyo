import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import { useAuth } from "./Authcontext";
import * as XLSX from "xlsx";

/**
 * Receipts — every settled payment on the site, in one place.
 *
 * The payments table is the single record of money received: each row is one
 * transaction, tagged by purpose (order / registration / donation), with the
 * Flutterwave id and the reference back to what was bought. This page lists
 * them all and links through to each transaction's own receipt page.
 */

const PURPOSE_LABEL: Record<string, string> = {
  order: "Store order",
  registration: "Programme",
  donation: "Donation",
  sponsorship: "Sponsorship",
  body_payment: "Church/parish payment",
  item_sponsorship: "Item sponsorship",
};

const PURPOSE_COLOUR: Record<string, string> = {
  order: "bg-blue-100 text-blue-800",
  registration: "bg-purple-100 text-purple-800",
  donation: "bg-green-100 text-green-800",
  sponsorship: "bg-amber-100 text-amber-800",
  body_payment: "bg-indigo-100 text-indigo-800",
  item_sponsorship: "bg-pink-100 text-pink-800",
};

// Where each kind of receipt lives on the public site.
function receiptLink(purpose: string, referenceId: string): string | null {
  if (purpose === "order") return `/orders/${referenceId}`;
  if (purpose === "donation") return `/success-donation/${referenceId}`;
  if (purpose === "sponsorship") return `/sponsorship/${referenceId}`;
  if (purpose === "body_payment") return `/body-receipt/${referenceId}`;
  if (purpose === "item_sponsorship") return `/item-sponsorship/${referenceId}`;
  return null; // registrations don't have a standalone receipt page
}

export default function AdminReceipts() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState<"all" | "order" | "registration" | "donation">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    // Only settled payments are receipts.
    const { data } = await supabase
      .from("payments")
      .select("*")
      .in("status", ["successful", "paid"])
      .order("verified_at", { ascending: false, nullsFirst: false });
    setRows(data ?? []);
    setLoading(false);
  }

  /**
   * Hard delete a receipt.
   *
   * This removes the payment record — the proof that this money was received.
   * It does NOT touch the underlying order/registration/donation, only the
   * payments-table row. Kept behind a firm confirm because deleting financial
   * records is rarely reversible and matters for reconciliation.
   */
  async function remove(r: any) {
    if (!isSuperAdmin) return;  // deleting receipts is super-admin only
    if (!confirm(
      `Delete this ${PURPOSE_LABEL[r.purpose] ?? r.purpose} receipt for ${naira(Number(r.amount_naira ?? 0))}?\n\n` +
      `This erases the record that this payment was received. It cannot be undone.`
    )) return;

    setDeletingId(r.id);
    // Ask for the deleted rows back — if RLS blocks it, this returns empty
    // with no error, which is exactly the "it loads but stays" symptom.
    const { data, error } = await supabase
      .from("payments").delete().eq("id", r.id).select();
    setDeletingId(null);

    if (error) {
      alert(`Couldn't delete: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      alert("The receipt wasn't deleted — the database blocked it. A policy is preventing deletion of payment records.");
      return;
    }
    void load();
  }

  const q = search.toLowerCase();
  const shown = rows.filter((r) => {
    const matchesSearch = !q ||
      r.payer_email?.toLowerCase().includes(q) ||
      r.tx_ref?.toLowerCase().includes(q) ||
      r.flw_transaction_id?.toLowerCase().includes(q);
    const matchesPurpose = purpose === "all" || r.purpose === purpose;
    return matchesSearch && matchesPurpose;
  });

  const total = shown.reduce((s, r) => s + Number(r.amount_naira ?? 0), 0);
  const byPurpose = (p: string) =>
    rows.filter((r) => r.purpose === p).reduce((s, r) => s + Number(r.amount_naira ?? 0), 0);

  function exportSheet() {
    const data = shown.map((r) => ({
      Date: r.verified_at ? new Date(r.verified_at).toLocaleString("en-NG") : "",
      Type: PURPOSE_LABEL[r.purpose] ?? r.purpose,
      Amount: Number(r.amount_naira ?? 0),
      Email: r.payer_email || "",
      Reference: r.tx_ref,
      "Flutterwave ID": r.flw_transaction_id || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Receipts");
    XLSX.writeFile(wb, `receipts_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Receipts</h1>
      <p className="text-gray-600 mb-5">
        Every settled payment on the site — store orders, programme fees and donations.
      </p>

      {/* totals by type */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">All receipts</p>
          <p className="text-2xl font-bold text-[#800000]">{naira(total)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Store</p>
          <p className="text-xl font-bold">{naira(byPurpose("order"))}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Programmes</p>
          <p className="text-xl font-bold">{naira(byPurpose("registration"))}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Donations</p>
          <p className="text-xl font-bold">{naira(byPurpose("donation"))}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 justify-between">
        <input className="border rounded px-3 py-2 flex-1 min-w-[220px]"
               placeholder="Search by email, reference or Flutterwave ID…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-3 py-2" value={purpose}
                onChange={(e) => setPurpose(e.target.value as any)}>
          <option value="all">All types</option>
          <option value="order">Store orders</option>
          <option value="registration">Programmes</option>
          <option value="donation">Donations</option>
        </select>
        <button onClick={exportSheet} className="bg-green-700 text-white px-4 py-2 rounded">
          Export to Excel
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">No receipts yet.</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const link = receiptLink(r.purpose, r.reference_id);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.verified_at ? new Date(r.verified_at).toLocaleDateString("en-NG") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${PURPOSE_COLOUR[r.purpose] ?? "bg-gray-100"}`}>
                        {PURPOSE_LABEL[r.purpose] ?? r.purpose}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">{naira(Number(r.amount_naira ?? 0))}</td>
                    <td className="px-3 py-2">{r.payer_email || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.tx_ref}</td>
                    <td className="px-3 py-2">
                      {link
                        ? <a href={link} target="_blank" rel="noreferrer"
                             className="text-[#800000] underline text-xs">View receipt</a>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSuperAdmin && <button onClick={() => remove(r)} disabled={deletingId === r.id}
                              className="text-red-600 text-xs">
                        {deletingId === r.id ? "…" : "Delete"}
                      </button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}