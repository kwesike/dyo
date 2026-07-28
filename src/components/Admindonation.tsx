import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import * as XLSX from "xlsx";

/**
 * Donations — who gave, how much, and whether it settled.
 *
 * Reads the donations table. Paid donations are those the payment verifier or
 * webhook confirmed. Pending ones are started-but-not-confirmed (a closed tab
 * mid-payment); they settle on their own when the webhook lands, so they're
 * shown but greyed.
 */
export default function AdminDonations() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("paid");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

  const settled = (r: any) => r.status === "paid" || r.status === "successful";

  const q = search.toLowerCase();
  const shown = rows.filter((r) => {
    const matchesSearch = !q ||
      r.full_name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.message?.toLowerCase().includes(q);
    const matchesFilter =
      filter === "all" ? true :
      filter === "paid" ? settled(r) :
      !settled(r);
    return matchesSearch && matchesFilter;
  });

  const paidRows = rows.filter(settled);
  const totalRaised = paidRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const thisMonth = paidRows
    .filter((r) => new Date(r.created_at).getMonth() === new Date().getMonth()
                && new Date(r.created_at).getFullYear() === new Date().getFullYear())
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  function exportSheet() {
    const data = shown.map((r) => ({
      Name: r.full_name || "Anonymous",
      Email: r.email || "",
      Amount: Number(r.amount ?? 0),
      Status: settled(r) ? "Paid" : "Pending",
      Message: r.message || "",
      Date: new Date(r.created_at).toLocaleString("en-NG"),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Donations");
    XLSX.writeFile(wb, `donations_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Donations</h1>
      <p className="text-gray-600 mb-5">Gifts given through the site.</p>

      {/* totals */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total raised</p>
          <p className="text-2xl font-bold text-[#800000]">{naira(totalRaised)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This month</p>
          <p className="text-2xl font-bold">{naira(thisMonth)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Gifts</p>
          <p className="text-2xl font-bold">{paidRows.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 justify-between">
        <input className="border rounded px-3 py-2 flex-1 min-w-[220px]"
               placeholder="Search by name, email or message…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-3 py-2" value={filter}
                onChange={(e) => setFilter(e.target.value as any)}>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="all">All</option>
        </select>
        <button onClick={exportSheet} className="bg-green-700 text-white px-4 py-2 rounded">
          Export to Excel
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">No donations here yet.</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((r) => (
            <div key={r.id} className="border rounded p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">
                  {r.full_name || "Anonymous"}
                  {!settled(r) && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </p>
                {r.email && <p className="text-sm text-gray-500">{r.email}</p>}
                {r.message && <p className="text-sm text-gray-600 italic mt-1">"{r.message}"</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(r.created_at).toLocaleString("en-NG")}
                </p>
              </div>
              <p className={`text-lg font-bold ${settled(r) ? "text-[#800000]" : "text-gray-400"}`}>
                {naira(Number(r.amount ?? 0))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}