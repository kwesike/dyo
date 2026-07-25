import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import * as XLSX from "xlsx";

export default function AdminRegistrations() {
  const { id } = useParams<{ id: string }>();
  const [programme, setProgramme] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "checked_in">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: prog }, { data: regs }] = await Promise.all([
      supabase.from("programmes").select("*").eq("id", id).maybeSingle(),
      supabase.from("programme_registrations")
        .select("*").eq("programme_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setProgramme(prog);
    setRows(regs ?? []);
    setLoading(false);
  }

  async function markPaid(r: any) {
    setBusyId(r.id);
    await supabase.from("programme_registrations")
      .update({ payment_status: "paid" }).eq("id", r.id);
    setBusyId(null);
    void load();
  }

  async function toggleCheckIn(r: any) {
    setBusyId(r.id);
    await supabase.from("programme_registrations")
      .update({ checked_in: !r.checked_in,
                checked_in_at: r.checked_in ? null : new Date().toISOString() })
      .eq("id", r.id);
    setBusyId(null);
    void load();
  }

  /** Remove one person's registration. Hard delete — it's a single row. */
  async function remove(r: any) {
    if (!confirm(`Remove ${r.full_name}'s registration? This cannot be undone.`)) return;
    setBusyId(r.id);
    const { error } = await supabase
      .from("programme_registrations").delete().eq("id", r.id);
    setBusyId(null);
    if (error) { alert("Couldn't remove that registration."); return; }
    void load();
  }

  const q = search.toLowerCase();
  const shown = rows.filter((r) => {
    const matchesSearch = !q ||
      r.full_name?.toLowerCase().includes(q) ||
      r.church?.toLowerCase().includes(q) ||
      r.archdeaconry?.toLowerCase().includes(q) ||
      r.phone?.includes(q);
    const matchesFilter =
      filter === "all" ? true :
      filter === "checked_in" ? r.checked_in :
      r.payment_status === filter;
    return matchesSearch && matchesFilter;
  });

  function exportSheet() {
    const data = shown.map((r) => ({
      Name: r.full_name, Gender: r.gender, Phone: r.phone, Email: r.email,
      Church: r.church, Archdeaconry: r.archdeaconry, Photo: r.photo_url ?? "",
      Payment: r.payment_status, "Checked in": r.checked_in ? "Yes" : "No",
      ...(r.answers ?? {}),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Registrations");
    XLSX.writeFile(wb, `${programme?.slug ?? "programme"}_registrations.xlsx`);
  }

  if (loading) return <div className="p-6">Loading…</div>;

  const paid = rows.filter((r) => r.payment_status === "paid").length;
  const checkedIn = rows.filter((r) => r.checked_in).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/admin/registrations" className="text-sm underline">← All programmes</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{programme?.title}</h1>
      <p className="text-gray-600 mb-5">
        {rows.length} registered · {paid} paid · {checkedIn} checked in
        {programme?.fee_naira > 0 && ` · ${naira(paid * programme.fee_naira)} collected`}
      </p>

      <div className="flex flex-wrap gap-3 mb-4 justify-between">
        <input className="border rounded px-3 py-2 flex-1 min-w-[220px]"
               placeholder="Search name, church, archdeaconry, phone…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-3 py-2" value={filter}
                onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">Everyone</option>
          <option value="paid">Paid</option>
          <option value="pending">Payment due</option>
          <option value="checked_in">Checked in</option>
        </select>
        <button onClick={exportSheet} className="bg-green-700 text-white px-4 py-2 rounded">
          Export to Excel
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-3 py-2">Photo</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Church</th>
              <th className="px-3 py-2">Archdeaconry</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Check-in</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  {r.photo_url
                    ? <img src={r.photo_url} alt=""
                           className="w-10 h-10 rounded-full object-cover" />
                    : <div className="w-10 h-10 rounded-full bg-gray-200 grid place-items-center text-xs text-gray-500">
                        {r.full_name?.[0]?.toUpperCase() ?? "?"}
                      </div>}
                </td>
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{r.church}</td>
                <td className="px-3 py-2">{r.archdeaconry}</td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">
                  {r.payment_status === "paid" ? (
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">Paid</span>
                  ) : r.payment_status === "not_required" ? (
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Free</span>
                  ) : (
                    <button onClick={() => markPaid(r)} disabled={busyId === r.id}
                            className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs underline">
                      Mark paid
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleCheckIn(r)} disabled={busyId === r.id}
                          className={`px-2 py-0.5 rounded text-xs ${
                            r.checked_in ? "bg-green-600 text-white" : "bg-gray-200"}`}>
                    {r.checked_in ? "Checked in" : "Check in"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(r)} disabled={busyId === r.id}
                          className="text-red-600 text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}