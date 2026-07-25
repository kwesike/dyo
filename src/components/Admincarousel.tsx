import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile } from "../lib/Storage";

interface Slide {
  id: string;
  image_url: string;
  eyebrow: string | null;
  heading: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const BLANK = {
  image_url: "", eyebrow: "", heading: "", body: "",
  cta_label: "See what's on", cta_url: "/programmes", sort_order: 100,
};

export default function AdminCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase.from("carousel_slides")
      .select("*").order("sort_order", { ascending: true });
    setSlides((data as Slide[]) ?? []);
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicFile("programme-media", file, "carousel");
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(false);
  }

  async function save() {
    if (!form.image_url) return setMessage("Choose an image first.");
    if (!form.heading.trim()) return setMessage("Give the slide a heading.");

    setBusy(true);
    setMessage("");

    const payload = {
      image_url: form.image_url,
      eyebrow: form.eyebrow.trim() || null,
      heading: form.heading.trim(),
      body: form.body.trim() || null,
      cta_label: form.cta_label.trim() || null,
      cta_url: form.cta_url.trim() || null,
      sort_order: Number(form.sort_order) || 100,
    };

    const { error } = editing
      ? await supabase.from("carousel_slides").update(payload).eq("id", editing)
      : await supabase.from("carousel_slides").insert(payload);

    setBusy(false);
    if (error) return setMessage("Couldn't save that slide.");

    setMessage(editing ? "Slide updated." : "Slide added.");
    setForm({ ...BLANK });
    setEditing(null);
    void load();
  }

  function edit(s: Slide) {
    setEditing(s.id);
    setForm({
      image_url: s.image_url, eyebrow: s.eyebrow ?? "", heading: s.heading,
      body: s.body ?? "", cta_label: s.cta_label ?? "", cta_url: s.cta_url ?? "",
      sort_order: s.sort_order,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(s: Slide) {
    await supabase.from("carousel_slides")
      .update({ is_active: !s.is_active }).eq("id", s.id);
    void load();
  }

  async function move(s: Slide, direction: -1 | 1) {
    const i = slides.findIndex((x) => x.id === s.id);
    const swap = slides[i + direction];
    if (!swap) return;
    await Promise.all([
      supabase.from("carousel_slides").update({ sort_order: swap.sort_order }).eq("id", s.id),
      supabase.from("carousel_slides").update({ sort_order: s.sort_order }).eq("id", swap.id),
    ]);
    void load();
  }

  async function remove(s: Slide) {
    if (!confirm("Remove this slide from the home page?")) return;
    await supabase.from("carousel_slides").delete().eq("id", s.id);
    void load();
  }

  const active = slides.filter((s) => s.is_active).length;

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">The site</p>
          <h1>Home page slideshow</h1>
          <p>
            The big images at the top of the home page. Each one carries its own
            words, so the message changes as the pictures do.
          </p>
        </div>
      </div>

      {active === 0 && slides.length > 0 && (
        <p className="a-pill a-pill--warn" style={{ marginBottom: 16 }}>
          Nothing is showing — every slide is switched off
        </p>
      )}

      <div className="a-card">
        <p className="a-eyebrow">{editing ? "Edit slide" : "Add a slide"}</p>

        <div style={{ display: "grid", gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input placeholder="Small line above, e.g. Village Missions"
                 value={form.eyebrow}
                 onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} />
          <input placeholder="Heading — keep it short"
                 value={form.heading}
                 onChange={(e) => setForm({ ...form, heading: e.target.value })} />
          <input placeholder="Button label, e.g. Volunteer"
                 value={form.cta_label}
                 onChange={(e) => setForm({ ...form, cta_label: e.target.value })} />
          <input placeholder="Button link, e.g. /programmes"
                 value={form.cta_url}
                 onChange={(e) => setForm({ ...form, cta_url: e.target.value })} />
        </div>

        <textarea rows={2} placeholder="A sentence or two underneath the heading"
                  style={{ width: "100%", marginTop: 12 }}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })} />

        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>Image</p>
          <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
          {uploading && <p style={{ fontSize: "0.85rem" }}>Uploading…</p>}
          {form.image_url && (
            <img src={form.image_url} alt=""
                 style={{ marginTop: 10, width: "100%", maxWidth: 460, height: 160,
                          objectFit: "cover", borderRadius: 10 }} />
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6 }}>
            Wide, landscape photos work best — around 1600 by 900. The left third
            sits under the text, so avoid faces there.
          </p>
        </div>

        {message && <p style={{ fontSize: "0.88rem", marginTop: 12 }}>{message}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="a-btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add slide"}
          </button>
          {editing && (
            <button className="a-btn a-btn--quiet"
                    onClick={() => { setEditing(null); setForm({ ...BLANK }); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <h2 className="a-section-title">Slides in order</h2>

      {slides.length === 0 ? (
        <div className="a-empty">
          <h3>No slides yet</h3>
          <p>Add one above and it appears on the home page straight away.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {slides.map((s) => (
            <div key={s.id} className="a-card"
                 style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img src={s.image_url} alt=""
                   style={{ width: 130, height: 78, objectFit: "cover", borderRadius: 8 }} />

              <div style={{ flex: 1, minWidth: 180 }}>
                {s.eyebrow && (
                  <p className="a-eyebrow" style={{ margin: 0 }}>{s.eyebrow}</p>
                )}
                <strong style={{ display: "block", fontFamily: "Newsreader, Georgia, serif",
                                 fontSize: "1.05rem" }}>
                  {s.heading}
                </strong>
                {s.body && (
                  <span style={{ color: "var(--muted)", fontSize: "0.86rem" }}>{s.body}</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <button className="a-btn a-btn--quiet" style={{ minHeight: 34, padding: "4px 10px" }}
                        onClick={() => move(s, -1)} aria-label="Move up">↑</button>
                <button className="a-btn a-btn--quiet" style={{ minHeight: 34, padding: "4px 10px" }}
                        onClick={() => move(s, 1)} aria-label="Move down">↓</button>
              </div>

              <button onClick={() => toggle(s)}
                      className={`a-pill ${s.is_active ? "a-pill--live" : "a-pill--draft"}`}
                      style={{ border: "none", cursor: "pointer" }}>
                {s.is_active ? "Showing" : "Hidden"}
              </button>
              <button className="a-btn a-btn--ghost" onClick={() => edit(s)}>Edit</button>
              <button className="a-btn a-btn--ghost" style={{ color: "var(--red)" }}
                      onClick={() => remove(s)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}