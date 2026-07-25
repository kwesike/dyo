import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile, slugify } from "../lib/Storage";

interface Page {
  slug: string;
  title: string;
  body: string;
  cover_url: string | null;
  in_menu: boolean;
  sort_order: number;
  is_published: boolean;
}

const BLANK = { title: "", body: "", cover_url: "", in_menu: false, sort_order: 100 };

/**
 * Custom pages. An admin with the "pages" section can publish something like
 * an About or Constitution page, optionally pinned to the main menu, and it
 * shows at /p/<slug> with no code change.
 */
export default function AdminPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase.from("site_pages")
      .select("*").order("sort_order", { ascending: true });
    setPages((data as Page[]) ?? []);
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicFile("product-images", file, "pages");
      setForm((f) => ({ ...f, cover_url: url }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(false);
  }

  async function save(publish: boolean) {
    if (!form.title.trim()) return setMessage("Give the page a title.");
    if (!form.body.trim()) return setMessage("The page needs some content.");

    setBusy(true);
    setMessage("");

    const slug = editingSlug ?? slugify(form.title);
    const payload = {
      slug,
      title: form.title.trim(),
      body: form.body,
      cover_url: form.cover_url || null,
      in_menu: form.in_menu,
      sort_order: Number(form.sort_order) || 100,
      is_published: publish,
    };

    const { error } = editingSlug
      ? await supabase.from("site_pages").update(payload).eq("slug", editingSlug)
      : await supabase.from("site_pages").insert(payload);

    setBusy(false);
    if (error) {
      return setMessage(
        error.code === "23505"
          ? "A page with that title already exists — change it slightly."
          : "Couldn't save that page.",
      );
    }

    setMessage(publish ? "Published." : "Saved as a draft.");
    setForm({ ...BLANK });
    setEditingSlug(null);
    void load();
  }

  function edit(p: Page) {
    setEditingSlug(p.slug);
    setForm({
      title: p.title, body: p.body, cover_url: p.cover_url ?? "",
      in_menu: p.in_menu, sort_order: p.sort_order,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(p: Page) {
    await supabase.from("site_pages")
      .update({ is_published: !p.is_published }).eq("slug", p.slug);
    void load();
  }

  async function remove(p: Page) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await supabase.from("site_pages").delete().eq("slug", p.slug);
    void load();
  }

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">The site</p>
          <h1>Pages</h1>
          <p>
            Standalone pages like About or the Constitution. Tick "show in menu"
            to pin it to the main navigation.
          </p>
        </div>
      </div>

      <div className="a-card">
        <p className="a-eyebrow">{editingSlug ? "Edit page" : "New page"}</p>

        <input placeholder="Title" style={{ width: "100%", fontSize: "1.05rem" }}
               value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} />
        {!editingSlug && form.title && (
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6 }}>
            Will live at <code>/p/{slugify(form.title)}</code>
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <input type="file" accept="image/*"
                 onChange={(e) => uploadCover(e.target.files?.[0])} />
          {uploading && <p style={{ fontSize: "0.82rem" }}>Uploading…</p>}
          {form.cover_url && (
            <img src={form.cover_url} alt=""
                 style={{ marginTop: 10, width: "100%", maxWidth: 440, height: 150,
                          objectFit: "cover", borderRadius: 10 }} />
          )}
        </div>

        <textarea rows={14} placeholder="Write the page here. Leave a blank line between paragraphs."
                  style={{ width: "100%", marginTop: 12, lineHeight: 1.7,
                           fontFamily: "Newsreader, Georgia, serif", fontSize: "1rem" }}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })} />

        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 12,
                      flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.in_menu}
                   onChange={(e) => setForm({ ...form, in_menu: e.target.checked })} />
            Show in the main menu
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Menu order
            <input type="number" value={form.sort_order} style={{ width: 80 }}
                   onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </label>
        </div>

        {message && <p style={{ fontSize: "0.9rem", marginTop: 10 }}>{message}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="a-btn" onClick={() => save(true)} disabled={busy}>
            {busy ? "Saving…" : "Publish"}
          </button>
          <button className="a-btn a-btn--quiet" onClick={() => save(false)} disabled={busy}>
            Save as draft
          </button>
          {editingSlug && (
            <button className="a-btn a-btn--ghost"
                    onClick={() => { setEditingSlug(null); setForm({ ...BLANK }); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <h2 className="a-section-title">All pages</h2>

      {pages.length === 0 ? (
        <div className="a-empty">
          <h3>No custom pages yet</h3>
          <p>Anything you publish here can be linked from the menu or anywhere on the site.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {pages.map((p) => (
            <div key={p.slug} className="a-card"
                 style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong style={{ display: "block", fontFamily: "Newsreader, Georgia, serif",
                                 fontSize: "1.08rem" }}>
                  {p.title}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  /p/{p.slug}{p.in_menu ? " · in the menu" : ""}
                </span>
              </div>
              <button onClick={() => toggle(p)}
                      className={`a-pill ${p.is_published ? "a-pill--live" : "a-pill--draft"}`}
                      style={{ border: "none", cursor: "pointer" }}>
                {p.is_published ? "Published" : "Draft"}
              </button>
              <button className="a-btn a-btn--ghost" onClick={() => edit(p)}>Edit</button>
              <button className="a-btn a-btn--ghost" style={{ color: "var(--red)" }}
                      onClick={() => remove(p)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}