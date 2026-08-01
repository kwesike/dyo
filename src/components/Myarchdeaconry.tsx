import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadPublicFile, slugify } from "../lib/Storage";
import { useAuth } from "./Authcontext";
import { ARCHDEACONRIES } from "../lib/Constants";

/**
 * What an archdeaconry admin sees — the ONLY admin page they get.
 *
 * Scoped to their one archdeaconry both here and in the database: RLS
 * (can_manage_archdeaconry) refuses any write to programmes or photos that
 * aren't tagged with their slug. They can also view who registered for their
 * programmes and the birthdays in their archdeaconry.
 *
 * A super admin viewing another archdeaconry passes ?arch=<slug>.
 */
export default function MyArchdeaconry() {
  const { profile, isSuperAdmin } = useAuth();
  const params = new URLSearchParams(window.location.search);

  const managedName = profile?.managed_archdeaconry ?? null;
  const [slug, setSlug] = useState<string>(params.get("arch") ?? "");
  const [arch, setArch] = useState<any>(null);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [tab, setTab] = useState<"page" | "programmes" | "participants" | "gallery" | "birthdays">("page");
  const [blurb, setBlurb] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [regProgFilter, setRegProgFilter] = useState("");

  // New-album form
  const [albTitle, setAlbTitle] = useState("");
  const [albWriteup, setAlbWriteup] = useState("");
  const [albFiles, setAlbFiles] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      if (slug) return;
      if (!managedName) return;
      // managed_archdeaconry already holds the slug — use it directly if it
      // looks like one; otherwise resolve a name to its slug.
      if (managedName === managedName.toLowerCase() && !managedName.includes(" ")) {
        setSlug(managedName);
        return;
      }
      const { data } = await supabase.from("archdeaconries")
        .select("slug").eq("name", managedName).maybeSingle();
      if (data) setSlug(data.slug);
    })();
  }, [managedName, slug]);

  useEffect(() => { if (slug) void load(); }, [slug]);

  async function load() {
    const [{ data: a }, { data: progs }, { data: albs }] = await Promise.all([
      supabase.from("archdeaconries").select("*").eq("slug", slug).maybeSingle(),
      supabase.from("programmes").select("*")
        .eq("archdeaconry_slug", slug).order("starts_at", { ascending: false }),
      supabase.from("gallery_albums").select("*, gallery_images(id, image_url)")
        .eq("archdeaconry_slug", slug).order("created_at", { ascending: false }),
    ]);
    setArch(a);
    setBlurb(a?.blurb ?? "");
    setProgrammes(progs ?? []);
    setAlbums(albs ?? []);
  }

  async function createAlbum() {
    setMessage("");
    if (!albTitle.trim()) { setMessage("Give the album a title."); return; }
    if (albFiles.length === 0) { setMessage("Add at least one photo."); return; }
    if (albFiles.length > 7) { setMessage("An album can hold at most 7 photos."); return; }

    setUploading(true);
    try {
      // Upload photos first.
      const urls: string[] = [];
      for (const file of albFiles) {
        try {
          const url = await uploadPublicFile("programme-media", file, `archdeaconry/${slug}/albums`);
          urls.push(url);
        } catch { /* skip a failed photo */ }
      }
      if (urls.length === 0) { setMessage("Photos couldn't upload. Try again."); setUploading(false); return; }

      // Create the album with the first photo as cover.
      const { data: album, error: albErr } = await supabase.from("gallery_albums").insert({
        title: albTitle.trim(),
        writeup: albWriteup.trim() || null,
        cover_url: urls[0],
        archdeaconry_slug: slug,
        created_by: profile?.id,
      }).select().single();

      if (albErr || !album) {
        setMessage("Couldn't create the album — you may not have permission.");
        setUploading(false);
        return;
      }

      // Link the photos.
      await supabase.from("gallery_images").insert(
        urls.map((url) => ({
          image_url: url, album_id: album.id,
          album: albTitle.trim(), archdeaconry_slug: slug,
        })),
      );

      setAlbTitle(""); setAlbWriteup(""); setAlbFiles([]);
      setMessage("Album created.");
    } catch {
      setMessage("Something went wrong creating the album.");
    }
    setUploading(false);
    void load();
  }

  async function removeAlbum(id: string) {
    if (!confirm("Delete this whole album and its photos?")) return;
    await supabase.from("gallery_albums").delete().eq("id", id);
    void load();
  }

  // Registrations for this archdeaconry's programmes (RLS allows the read).
  async function loadRegistrations() {
    const progIds = programmes.map((p) => p.id);
    if (progIds.length === 0) { setRegistrations([]); return; }
    const { data } = await supabase
      .from("programme_registrations")
      .select("id, full_name, church, phone, payment_status, programme_id, created_at")
      .in("programme_id", progIds)
      .order("created_at", { ascending: false });
    setRegistrations(data ?? []);
  }

  async function loadBirthdays() {
    const { data } = await supabase.rpc("upcoming_birthdays", { p_days: 60 });
    setBirthdays(data ?? []);
  }

  useEffect(() => {
    if (tab === "participants") void loadRegistrations();
    if (tab === "birthdays") void loadBirthdays();
  }, [tab, programmes]);

  async function saveBlurb() {
    setMessage("");
    const { data, error } = await supabase.from("archdeaconries")
      .update({ blurb: blurb.trim() || null }).eq("slug", slug).select();
    if (error) setMessage("Couldn't save: " + error.message);
    else if (!data || data.length === 0)
      setMessage("Not saved — you may not have permission for this archdeaconry.");
    else setMessage("Saved.");
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const url = await uploadPublicFile("programme-media", file, `archdeaconry/${slug}`);
      // Ask for the updated row back — if RLS blocks the write it returns
      // empty with no error, which is the "saved but nothing there" symptom.
      const { data, error } = await supabase.from("archdeaconries")
        .update({ cover_url: url }).eq("slug", slug).select();
      if (error) {
        setMessage("Couldn't save the cover photo: " + error.message);
      } else if (!data || data.length === 0) {
        setMessage("The cover photo wasn't saved — you may not have permission for this archdeaconry.");
      } else {
        setMessage("Cover photo saved.");
      }
    } catch {
      setMessage("Couldn't upload the cover photo. Try again.");
    }
    setUploading(false);
    void load();
  }

  const progName = (id: string) => programmes.find((p) => p.id === id)?.title ?? "—";
  const shownRegs = regProgFilter
    ? registrations.filter((r) => r.programme_id === regProgFilter)
    : registrations;

  const isToday = (d: string) => {
    const t = new Date(), x = new Date(d);
    return t.getDate() === x.getDate() && t.getMonth() === x.getMonth();
  };

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
          <p>Your programmes, participants and photo gallery. Everything here shows on your public page.</p>
        </div>
        {arch && (
          <a className="a-btn a-btn--quiet" href={`/archdeaconry/${slug}`} target="_blank" rel="noreferrer">
            View public page
          </a>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
        {(["page", "programmes", "participants", "gallery", "birthdays"] as const).map((t) => (
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

      {tab === "participants" && (
        <div className="a-card">
          <p className="a-eyebrow">Registered participants</p>
          <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
            Everyone who registered for your programmes.
          </p>

          <select value={regProgFilter} onChange={(e) => setRegProgFilter(e.target.value)}
                  style={{ marginBottom: 14, padding: "8px 10px" }}>
            <option value="">All programmes ({registrations.length})</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          {shownRegs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No registrations yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.9rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
                    <th style={{ padding: "8px 6px" }}>Name</th>
                    <th style={{ padding: "8px 6px" }}>Church</th>
                    <th style={{ padding: "8px 6px" }}>Phone</th>
                    <th style={{ padding: "8px 6px" }}>Programme</th>
                    <th style={{ padding: "8px 6px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRegs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 6px" }}>{r.full_name ?? "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{r.church ?? "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{r.phone ?? "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{progName(r.programme_id)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <span className={`a-pill ${r.payment_status === "paid" ? "a-pill--live" : "a-pill--draft"}`}>
                          {r.payment_status === "paid" ? "Paid" : r.payment_status ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "gallery" && (
        <div className="a-card">
          <p className="a-eyebrow">New album</p>
          <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
            Group up to 7 photos under a title and a short write-up.
          </p>

          <input placeholder="Album title" value={albTitle}
                 onChange={(e) => setAlbTitle(e.target.value)}
                 style={{ width: "100%", marginBottom: 10, padding: "10px 12px" }} />

          <textarea rows={3} placeholder="Write-up — what was this event about?"
                    value={albWriteup} onChange={(e) => setAlbWriteup(e.target.value)}
                    style={{ width: "100%", marginBottom: 10 }} />

          <input type="file" accept="image/*" multiple
                 onChange={(e) => {
                   const files = Array.from(e.target.files ?? []);
                   if (files.length > 7) {
                     setMessage("Only 7 photos per album — the first 7 were kept.");
                   }
                   setAlbFiles(files.slice(0, 7));
                 }} />
          {albFiles.length > 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 6 }}>
              {albFiles.length} photo{albFiles.length === 1 ? "" : "s"} selected (max 7)
            </p>
          )}

          <button className="a-btn" style={{ marginTop: 12 }}
                  onClick={createAlbum} disabled={uploading}>
            {uploading ? "Creating…" : "Create album"}
          </button>

          {/* Existing albums */}
          <div style={{ marginTop: 26, display: "grid", gap: 16 }}>
            {albums.map((al) => (
              <div key={al.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{al.title}</h3>
                    {al.writeup && <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>{al.writeup}</p>}
                  </div>
                  <button onClick={() => removeAlbum(al.id)}
                          style={{ border: "none", background: "transparent", color: "#b00020",
                                   cursor: "pointer", fontSize: "0.85rem" }}>
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8,
                              gridTemplateColumns: "repeat(auto-fill, minmax(90px,1fr))" }}>
                  {(al.gallery_images ?? []).map((img: any) => (
                    <img key={img.id} src={img.image_url} alt="" loading="lazy"
                         style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6 }} />
                  ))}
                </div>
              </div>
            ))}
            {albums.length === 0 && <p style={{ color: "var(--muted)" }}>No albums yet.</p>}
          </div>
        </div>
      )}

      {tab === "birthdays" && (
        <div className="a-card">
          <p className="a-eyebrow">Birthdays in {arch?.name ?? "your archdeaconry"}</p>
          <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
            Members ordered by whose birthday comes next.
          </p>
          {birthdays.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No birthdays on record yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {birthdays.map((b) => (
                <div key={b.id}
                     style={{ display: "flex", justifyContent: "space-between", padding: "9px 10px",
                              borderRadius: 8,
                              background: isToday(b.turns_on) ? "#fdf0f6" : "transparent",
                              borderBottom: "1px solid var(--line)" }}>
                  <span>{b.full_name}{isToday(b.turns_on) && " 🎂"}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {new Date(b.turns_on).toLocaleDateString("en-NG", { day: "numeric", month: "long" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}