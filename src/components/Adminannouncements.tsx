import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { uploadPublicFile } from "./../lib/Storage";

/**
 * Replaces the hard-coded popup image in HomePage.tsx. The office can put up a
 * flyer or take one down without anyone touching the code or redeploying.
 */
export default function AdminAnnouncements() {
  const [items, setItems] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [form, setForm] = useState({
    kind: "update", title: "", body: "", image_url: "",
    link_url: "", programme_id: "", ends_at: "", is_published: true,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("programmes").select("id, title"),
    ]);
    setItems(a ?? []);
    setProgrammes(p ?? []);
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setForm((f) => ({ ...f, image_url: "" }));
      const url = await uploadPublicFile("programme-media", file, "announcements");
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setBusy(false);
  }

  async function publish() {
    if (!form.title.trim()) return setMessage("Give it a title.");
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      kind: form.kind,
      title: form.title.trim(),
      body: form.body.trim() || null,
      image_url: form.image_url || null,
      link_url: form.link_url.trim() || null,
      programme_id: form.programme_id || null,
      ends_at: form.ends_at || null,
      is_published: form.is_published,
    });
    setBusy(false);
    if (error) return setMessage("Couldn't publish that.");
    setMessage("Published.");
    setForm({ kind: "update", title: "", body: "", image_url: "",
              link_url: "", programme_id: "", ends_at: "", is_published: true });
    void load();
  }

  async function toggle(item: any) {
    await supabase.from("announcements")
      .update({ is_published: !item.is_published }).eq("id", item.id);
    void load();
  }

  async function destroy(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    void load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Flyers and updates</h1>
      <p className="text-gray-600 mb-6">
        Anything you publish here shows on the site immediately. Set an end date
        and it takes itself down.
      </p>

      <div className="border rounded-lg p-5 mb-10 bg-white shadow-sm">
        <div className="grid md:grid-cols-2 gap-3">
          <select className="border rounded px-3 py-2" value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="update">Update — appears in the news feed</option>
            <option value="flyer">Flyer — appears in the flyer wall</option>
            <option value="popup">Popup — greets people on the home page</option>
          </select>
          <select className="border rounded px-3 py-2" value={form.programme_id}
                  onChange={(e) => setForm({ ...form, programme_id: e.target.value })}>
            <option value="">Not about a specific programme</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <input className="border rounded px-3 py-2 w-full mt-3" placeholder="Title"
               value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="border rounded px-3 py-2 w-full mt-3" rows={3}
                  placeholder="What do people need to know?"
                  value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <input className="border rounded px-3 py-2 w-full mt-3"
               placeholder="Where should tapping it go? e.g. /programmes/family-weekend"
               value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />

        <div className="mt-4">
          <p className="text-sm font-medium mb-1">Image</p>
          <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
          {form.image_url && (
            <img src={form.image_url} alt="" className="mt-2 max-h-48 rounded border" />
          )}
        </div>

        <label className="block text-sm mt-4">
          Take it down automatically on
          <input className="border rounded px-3 py-2 w-full mt-1" type="datetime-local"
                 value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </label>

        {message && <p className="text-sm mt-3">{message}</p>}

        <button onClick={publish} disabled={busy}
                className="bg-[#800000] text-white px-5 py-2 rounded mt-4">
          {busy ? "Working…" : "Publish"}
        </button>
      </div>

      <div className="grid gap-3">
        {items.map((a) => (
          <div key={a.id} className="border rounded p-4 flex gap-4 items-center">
            {a.image_url && <img src={a.image_url} alt="" className="w-16 h-16 object-cover rounded" />}
            <div className="flex-1">
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-gray-500 capitalize">
                {a.kind}
                {a.ends_at && ` · ends ${new Date(a.ends_at).toLocaleDateString("en-NG")}`}
              </p>
            </div>
            <button onClick={() => toggle(a)}
                    className={`px-3 py-1 rounded text-sm ${
                      a.is_published ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
              {a.is_published ? "Live" : "Hidden"}
            </button>
            <button onClick={() => destroy(a.id)} className="text-red-600 text-sm">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}