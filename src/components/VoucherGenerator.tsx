import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function generateRandomCode(len: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function VoucherGenerator() {
  const [count, setCount] = useState<number>(10);
  const [length, setLength] = useState<number>(8);
  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function createVouchers() {
    if (count <= 0 || length < 4) {
      alert("Enter valid count and length (length >= 4).");
      return;
    }
    setLoading(true);

    // generate codes and ensure uniqueness in this batch
    const codes = new Set<string>();
    while (codes.size < count) codes.add(generateRandomCode(length));
    const rows = Array.from(codes).map((code) => ({
      code,
      used: false,
      used_by: null,
    }));

    const { error } = await supabase.from("vouchers").insert(rows);
    if (error) {
      console.error("Insert vouchers error:", error);
      alert("Error saving vouchers. See console.");
      setLoading(false);
      return;
    }

    setGenerated(Array.from(codes));
    setLoading(false);
    alert("Vouchers generated!");
  }

  function copyAll() {
    if (generated.length === 0) return;
    navigator.clipboard.writeText(generated.join("\n"));
    alert("Copied to clipboard");
  }

  function downloadCSV() {
    if (!generated.length) return;
    const csv = generated.map((c) => `${c}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vouchers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 760, margin: "30px auto", padding: 20 }}>
      <h2>Voucher Generator (Admin)</h2>

      <label>Number to generate</label>
      <input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: "100%", padding: 8, marginBottom: 8 }} />

      <label>Length of voucher</label>
      <input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} style={{ width: "100%", padding: 8, marginBottom: 8 }} />

      <button onClick={createVouchers} disabled={loading} style={{ padding: 12, width: "100%" }}>
        {loading ? "Generating..." : "Generate Vouchers"}
      </button>

      {generated.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Generated ({generated.length})</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={copyAll}>Copy</button>
            <button onClick={downloadCSV}>Download CSV</button>
          </div>
          <div style={{ background: "#fafafa", padding: 12, borderRadius: 8, maxHeight: 300, overflowY: "auto" }}>
            {generated.map((c, i) => <div key={i} style={{ padding: 6, borderBottom: "1px solid #eee" }}>{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
