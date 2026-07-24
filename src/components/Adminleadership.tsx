import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile } from "../lib/Storage";
import { ARCHDEACONRIES } from "../lib/Constants";

interface Leader {
  id: string;
  tier: "clergy" | "exco";
  full_name: string;
  role: string;
  archdeaconry: string | null;
  photo_url: string | null;
  bio: string | null;
  sort_order: number;
  is_active: boolean;
}

const BLANK = {
  tier: "exco" as "clergy" | "exco",
  full_name: "", role: "", archdeaconry: "",
  photo_url: "", bio: "", sort_order: 100,
};

export default function AdminLeadership() {
  const [people, setPeople] = useState<Leader[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("leadership")
      .select("*")
      .order("tier", { ascending: true })
      .order("sort_order", { ascending: true });
    setPeople((data as Leader[]) ?? []);
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicFile("programme-media", file, "leadership");
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(false);
  }

  async function save() {
    if (!form.full_name.trim() || !form.role.trim()) {
      return setMessage("A name and a role are both needed.");
    }
    setBusy(true);
    setMessage("");

    const payload = {
      tier: form.tier,
      full_name: form.full_name.trim(),
      role: form.role.trim(),
      archdeaconry: form.archdeaconry || null,
      photo_url: form.photo_url || null,
      bio: form.bio.trim() || null,
      sort_order: Number(form.sort_order) || 100,
    };

    const { error } = editing
      ? await supabase.from("leadership").update(payload).eq("id", editing)
      : await supabase.from("leadership").insert(payload);

    setBusy(false);
    if (error) return setMessage("Couldn't save that.");

    setMessage(editing ? "Updated." : `${payload.full_name} added.`);
    setForm({ ...BLANK });
    setEditing(null);
    void load();
  }

  function startEdit(p: Leader) {
    setEditing(p.id);
    setForm({
      tier: p.tier, full_name: p.full_name, role: p.role,
      archdeaconry: p.archdeaconry ?? "", photo_url: p.photo_url ?? "",
      bio: p.bio ?? "", sort_order: p.sort_order,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(p: Leader) {
    await supabase.from("leadership").update({ is_active: !p.is_active }).eq("id", p.id);
    void load();
  }

  async function move(p: Leader, direction: -1 | 1) {
    const group = people.filter((x) => x.tier === p.tier);
    const index = group.findIndex((x) => x.id === p.id);
    const swap = group[index + direction];
    if (!swap) return;

    await Promise.all([
      supabase.from("leadership").update({ sort_order: swap.sort_order }).eq("id", p.id),
      supabase.from("leadership").update({ sort_order: p.sort_order }).eq("id", swap.id),
    ]);
    void load();
  }

  async function remove(p: Leader) {
    if (!confirm(`Remove ${p.full_name} from the leadership page?`)) return;
    await supabase.from("leadership").delete().eq("id", p.id);
    void load();
  }

  const clergy = people.filter((p) => p.tier === "clergy");
  const excos = people.filter((p) => p.tier === "exco");

  const Row = ({ p }: { p: Leader }) => (
    <div className="border rounded p-3 flex flex-wrap gap-3 items-center">
      {p.photo_url
        ? <img src={p.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
        : <div className="w-12 h-12 rounded-full bg-gray-200 grid place-items-center">
            {p.full_name[0]}
          </div>}

      <div className="flex-1 min-w-[170px]">
        <p className="font-semibold">{p.full_name}</p>
        <p className="text-sm text-gray-600 whitespace-pre-line">{p.role}</p>
        {p.archdeaconry && <p className="text-xs text-gray-500">{p.archdeaconry}</p>}
      </div>

      <div className="flex gap-1">
        <button onClick={() => move(p, -1)} className="border rounded px-2 py-1 text-xs"
                aria-label="Move up">↑</button>
        <button onClick={() => move(p, 1)} className="border rounded px-2 py-1 text-xs"
                aria-label="Move down">↓</button>
      </div>

      <button onClick={() => toggleActive(p)}
              className={`px-3 py-1 rounded text-xs ${
                p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
        {p.is_active ? "Showing" : "Hidden"}
      </button>
      <button onClick={() => startEdit(p)} className="underline text-sm">Edit</button>
      <button onClick={() => remove(p)} className="text-red-600 text-sm">Remove</button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Leadership</h1>
      <p className="text-gray-600 mb-6">
        Clergy show large at the top of the home page. Executives appear in the
        grid underneath. Change these here — no code edit, no deploy.
      </p>

      <div className="border rounded-lg p-5 mb-10 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">{editing ? "Edit person" : "Add someone"}</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <select className="border rounded px-3 py-2" value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as "clergy" | "exco" })}>
            <option value="clergy">Clergy — featured at the top</option>
            <option value="exco">Executive — in the grid</option>
          </select>
          <input className="border rounded px-3 py-2" type="number"
                 placeholder="Position (lower shows first)"
                 value={form.sort_order}
                 onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />

          <input className="border rounded px-3 py-2" placeholder="Full name, with title"
                 value={form.full_name}
                 onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="border rounded px-3 py-2"
                 placeholder="Role, e.g. President, Financial Secretary"
                 value={form.role}
                 onChange={(e) => setForm({ ...form, role: e.target.value })} />

          <select className="border rounded px-3 py-2" value={form.archdeaconry}
                  onChange={(e) => setForm({ ...form, archdeaconry: e.target.value })}>
            <option value="">Archdeaconry (optional)</option>
            {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
          </select>

          <div>
            <input type="file" accept="image/*"
                   onChange={(e) => upload(e.target.files?.[0])} />
            {uploading && <p className="text-xs mt-1">Uploading…</p>}
          </div>
        </div>

        {form.photo_url && (
          <img src={form.photo_url} alt=""
               className="w-24 h-24 rounded-full object-cover mt-3 border" />
        )}

        <textarea className="border rounded px-3 py-2 w-full mt-3" rows={2}
                  placeholder="Short note (optional) — shown on hover"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })} />

        <p className="text-xs text-gray-500 mt-2">
          Portrait photos work best — roughly 3:4, face centred. Square or wide
          photos get cropped from the middle.
        </p>

        {message && <p className="text-sm mt-3">{message}</p>}

        <div className="flex gap-3 mt-4">
          <button onClick={save} disabled={busy}
                  className="bg-[#800000] text-white px-5 py-2 rounded">
            {busy ? "Saving…" : editing ? "Save changes" : "Add to the page"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ ...BLANK }); }}
                    className="px-5 py-2 rounded border">Cancel</button>
          )}
        </div>
      </div>

      <h2 className="font-semibold mb-3">Clergy ({clergy.length})</h2>
      <div className="grid gap-2 mb-8">
        {clergy.map((p) => <Row key={p.id} p={p} />)}
      </div>

      <h2 className="font-semibold mb-3">Executives ({excos.length})</h2>
      {excos.length === 0 ? (
        <p className="text-gray-500">Nobody added yet.</p>
      ) : (
        <div className="grid gap-2">
          {excos.map((p) => <Row key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}