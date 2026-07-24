import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";

const STATUS_TABS = ["paid", "pending", "failed", "all"] as const;

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("paid");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  const shown = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .filter((o) => tab === "all" || o.status === tab)
      .filter((o) =>
        !q ||
        o.full_name?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) ||
        o.phone?.includes(q));
  }, [orders, tab, search]);

  const revenue = shown
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.total_naira, 0);

  async function setFulfilment(id: string, fulfilment: string) {
    await supabase.from("orders").update({ fulfilment }).eq("id", id);
    void load();
  }

  /** One row per item — this is what you hand to whoever packs the bags. */
  function exportPackingList() {
    const rows = shown.flatMap((o) =>
      (o.order_items ?? []).map((i: any) => ({
        Order: o.order_number,
        Name: o.full_name,
        Phone: o.phone,
        Item: i.name_snapshot,
        Size: i.variant_snapshot ?? "",
        Qty: i.quantity,
        Collection: o.delivery_method === "pickup" ? o.delivery_address : "DELIVERY",
        Address: o.delivery_method === "pickup" ? "" : o.delivery_address,
        Archdeaconry: o.archdeaconry ?? "",
        Status: o.status,
        Fulfilment: o.fulfilment,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Packing list");
    XLSX.writeFile(wb, `packing-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /** How many of each size to order from the tailor. */
  const sizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    shown.filter((o) => o.status === "paid").forEach((o) =>
      (o.order_items ?? []).forEach((i: any) => {
        const key = `${i.name_snapshot}${i.variant_snapshot ? ` · ${i.variant_snapshot}` : ""}`;
        totals[key] = (totals[key] ?? 0) + i.quantity;
      }));
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [shown]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-gray-600 text-sm">
            {shown.length} shown · {naira(revenue)} collected
          </p>
        </div>
        <button onClick={exportPackingList} className="bg-green-700 text-white px-4 py-2 rounded">
          Export packing list
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded capitalize ${
                    tab === t ? "bg-[#800000] text-white" : "bg-gray-200"}`}>
            {t}
          </button>
        ))}
      </div>

      <input className="border px-3 py-2 rounded w-full mb-5"
             placeholder="Search by name, order number or phone"
             value={search} onChange={(e) => setSearch(e.target.value)} />

      {sizeTotals.length > 0 && (
        <div className="border rounded p-4 mb-6 bg-amber-50">
          <p className="font-semibold text-sm mb-2">Paid totals by size</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {sizeTotals.map(([label, qty]) => (
              <span key={label} className="bg-white border rounded px-2 py-1">
                {label}: <strong>{qty}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? <p>Loading…</p> : shown.length === 0 ? (
        <p className="text-gray-500">No orders here yet.</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((o) => (
            <div key={o.id} className="border rounded p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {o.order_number} · {o.full_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {o.phone} · {o.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    {o.delivery_method === "pickup"
                      ? `Collecting: ${o.delivery_address}`
                      : `Deliver to: ${o.delivery_address}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{naira(o.total_naira)}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    o.status === "paid" ? "bg-green-100 text-green-800"
                      : o.status === "pending" ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"}`}>
                    {o.status}
                  </span>
                </div>
              </div>

              <ul className="text-sm mt-3 border-t pt-2">
                {(o.order_items ?? []).map((i: any) => (
                  <li key={i.id}>
                    {i.quantity} × {i.name_snapshot}
                    {i.variant_snapshot ? ` (${i.variant_snapshot})` : ""} — {naira(i.unit_price_naira)}
                  </li>
                ))}
              </ul>

              {o.note && <p className="text-sm italic text-gray-600 mt-2">Note: {o.note}</p>}

              {o.status === "paid" && (
                <select className="border rounded px-2 py-1 text-sm mt-3"
                        value={o.fulfilment}
                        onChange={(e) => setFulfilment(o.id, e.target.value)}>
                  <option value="unfulfilled">Not packed yet</option>
                  <option value="ready_for_pickup">Ready for collection</option>
                  <option value="delivered">Delivered</option>
                  <option value="collected">Collected</option>
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}