import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { slugify, uploadPublicFile } from "./../lib/Storage";
import { naira } from "./../lib/Payments";
import { useAuth } from "./Authcontext";

interface ExtraField {
  key: string; label: string; type: "text" | "select" | "textarea";
  options?: string[]; required?: boolean;
}

const BLANK = {
  title: "", tagline: "", description: "", venue: "",
  starts_at: "", ends_at: "", registration_closes_at: "",
  is_free: true, fee_naira: 0, access_code: "", capacity: "", is_published: false,
  banner_url: "", flyer_url: "", attending_template_url: "", attending_tag_url: "",
  extra_fields: [] as ExtraField[],
};

export default function AdminProgrammes() {
  const { profile } = useAuth();
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: progs }, { data: st }] = await Promise.all([
      supabase.from("programmes").select("*").order("starts_at", { ascending: false }),
      supabase.from("programme_stats").select("*"),
    ]);
    setProgrammes(progs ?? []);
    setStats(Object.fromEntries((st ?? []).map((s: any) => [s.id, s])));
  }

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  async function handleUpload(field: "banner_url" | "flyer_url" | "attending_template_url" | "attending_tag_url",
                              file: File | undefined) {
    if (!file) return;
    setUploading(field);
    try {
      const url = await uploadPublicFile("programme-media", file, slugify(form.title || "programme"));
      set(field, url);
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(null);
  }

  function startEdit(p: any) {
    setEditing(p.id);
    setForm({
      title: p.title ?? "", tagline: p.tagline ?? "", description: p.description ?? "",
      venue: p.venue ?? "",
      starts_at: p.starts_at?.slice(0, 16) ?? "",
      ends_at: p.ends_at?.slice(0, 16) ?? "",
      registration_closes_at: p.registration_closes_at?.slice(0, 16) ?? "",
      // A programme is free when its fee is zero — derive the toggle from the data.
      is_free: !(p.fee_naira > 0),
      fee_naira: p.fee_naira ?? 0,
      access_code: p.access_code ?? "",
      capacity: p.capacity ?? "",
      is_published: p.is_published,
      banner_url: p.banner_url ?? "", flyer_url: p.flyer_url ?? "",
      attending_template_url: p.attending_template_url ?? "",
      attending_tag_url: p.attending_tag_url ?? "",
      extra_fields: p.extra_fields ?? [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.title.trim()) return setMessage("Give the programme a title.");
    // If it's paid, insist on an actual amount rather than saving a silent zero.
    if (!form.is_free && (!form.fee_naira || Number(form.fee_naira) <= 0)) {
      return setMessage("Enter the fee, or switch it to Free.");
    }

    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      slug: slugify(form.title),
      tagline: form.tagline.trim() || null,
      description: form.description.trim() || null,
      venue: form.venue.trim() || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      registration_closes_at: form.registration_closes_at || null,
      // Free always writes 0; paid writes the entered amount.
      fee_naira: form.is_free ? 0 : Number(form.fee_naira) || 0,
      access_code: form.is_free ? null : (form.access_code.trim() || null),
      capacity: form.capacity === "" ? null : Number(form.capacity),
      is_published: form.is_published,
      banner_url: form.banner_url || null,
      flyer_url: form.flyer_url || null,
      attending_template_url: form.attending_template_url || null,
      attending_tag_url: form.attending_tag_url || null,
      extra_fields: form.extra_fields,
      created_by: profile?.id,
    };

    const { error } = editing
      ? await supabase.from("programmes").update(payload).eq("id", editing)
      : await supabase.from("programmes").insert(payload);

    setSaving(false);

    if (error) {
      setMessage(error.code === "23505"
        ? "A programme with that title already exists. Change the title slightly."
        : error.message);
      return;
    }

    setMessage(editing ? "Programme updated." : "Programme created.");
    setForm({ ...BLANK });
    setEditing(null);
    void load();
  }

  async function togglePublish(p: any) {
    await supabase.from("programmes")
      .update({ is_published: !p.is_published }).eq("id", p.id);
    void load();
  }

  /**
   * Hard delete, as chosen. A programme with registrations can't be removed
   * while those rows point at it (foreign key), so we clear them first — but
   * only after a confirm that says exactly how many will be lost, since this
   * erases who attended and what they paid.
   */
  async function remove(p: any) {
    const count = stats[p.id]?.total_registered ?? 0;
    const warning = count > 0
      ? `Delete "${p.title}"? This also permanently removes ${count} registration${count === 1 ? "" : "s"} and any payment records for them. This cannot be undone.`
      : `Delete "${p.title}"? This cannot be undone.`;

    if (!confirm(warning)) return;

    setDeletingId(p.id);
    setMessage("");

    // Clear children first, then the programme itself.
    await supabase.from("programme_registrations").delete().eq("programme_id", p.id);
    const { error } = await supabase.from("programmes").delete().eq("id", p.id);

    setDeletingId(null);

    if (error) {
      setMessage("Couldn't delete that — it may still be linked to store items. Unlink those first.");
      return;
    }

    setMessage(`"${p.title}" was deleted.`);
    if (editing === p.id) { setEditing(null); setForm({ ...BLANK }); }
    void load();
  }

  /* ---- custom question builder ---- */
  const addField = () =>
    set("extra_fields", [...form.extra_fields,
      { key: `q${form.extra_fields.length + 1}`, label: "", type: "text", required: false }]);

  const updateField = (i: number, patch: Partial<ExtraField>) =>
    set("extra_fields", form.extra_fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const removeField = (i: number) =>
    set("extra_fields", form.extra_fields.filter((_, idx) => idx !== i));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Programmes</h1>
      <p className="text-gray-600 mb-6">
        Create a programme here and it appears on the site for members to register.
      </p>

      {/* ------------- editor ------------- */}
      <div className="border rounded-lg p-5 mb-10 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">
          {editing ? "Edit programme" : "New programme"}
        </h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Title"
                 value={form.title} onChange={(e) => set("title", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Short tagline"
                 value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Venue"
                 value={form.venue} onChange={(e) => set("venue", e.target.value)} />
          <input className="border rounded px-3 py-2" type="number"
                 placeholder="Capacity (leave blank for unlimited)"
                 value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
        </div>

        {/* ---- fee: free or an amount ---- */}
        <div className="border rounded-lg p-4 mt-3 bg-gray-50">
          <p className="text-sm font-medium mb-2">Does it cost anything to attend?</p>
          <div className="flex gap-2">
            <button type="button"
                    onClick={() => { set("is_free", true); set("fee_naira", 0); }}
                    className={`px-4 py-2 rounded text-sm border ${
                      form.is_free ? "bg-[#800000] text-white border-[#800000]"
                                   : "bg-white text-gray-700"}`}>
              Free to attend
            </button>
            <button type="button"
                    onClick={() => set("is_free", false)}
                    className={`px-4 py-2 rounded text-sm border ${
                      !form.is_free ? "bg-[#800000] text-white border-[#800000]"
                                    : "bg-white text-gray-700"}`}>
              There's a fee
            </button>
          </div>

          {!form.is_free && (
            <div className="mt-3">
              <label className="text-sm text-gray-600 block mb-1">Fee in naira</label>
              <div className="flex items-center gap-2">
                <span className="text-lg text-gray-500">₦</span>
                <input className="border rounded px-3 py-2 w-40" type="number" min={1}
                       placeholder="e.g. 5000" autoFocus
                       value={form.fee_naira || ""}
                       onChange={(e) => set("fee_naira", e.target.value)} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Members pay this through the site when they register.
              </p>

              <label className="text-sm text-gray-600 block mb-1 mt-4">
                Access code for archdeaconry / parish / church payments
              </label>
              <input className="border rounded px-3 py-2 w-full max-w-xs"
                     placeholder="e.g. GLORY2026"
                     value={form.access_code}
                     onChange={(e) => set("access_code", e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">
                You choose this. A church, parish or archdeaconry enters it on the
                payment page to pay for their members in bulk. Share it only with
                the people meant to pay.
              </p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <label className="text-sm text-gray-600">Starts
            <input className="border rounded px-3 py-2 w-full" type="datetime-local"
                   value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
          </label>
          <label className="text-sm text-gray-600">Ends
            <input className="border rounded px-3 py-2 w-full" type="datetime-local"
                   value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
          </label>
          <label className="text-sm text-gray-600">Registration closes
            <input className="border rounded px-3 py-2 w-full" type="datetime-local"
                   value={form.registration_closes_at}
                   onChange={(e) => set("registration_closes_at", e.target.value)} />
          </label>
        </div>

        <textarea className="border rounded px-3 py-2 w-full mt-3" rows={4}
                  placeholder="Describe the programme"
                  value={form.description} onChange={(e) => set("description", e.target.value)} />

        {/* uploads */}
        <div className="grid md:grid-cols-3 gap-4 mt-5">
          {(() => {
            type UF = "banner_url" | "flyer_url" | "attending_template_url" | "attending_tag_url";
            const uploads: [UF, string, string][] = [
              ["banner_url", "Wide banner", "Shows across the top of the programme page."],
              ["flyer_url", "Programme flyer", "The poster people share on WhatsApp."],
              ["attending_template_url", "\u201CI will be attending\u201D card",
               "Square PNG with a transparent window where the face goes. Everyone gets this."],
            ];
            // Paid programmes get a 4th: the printable attendance tag.
            if (!form.is_free) {
              uploads.push(["attending_tag_url", "Attendance tag (paid only)",
                "The printable tag for verified attendees. Same face-window design as the card."]);
            }
            return uploads;
          })().map(([field, label, hint]) => (
            <div key={field} className="border rounded p-3">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-gray-500 mb-2">{hint}</p>
              {form[field] && (
                <img src={form[field]} alt="" className="w-full h-28 object-contain mb-2" />
              )}
              <input type="file" accept="image/*"
                     onChange={(e) => handleUpload(field, e.target.files?.[0])} />
              {uploading === field && <p className="text-xs mt-1">Uploading…</p>}
            </div>
          ))}
        </div>

        {/* custom questions */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <p className="font-medium text-sm">Extra questions</p>
            <button className="text-sm underline" onClick={addField}>Add a question</button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Name, church, archdeaconry and phone come from the member's account
            automatically. Only ask for what's specific to this programme.
          </p>

          {form.extra_fields.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
              <input className="border rounded px-2 py-1 flex-1 min-w-[180px]"
                     placeholder="Question shown to the member"
                     value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
              <select className="border rounded px-2 py-1" value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value as ExtraField["type"] })}>
                <option value="text">Short answer</option>
                <option value="textarea">Long answer</option>
                <option value="select">Choose one</option>
              </select>
              {f.type === "select" && (
                <input className="border rounded px-2 py-1 flex-1"
                       placeholder="Options, separated by commas"
                       value={f.options?.join(", ") ?? ""}
                       onChange={(e) => updateField(i, {
                         options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                       })} />
              )}
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={!!f.required}
                       onChange={(e) => updateField(i, { required: e.target.checked })} />
                Required
              </label>
              <button className="text-red-600 text-sm" onClick={() => removeField(i)}>Remove</button>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-5 text-sm">
          <input type="checkbox" checked={form.is_published}
                 onChange={(e) => set("is_published", e.target.checked)} />
          Publish it — members can see and register straight away
        </label>

        {message && <p className="mt-3 text-sm">{message}</p>}

        <div className="flex gap-3 mt-4">
          <button onClick={save} disabled={saving}
                  className="bg-[#800000] text-white px-5 py-2 rounded">
            {saving ? "Saving…" : editing ? "Save changes" : "Create programme"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ ...BLANK }); }}
                    className="px-5 py-2 rounded border">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ------------- list ------------- */}
      <h2 className="font-semibold mb-3">All programmes</h2>
      <div className="grid gap-3">
        {programmes.map((p) => {
          const s = stats[p.id] ?? {};
          return (
            <div key={p.id} className="border rounded p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[220px]">
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-gray-500">
                  {p.starts_at ? new Date(p.starts_at).toLocaleString("en-NG") : "No date set"}
                  {" · "}{p.fee_naira > 0 ? naira(p.fee_naira) : "Free"}
                </p>
              </div>
              <div className="text-sm text-gray-700">
                {s.total_registered ?? 0} registered · {s.total_paid ?? 0} paid
                {s.revenue_naira ? ` · ${naira(s.revenue_naira)}` : ""}
              </div>
              <button onClick={() => togglePublish(p)}
                      className={`px-3 py-1 rounded text-sm ${
                        p.is_published ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                {p.is_published ? "Live" : "Draft"}
              </button>
              <button onClick={() => startEdit(p)} className="underline text-sm">Edit</button>
              <a className="underline text-sm" href={`/admin/programmes/${p.id}/registrations`}>
                Registrations
              </a>
              <button onClick={() => remove(p)} disabled={deletingId === p.id}
                      className="text-red-600 text-sm">
                {deletingId === p.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}