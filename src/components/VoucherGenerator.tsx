import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Voucher generator.
 *
 * A voucher is a prepaid registration for a programme. Admins mint them here;
 * sponsors and body-payments mint them automatically elsewhere — all land in
 * the same vouchers table. Each carries an identity so the receipt can say who
 * the gift came from: anonymous, a named person, or a church body.
 */

function randomCode(len: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

type Identity = "anonymous" | "person" | "body";
type BodyType = "archdeaconry" | "parish" | "church";

export default function VoucherGenerator() {
  const [programmes, setProgrammes] = useState<{ id: string; title: string }[]>([]);
  const [programmeId, setProgrammeId] = useState("");

  const [count, setCount] = useState(10);
  const [length, setLength] = useState(8);

  const [identity, setIdentity] = useState<Identity>("anonymous");
  const [personName, setPersonName] = useState("");
  const [bodyType, setBodyType] = useState<BodyType>("church");
  const [bodyName, setBodyName] = useState("");
  const [community, setCommunity] = useState("");

  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("programmes")
        .select("id, title").order("starts_at", { ascending: false });
      setProgrammes(data ?? []);
      if (data?.[0]) setProgrammeId(data[0].id);
    })();
  }, []);

  async function createVouchers() {
    setMessage("");
    if (!programmeId) return setMessage("Choose which programme these vouchers are for.");
    if (count <= 0 || length < 4) return setMessage("Enter a valid count and a length of at least 4.");
    if (identity === "person" && !personName.trim()) return setMessage("Enter the person's name.");
    if (identity === "body" && !bodyName.trim()) return setMessage("Enter the body's name.");

    setLoading(true);

    const codes = new Set<string>();
    while (codes.size < count) codes.add(randomCode(length));

    const identityName =
      identity === "person" ? personName.trim() :
      identity === "body" ? bodyName.trim() : null;

    const rows = Array.from(codes).map((code) => ({
      code,
      used: false,
      used_by: null,
      programme_id: programmeId,
      identity_type: identity,
      identity_name: identityName,
      body_type: identity === "body" ? bodyType : null,
      church_community: identity === "body" && bodyType === "church" ? community.trim() || null : null,
      source: "admin",
    }));

    const { error } = await supabase.from("vouchers").insert(rows);
    setLoading(false);

    if (error) {
      setMessage(`Couldn't save the vouchers: ${error.message}`);
      return;
    }

    setGenerated(Array.from(codes));
    setMessage(`${count} voucher${count === 1 ? "" : "s"} generated.`);
  }

  function copyAll() {
    if (!generated.length) return;
    navigator.clipboard.writeText(generated.join("\n"));
    setMessage("Copied to clipboard.");
  }

  function downloadCSV() {
    if (!generated.length) return;
    const prog = programmes.find((p) => p.id === programmeId)?.title ?? "programme";
    const blob = new Blob([generated.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vouchers-${prog.replace(/[^a-z0-9]+/gi, "-")}.csv`;
    a.click();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Voucher generator</h1>
      <p className="text-gray-600 mb-6">
        Mint prepaid registration codes for a programme. Whoever holds a code can
        register free — the receipt shows who the gift came from.
      </p>

      <div className="border rounded-lg p-5 bg-white shadow-sm">
        <label className="block text-sm font-medium mb-1">Programme</label>
        <select className="border rounded px-3 py-2 w-full mb-4"
                value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">How many</label>
            <input type="number" min={1} className="border rounded px-3 py-2 w-full"
                   value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Code length</label>
            <input type="number" min={4} className="border rounded px-3 py-2 w-full"
                   value={length} onChange={(e) => setLength(Number(e.target.value))} />
          </div>
        </div>

        {/* Who the gift is from */}
        <label className="block text-sm font-medium mb-2">Who is sponsoring?</label>
        <div className="flex gap-2 mb-3 flex-wrap">
          {([
            ["anonymous", "Anonymous"],
            ["person", "A person"],
            ["body", "Archdeaconry / parish / church"],
          ] as const).map(([val, label]) => (
            <button key={val} type="button"
                    onClick={() => setIdentity(val)}
                    className={`px-3 py-2 rounded text-sm border ${
                      identity === val ? "bg-[#800000] text-white border-[#800000]" : "bg-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {identity === "person" && (
          <input className="border rounded px-3 py-2 w-full mb-4"
                 placeholder="Full name of the sponsor"
                 value={personName} onChange={(e) => setPersonName(e.target.value)} />
        )}

        {identity === "body" && (
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              {(["archdeaconry", "parish", "church"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBodyType(b)}
                        className={`px-3 py-1.5 rounded text-sm border capitalize ${
                          bodyType === b ? "bg-[#800000] text-white border-[#800000]" : "bg-white"}`}>
                  {b}
                </button>
              ))}
            </div>
            <input className="border rounded px-3 py-2 w-full"
                   placeholder={
                     bodyType === "church"
                       ? "Full church name — e.g. Bishop Akinyele Memorial Anglican Church"
                       : `Full ${bodyType} name (no abbreviations)`}
                   value={bodyName} onChange={(e) => setBodyName(e.target.value)} />
            {bodyType === "church" && (
              <input className="border rounded px-3 py-2 w-full"
                     placeholder="Community / location — e.g. Akinyele"
                     value={community} onChange={(e) => setCommunity(e.target.value)} />
            )}
          </div>
        )}

        {message && <p className="text-sm mb-3">{message}</p>}

        <button onClick={createVouchers} disabled={loading}
                className="bg-[#800000] text-white px-5 py-2 rounded w-full">
          {loading ? "Generating…" : "Generate vouchers"}
        </button>
      </div>

      {generated.length > 0 && (
        <div className="mt-6 border rounded-lg p-5 bg-white shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Generated ({generated.length})</h3>
            <div className="flex gap-2">
              <button onClick={copyAll} className="text-sm underline">Copy</button>
              <button onClick={downloadCSV} className="text-sm underline">Download CSV</button>
            </div>
          </div>
          <div className="bg-gray-50 rounded max-h-72 overflow-y-auto font-mono text-sm">
            {generated.map((c, i) => (
              <div key={i} className="px-3 py-1.5 border-b last:border-0">{c}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}