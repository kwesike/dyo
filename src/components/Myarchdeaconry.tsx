import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile, slugify } from "../lib/Storage";
import { useAuth } from "./Authcontext";
import { ARCHDEACONRIES } from "../lib/Constants";

/**
 * What an archdeaconry admin sees — the ONLY admin page they get.
 *
 * It's scoped to their one archdeaconry both here and in the database: RLS
 * (can_manage_archdeaconry) refuses any write to programmes or photos that
 * aren't tagged with their slug, so even a hand-crafted request can't reach
 * another archdeaconry's content.
 *
 * A super admin viewing another archdeaconry passes ?arch=<slug>.
 */
export default function MyArchdeaconry() {
  const { profile, isSuperAdmin } = useAuth();
  const params = new URLSearchParams(window.location.search);

  // The archdeaconry name this admin owns, matched to its slug.
  const managedName = profile?.managed_archdeaconry ?? null;
  const [slug, setSlug] = useState<string>(params.get("arch") ?? "");
  const [arch, setArch] = useState<any>(null);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [tab, setTab] = useState<"page" | "programmes" | "gallery">("page");
  const [blurb, setBlurb] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // Resolve the slug from the managed archdeaconry name once.
  useEffect(() => {
    (async () => {
      if (slug) return;
      if (!managedName) return;
      const { data } = await supabase.from("archdeaconries")
        .select("slug").eq("name", managedName).maybeSingle();
      if (data) setSlug(data.slug);
    })();
  }, [managedName, slug]);

  useEffect(() => { if (slug) void load(); }, [slug]);

  async function load() {
    const [{ data: a }, { data: progs }, { data: pics }] = await Promise.all([
      supabase.from("archdeaconries").select("*").eq("slug", slug).maybeSingle(),
      supabase.from("programmes").select("*")
        .eq("archdeaconry_slug", slug).order("starts_at", { ascending: false }),
      supabase.from("gallery_images").select("*")
        .eq("archdeaconry_slug", slug).order("created_at", { ascending: false }),
    ]);
    setArch(a);
    setBlurb(a?.blurb ?? "");
    setProgrammes(progs ?? []);
    setPhotos(pics ?? []);
  }

  async function saveBlurb() {
    setMessage("");
    const { error } = await supabase.from("archdeaconries")
      .update({ blurb: blurb.trim() || null }).eq("slug", slug);
    setMessage(error ? "Couldn't save — you may not have permission." : "Saved.");
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    const url = await uploadPublicFile("programme-media", file, `archdeaconry/${slug}`);
    await supabase.from("archdeaconries").update({ cover_url: url }).eq("slug", slug);
    setUploading(false);
    void load();
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const rows: any[] = [];
    for (const file of Array.from(files)) {
      try {
        const url = await uploadPublicFile("programme-media", file, `archdeaconry/${slug}`);
        rows.push({ image_url: url, album: arch?.name ?? "Archdeaconry",
                    archdeaconry_slug: slug });
      } catch {
        setMessage("One photo failed to upload; the rest are going.");
      }
    }
    if (rows.length) await supabase.from("gallery_images").insert(rows);
    setUploading(false);
    void load();
  }

  async function removePhoto(id: string) {
    if (!confirm("Remove this photo?")) return;
    await supabase.from("gallery_images").delete().eq("id", id);
    void load();
  }

  if (!managedName && !isSuperAdmin) {
    return (
      <div className="a-empty">
        <h3>No archdeaconry assigned</h3>
        <p>Ask a super admin to assign you an archdeaconry.</p>
      </div>
    );
  }

  if (isSuperAdmin && !slug) {
    return (
      <>
        <div className="a-head"><div><p className="a-eyebrow">Archdeaconries</p>
          <h1>Pick an archdeaconry to manage</h1></div></div>
        <div style={{ display: "grid", gap: 8,
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
          {ARCHDEACONRIES.filter((a) => a !== "Non-Anglican").map((a) => (
            <button key={a} className="a-card"
                    style={{ cursor: "pointer", textAlign: "left" }}
                    onClick={() => setSlug(slugify(a))}>
              {a}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">Archdeaconry</p>
          <h1>{arch?.name ?? managedName}</h1>
          <p>Your programmes and photo gallery. Everything here shows on your public page.</p>
        </div>
        {arch && (
          <a className="a-btn a-btn--quiet" href={`/archdeaconry/${slug}`} target="_blank" rel="noreferrer">
            View public page
          </a>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
        {(["page", "programmes", "gallery"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={tab === t ? "a-btn" : "a-btn a-btn--quiet"}
                  style={{ minHeight: 38, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {message && <p style={{ fontSize: "0.9rem", marginBottom: 14 }}>{message}</p>}

      {tab === "page" && (
        <div className="a-card">
          <p className="a-eyebrow">Cover photo</p>
          {arch?.cover_url && (
            <img src={arch.cover_url} alt="" style={{ width: "100%", maxWidth: 520,
                 height: 160, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
          )}
          <input type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files?.[0])} />
          {uploading && <p style={{ fontSize: "0.85rem" }}>Uploading…</p>}

          <p className="a-eyebrow" style={{ marginTop: 22 }}>About this archdeaconry</p>
          <textarea rows={4} style={{ width: "100%" }} value={blurb}
                    onChange={(e) => setBlurb(e.target.value)}
                    placeholder="A short welcome shown at the top of your page" />
          <button className="a-btn" style={{ marginTop: 12 }} onClick={saveBlurb}>Save</button>
        </div>
      )}

      {tab === "programmes" && (
        <div className="a-card">
          <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
            Create programmes tagged to {arch?.name}. They appear on your page and in
            the main programmes list.
          </p>
          <a className="a-btn" href={`/admin/programmes?arch=${slug}`}>
            Open the programme editor
          </a>
          <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
            {programmes.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between",
                     padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{p.title}</span>
                <span className={`a-pill ${p.is_published ? "a-pill--live" : "a-pill--draft"}`}>
                  {p.is_published ? "Live" : "Draft"}
                </span>
              </div>
            ))}
            {programmes.length === 0 && <p style={{ color: "var(--muted)" }}>No programmes yet.</p>}
          </div>
        </div>
      )}

      {tab === "gallery" && (
        <div className="a-card">
          <p className="a-eyebrow">Add photos</p>
          <input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
          {uploading && <p style={{ fontSize: "0.85rem" }}>Uploading…</p>}

          <div style={{ marginTop: 18, display: "grid", gap: 12,
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))" }}>
            {photos.map((photo) => (
              <div key={photo.id} style={{ position: "relative" }}>
                <img src={photo.image_url} alt="" loading="lazy"
                     style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 8 }} />
                <button onClick={() => removePhoto(photo.id)}
                        style={{ position: "absolute", top: 6, right: 6, border: "none",
                                 background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: 6,
                                 padding: "2px 8px", cursor: "pointer", fontSize: "0.8rem" }}>
                  ✕
                </button>
              </div>
            ))}
            {photos.length === 0 && <p style={{ color: "var(--muted)" }}>No photos yet.</p>}
          </div>
        </div>
      )}
    </>
  );
}