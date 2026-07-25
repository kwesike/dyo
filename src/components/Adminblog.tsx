import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile, slugify } from "../lib/Storage";
import { useAuth } from "./Authcontext";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_url: string | null;
  category: string | null;
  author_name: string | null;
  is_published: boolean;
  published_at: string | null;
  reading_minutes: number | null;
}

const CATEGORIES = ["Reflection", "Teaching", "Report", "Testimony", "Announcement"];

const BLANK = {
  title: "", excerpt: "", body: "", cover_url: "",
  category: "Reflection", is_published: false,
};

export default function AdminBlog() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase.from("blog_posts")
      .select("*").order("created_at", { ascending: false });
    setPosts((data as Post[]) ?? []);
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicFile("programme-media", file, "blog");
      setForm((f) => ({ ...f, cover_url: url }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(false);
  }

  async function save(publish?: boolean) {
    if (!form.title.trim()) return setMessage("Give the post a title.");
    if (!form.body.trim()) return setMessage("The post needs something to say.");

    setBusy(true);
    setMessage("");

    const isPublished = publish ?? form.is_published;

    const payload = {
      title: form.title.trim(),
      slug: slugify(form.title),
      excerpt: form.excerpt.trim() || form.body.trim().slice(0, 160) + "…",
      body: form.body,
      cover_url: form.cover_url || null,
      category: form.category,
      author_name: profile?.full_name ?? null,
      author_id: profile?.id ?? null,
      is_published: isPublished,
    };

    const { error } = editing
      ? await supabase.from("blog_posts").update(payload).eq("id", editing)
      : await supabase.from("blog_posts").insert(payload);

    setBusy(false);

    if (error) {
      return setMessage(
        error.code === "23505"
          ? "A post with that title already exists — change it slightly."
          : "Couldn't save that post.",
      );
    }

    setMessage(isPublished ? "Published." : "Saved as a draft.");
    setForm({ ...BLANK });
    setEditing(null);
    void load();
  }

  function edit(p: Post) {
    setEditing(p.id);
    setForm({
      title: p.title, excerpt: p.excerpt ?? "", body: p.body,
      cover_url: p.cover_url ?? "", category: p.category ?? "Reflection",
      is_published: p.is_published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(p: Post) {
    await supabase.from("blog_posts")
      .update({ is_published: !p.is_published }).eq("id", p.id);
    void load();
  }

  async function remove(p: Post) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await supabase.from("blog_posts").delete().eq("id", p.id);
    void load();
  }

  const words = form.body.trim() ? form.body.trim().split(/\s+/).length : 0;

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">The site</p>
          <h1>Blog</h1>
          <p>Reflections, teaching, reports from programmes. Save a draft and publish when it's ready.</p>
        </div>
      </div>

      <div className="a-card">
        <p className="a-eyebrow">{editing ? "Edit post" : "Write a post"}</p>

        <input placeholder="Title" style={{ width: "100%", fontSize: "1.05rem" }}
               value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} />

        <div style={{ display: "grid", gap: 12, marginTop: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <select value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div>
            <input type="file" accept="image/*"
                   onChange={(e) => uploadCover(e.target.files?.[0])} />
            {uploading && <p style={{ fontSize: "0.82rem" }}>Uploading…</p>}
          </div>
        </div>

        {form.cover_url && (
          <img src={form.cover_url} alt=""
               style={{ marginTop: 12, width: "100%", maxWidth: 460, height: 170,
                        objectFit: "cover", borderRadius: 10 }} />
        )}

        <textarea rows={2} placeholder="A one-line summary for the listing (optional)"
                  style={{ width: "100%", marginTop: 12 }}
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />

        <textarea rows={14} placeholder="Write the post here. Leave a blank line between paragraphs."
                  style={{ width: "100%", marginTop: 12, lineHeight: 1.7,
                           fontFamily: "Newsreader, Georgia, serif", fontSize: "1rem" }}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })} />

        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6,
                    fontVariantNumeric: "tabular-nums" }}>
          {words} word{words === 1 ? "" : "s"}
          {words > 0 && ` · about ${Math.max(1, Math.ceil(words / 200))} min read`}
        </p>

        {message && <p style={{ fontSize: "0.9rem", marginTop: 10 }}>{message}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="a-btn" onClick={() => save(true)} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save and publish" : "Publish"}
          </button>
          <button className="a-btn a-btn--quiet" onClick={() => save(false)} disabled={busy}>
            Save as draft
          </button>
          {editing && (
            <button className="a-btn a-btn--ghost"
                    onClick={() => { setEditing(null); setForm({ ...BLANK }); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <h2 className="a-section-title">All posts</h2>

      {posts.length === 0 ? (
        <div className="a-empty">
          <h3>Nothing written yet</h3>
          <p>The blog page stays hidden until the first post is published.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <div key={p.id} className="a-card"
                 style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {p.cover_url && (
                <img src={p.cover_url} alt=""
                     style={{ width: 92, height: 62, objectFit: "cover", borderRadius: 8 }} />
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong style={{ display: "block", fontFamily: "Newsreader, Georgia, serif",
                                 fontSize: "1.08rem" }}>
                  {p.title}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {p.category}
                  {p.reading_minutes ? ` · ${p.reading_minutes} min read` : ""}
                  {p.published_at
                    ? ` · ${new Date(p.published_at).toLocaleDateString("en-NG")}`
                    : ""}
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