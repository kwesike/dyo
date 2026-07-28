import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import * as XLSX from "xlsx";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "unfulfilled">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  async function markFulfilled(o: any) {
    setBusyId(o.id);
    await supabase.from("orders")
      .update({ fulfilment: o.fulfilment === "fulfilled" ? "unfulfilled" : "fulfilled" })
      .eq("id", o.id);
    setBusyId(null);
    void load();
  }

  /**
   * Deleting orders needs care — money is involved.
   *
   * A PAID order is financial history: its payment row still shows successful,
   * so erasing the order breaks reconciliation. So paid orders can't be
   * deleted here — they can be cancelled instead (kept, but marked). Only
   * pending/failed orders (abandoned carts) can be removed outright.
   */
  async function cancelOrder(o: any) {
    if (!confirm(`Cancel order ${o.order_number}? It stays on record but is marked cancelled.`)) return;
    setBusyId(o.id);
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    setBusyId(null);
    void load();
  }

  async function removeOrder(o: any) {
    if (o.status === "paid") {
      alert("This order is paid, so it's part of your records and can't be deleted. Use Cancel instead.");
      return;
    }
    if (!confirm(`Delete order ${o.order_number}? This was never paid. This cannot be undone.`)) return;

    setBusyId(o.id);
    await supabase.from("order_items").delete().eq("order_id", o.id);
    const { error } = await supabase.from("orders").delete().eq("id", o.id);
    setBusyId(null);

    if (error) { alert("Couldn't delete that order."); return; }
    void load();
  }

  const q = search.toLowerCase();
  const shown = orders.filter((o) => {
    const matchesSearch = !q ||
      o.order_number?.toLowerCase().includes(q) ||
      o.full_name?.toLowerCase().includes(q) ||
      o.phone?.includes(q);
    const matchesFilter =
      filter === "all" ? true :
      filter === "unfulfilled" ? (o.status === "paid" && o.fulfilment !== "fulfilled") :
      o.status === filter;
    return matchesSearch && matchesFilter;
  });

  /* Packing list — a size breakdown across the shown orders, so whoever's
     bagging items knows how many of each to pull. */
  function exportPackingList() {
    const lines: any[] = [];
    const sizeTotals: Record<string, number> = {};

    shown.forEach((o) => {
      (o.order_items ?? []).forEach((i: any) => {
        lines.push({
          Order: o.order_number, Name: o.full_name, Phone: o.phone,
          Item: i.name_snapshot, Size: i.variant_snapshot ?? "—",
          Qty: i.quantity, Delivery: o.delivery_method,
          Address: o.delivery_address, Status: o.status,
        });
        const key = `${i.name_snapshot} ${i.variant_snapshot ?? ""}`.trim();
        sizeTotals[key] = (sizeTotals[key] ?? 0) + i.quantity;
      });
    });

    const totals = Object.entries(sizeTotals).map(([Item, Qty]) => ({ Item, Qty }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines), "Orders");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totals), "Totals to pull");
    XLSX.writeFile(wb, "orders_packing_list.xlsx");
  }

  if (loading) return <div className="p-6">Loading…</div>;

  const paid = orders.filter((o) => o.status === "paid");
  const toPack = paid.filter((o) => o.fulfilment !== "fulfilled").length;
  const revenue = paid.reduce((s, o) => s + (o.total_naira ?? 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Orders</h1>
      <p className="text-gray-600 mb-5">
        {paid.length} paid · {toPack} to pack · {naira(revenue)} collected
      </p>

      <div className="flex flex-wrap gap-3 mb-4 justify-between">
        <input className="border rounded px-3 py-2 flex-1 min-w-[220px]"
               placeholder="Search order number, name, phone…"
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-3 py-2" value={filter}
                onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All orders</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="unfulfilled">To pack</option>
        </select>
        <button onClick={exportPackingList} className="bg-green-700 text-white px-4 py-2 rounded">
          Packing list
        </button>
      </div>

      <div className="grid gap-3">
        {shown.map((o) => (
          <div key={o.id} className="border rounded p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">
                  {o.order_number}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    o.status === "paid" ? "bg-green-100 text-green-800"
                      : o.status === "cancelled" ? "bg-gray-200 text-gray-600"
                      : "bg-yellow-100 text-yellow-800"}`}>
                    {o.status}
                  </span>
                </p>
                <p className="text-sm text-gray-500">
                  {o.full_name} · {o.phone} · {new Date(o.created_at).toLocaleDateString("en-NG")}
                </p>
                <p className="text-sm text-gray-500">
                  {o.delivery_method === "pickup" ? `Collect: ${o.delivery_address}` : `Deliver: ${o.delivery_address}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{naira(o.total_naira)}</p>
                <p className="text-xs text-gray-500">{(o.order_items ?? []).length} item(s)</p>
              </div>
            </div>

            <ul className="text-sm text-gray-600 mt-2 border-t pt-2">
              {(o.order_items ?? []).map((i: any) => (
                <li key={i.id}>
                  {i.quantity} × {i.name_snapshot}{i.variant_snapshot ? ` (${i.variant_snapshot})` : ""}
                </li>
              ))}
            </ul>

            <div className="flex gap-3 mt-3 flex-wrap">
              {o.status === "paid" && (
                <button onClick={() => markFulfilled(o)} disabled={busyId === o.id}
                        className={`px-3 py-1 rounded text-sm ${
                          o.fulfilment === "fulfilled" ? "bg-green-600 text-white" : "bg-gray-200"}`}>
                  {o.fulfilment === "fulfilled" ? "Packed ✓" : "Mark packed"}
                </button>
              )}

              {/* Paid orders are cancelled (kept on record); unpaid can be deleted. */}
              {o.status === "paid" ? (
                o.status !== "cancelled" && (
                  <button onClick={() => cancelOrder(o)} disabled={busyId === o.id}
                          className="text-sm underline text-gray-600">
                    Cancel order
                  </button>
                )
              ) : (
                <button onClick={() => removeOrder(o)} disabled={busyId === o.id}
                        className="text-red-600 text-sm">
                  {busyId === o.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}