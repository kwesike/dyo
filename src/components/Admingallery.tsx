import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile } from "../lib/Storage";

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  album: string;
  taken_on: string | null;
  is_published: boolean;
  programme_id: string | null;
}

export default function AdminGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [album, setAlbum] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [takenOn, setTakenOn] = useState("");
  const [filter, setFilter] = useState("All");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from("gallery_images").select("*")
        .order("created_at", { ascending: false }),
      supabase.from("programmes").select("id, title")
        .order("starts_at", { ascending: false }),
    ]);
    setPhotos((p as Photo[]) ?? []);
    setProgrammes(pr ?? []);
  }

  /** Uploading twenty photos one at a time is the normal case here. */
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (!album.trim()) return setMessage("Name the album first — e.g. Convention 2026.");

    setMessage("");
    setProgress({ done: 0, total: files.length });

    const rows: any[] = [];

    for (const file of Array.from(files)) {
      try {
        const url = await uploadPublicFile("programme-media", file, `gallery/${album.trim()}`);
        rows.push({
          image_url: url,
          album: album.trim(),
          programme_id: programmeId || null,
          taken_on: takenOn || null,
        });
      } catch {
        setMessage(`Couldn't upload ${file.name}. The rest are still going.`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    if (rows.length) await supabase.from("gallery_images").insert(rows);

    setProgress({ done: 0, total: 0 });
    setMessage(`${rows.length} photo${rows.length === 1 ? "" : "s"} added to ${album}.`);
    void load();
  }

  async function setCaption(photo: Photo, caption: string) {
    await supabase.from("gallery_images")
      .update({ caption: caption.trim() || null }).eq("id", photo.id);
    void load();
  }

  async function toggle(photo: Photo) {
    await supabase.from("gallery_images")
      .update({ is_published: !photo.is_published }).eq("id", photo.id);
    void load();
  }

  async function remove(photo: Photo) {
    if (!confirm("Delete this photo from the gallery?")) return;
    await supabase.from("gallery_images").delete().eq("id", photo.id);
    void load();
  }

  const albums = useMemo(
    () => ["All", ...Array.from(new Set(photos.map((p) => p.album))).sort()],
    [photos],
  );

  const shown = filter === "All" ? photos : photos.filter((p) => p.album === filter);

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">The site</p>
          <h1>Gallery</h1>
          <p>Photographs from conventions, missions and everything else, grouped into albums.</p>
        </div>
      </div>

      <div className="a-card">
        <p className="a-eyebrow">Add photos</p>

        <div style={{ display: "grid", gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <input placeholder="Album name, e.g. Convention 2026"
                 value={album} onChange={(e) => setAlbum(e.target.value)} />
          <select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
            <option value="">Not tied to a programme</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)",
                           marginBottom: 4 }}>
              When were they taken?
            </span>
            <input type="date" value={takenOn} style={{ width: "100%" }}
                   onChange={(e) => setTakenOn(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <input type="file" accept="image/*" multiple
                 onChange={(e) => addPhotos(e.target.files)} />
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6 }}>
            Select as many as you like at once. Large photos are uploaded as they
            are, so resize anything over about 2MB first — phones on mobile data
            will thank you.
          </p>
        </div>

        {progress.total > 0 && (
          <p style={{ marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
            Uploading {progress.done} of {progress.total}…
          </p>
        )}
        {message && <p style={{ marginTop: 10, fontSize: "0.9rem" }}>{message}</p>}
      </div>

      <h2 className="a-section-title">
        {photos.length} photo{photos.length === 1 ? "" : "s"}
      </h2>

      {albums.length > 2 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {albums.map((a) => (
            <button key={a} onClick={() => setFilter(a)}
                    className={a === filter ? "a-btn" : "a-btn a-btn--quiet"}
                    style={{ minHeight: 34, padding: "6px 14px", fontSize: "0.85rem" }}>
              {a}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="a-empty">
          <h3>No photos yet</h3>
          <p>Name an album, pick some pictures, and they'll appear on the gallery page.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16,
                      gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {shown.map((photo) => (
            <div key={photo.id} className="a-card" style={{ padding: 10 }}>
              <img src={photo.image_url} alt="" loading="lazy"
                   style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover",
                            borderRadius: 8, opacity: photo.is_published ? 1 : 0.45 }} />

              <input defaultValue={photo.caption ?? ""} placeholder="Add a caption"
                     style={{ width: "100%", marginTop: 8, fontSize: "0.85rem" }}
                     onBlur={(e) => setCaption(photo, e.target.value)} />

              <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginTop: 8 }}>
                <button onClick={() => toggle(photo)}
                        className={`a-pill ${photo.is_published ? "a-pill--live" : "a-pill--draft"}`}
                        style={{ border: "none", cursor: "pointer" }}>
                  {photo.is_published ? "Showing" : "Hidden"}
                </button>
                <button className="a-btn a-btn--ghost" style={{ color: "var(--red)" }}
                        onClick={() => remove(photo)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}