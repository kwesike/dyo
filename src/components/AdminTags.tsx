import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Admin Tags.
 *
 * Two things generated from a registrant's photo + details:
 *   • Paid programme tags — the printable tag for verified paid attendees,
 *     built from the programme's tag template. Stored per registration.
 *   • Attendance cards — the "I will be attending" image any registrant makes.
 *
 * Both are read from programme_registrations (not a bucket), so this shows
 * exactly who has generated what, with their name attached.
 */

type Item = { id: string; name: string; url: string };

export default function AdminTags() {
  const [view, setView] = useState<"tags" | "cards">("tags");

  const [programmes, setProgrammes] = useState<{ id: string; title: string; fee_naira: number }[]>([]);
  const [programmeId, setProgrammeId] = useState("");

  const [tags, setTags] = useState<Item[]>([]);
  const [cards, setCards] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { void loadProgrammes(); }, []);

  useEffect(() => {
    if (!programmeId) return;
    if (view === "tags") void loadTags(programmeId);
    else void loadCards(programmeId);
    setSelected(new Set());
  }, [view, programmeId]);

  async function loadProgrammes() {
    const { data } = await supabase
      .from("programmes").select("id, title, fee_naira")
      .order("starts_at", { ascending: false });
    setProgrammes(data ?? []);
    if (data?.[0] && !programmeId) setProgrammeId(data[0].id);
  }

  async function loadTags(pid: string) {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("programme_registrations")
      .select("id, full_name, attending_tag_generated_url, profiles(full_name)")
      .eq("programme_id", pid)
      .not("attending_tag_generated_url", "is", null);
    if (error) setError(error.message);
    setTags((data ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name || r.profiles?.full_name || "Unnamed",
      url: r.attending_tag_generated_url,
    })));
    setLoading(false);
  }

  async function loadCards(pid: string) {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("programme_registrations")
      .select("id, full_name, attending_card_url, profiles(full_name)")
      .eq("programme_id", pid)
      .not("attending_card_url", "is", null);
    if (error) setError(error.message);
    setCards((data ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name || r.profiles?.full_name || "Unnamed",
      url: r.attending_card_url,
    })));
    setLoading(false);
  }

  const items = view === "tags" ? tags : cards;

  /* ---------- selection ---------- */
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* ---------- cross-origin safe download ---------- */
  async function downloadOne(url: string, name: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${name.replace(/[^a-z0-9]+/gi, "_")}_${view === "tags" ? "tag" : "card"}.png`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function downloadMany(list: Item[]) {
    setDownloading(true);
    for (const it of list) {
      try { await downloadOne(it.url, it.name); } catch { /* skip failures */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloading(false);
  }

  /* ---------- print ---------- */
  function print(urls: string[]) {
    if (!urls.length) return;
    const html = `
      <html><head><title>Print</title><style>
        @page { margin: 8mm; }
        body { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
        img { width: 240px; height: auto; page-break-inside: avoid; }
      </style></head><body>
        ${urls.map((u) => `<img src="${u}" />`).join("")}
      </body></html>`;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Wait for images to load before printing, or pages come out blank.
    const imgs = Array.from(doc.images);
    let loaded = 0;
    if (imgs.length === 0) { frame.contentWindow?.print(); return; }
    imgs.forEach((img) => {
      if (img.complete) { if (++loaded === imgs.length) frame.contentWindow?.print(); }
      else img.onload = img.onerror = () => { if (++loaded === imgs.length) frame.contentWindow?.print(); };
    });
    setTimeout(() => document.body.removeChild(frame), 60000);
  }

  /* ---------- delete (member can regenerate) ---------- */
  async function remove(item: Item) {
    const noun = view === "tags" ? "tag" : "attendance card";
    if (!confirm(`Delete ${item.name}'s ${noun}? They can generate a new one from their account.`)) return;
    setBusyId(item.id);

    const field = view === "tags" ? "attending_tag_generated_url" : "attending_card_url";
    const filePrefix = view === "tags" ? "tag-" : "";
    await supabase.storage.from("attending-cards").remove([`${filePrefix}${item.id}.png`]);
    await supabase.from("programme_registrations").update({ [field]: null }).eq("id", item.id);

    setBusyId(null);
    if (view === "tags") void loadTags(programmeId);
    else void loadCards(programmeId);
  }

  const selectedItems = items.filter((i) => selected.has(i.id));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex gap-2 mb-5">
        <button onClick={() => setView("tags")}
                className={`px-4 py-2 rounded text-sm ${view === "tags" ? "bg-[#800000] text-white" : "bg-gray-200"}`}>
          Paid programme tags
        </button>
        <button onClick={() => setView("cards")}
                className={`px-4 py-2 rounded text-sm ${view === "cards" ? "bg-[#800000] text-white" : "bg-gray-200"}`}>
          Attendance cards
        </button>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">
            {view === "tags" ? "Paid programme tags" : "Attendance cards"}
          </h1>
          <p className="text-gray-600 text-sm">
            {view === "tags"
              ? "Printable tags for verified paid attendees."
              : "The \u201CI will be attending\u201D images members generate."}
          </p>
        </div>
        <select className="border px-3 py-2 rounded"
                value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}{p.fee_naira > 0 ? "" : " (free)"}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">
          {view === "tags"
            ? "No tags generated for this programme yet. They appear once verified attendees make their card."
            : "No attendance cards generated for this programme yet."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <button onClick={() => print(items.map((i) => i.url))}
                    className="bg-[#800000] text-white px-4 py-2 rounded">
              Print all ({items.length})
            </button>
            <button onClick={() => downloadMany(items)} disabled={downloading}
                    className="bg-gray-800 text-white px-4 py-2 rounded">
              {downloading ? "Downloading…" : `Download all (${items.length})`}
            </button>
            {selected.size > 0 && (
              <>
                <button onClick={() => print(selectedItems.map((i) => i.url))}
                        className="bg-[#800000] text-white px-4 py-2 rounded">
                  Print selected ({selected.size})
                </button>
                <button onClick={() => downloadMany(selectedItems)} disabled={downloading}
                        className="bg-green-700 text-white px-4 py-2 rounded">
                  Download selected ({selected.size})
                </button>
              </>
            )}
            <button onClick={() => setSelected(
                      selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
                    className="underline text-sm">
              {selected.size === items.length ? "Clear selection" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((it) => (
              <div key={it.id}
                   className={`border rounded p-2 relative ${selected.has(it.id) ? "ring-2 ring-green-600" : ""}`}>
                <label className="absolute top-3 left-3 bg-white/90 rounded px-1 cursor-pointer">
                  <input type="checkbox" checked={selected.has(it.id)}
                         onChange={() => toggleSelect(it.id)} />
                </label>
                <img src={it.url} alt={it.name} className="w-full rounded" />
                <p className="text-sm mt-1 text-center">{it.name}</p>
                <div className="flex justify-center gap-3 mt-1">
                  <button onClick={() => downloadOne(it.url, it.name)}
                          className="text-xs underline">Download</button>
                  <button onClick={() => remove(it)} disabled={busyId === it.id}
                          className="text-xs underline text-red-600">
                    {busyId === it.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}