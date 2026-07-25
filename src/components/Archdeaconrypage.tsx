import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import { registrationWindow, formatEventDate } from "../lib/programmeWindow";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Content.css";

/**
 * Public archdeaconry page. Shows the archdeaconry's own programmes and its
 * photo gallery — the two things its admin manages. Reached from the
 * Archdeaconry menu in the header, or directly at /archdeaconry/<slug>.
 */
export default function ArchdeaconryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [arch, setArch] = useState<any>(null);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("archdeaconries").select("*").eq("slug", slug).maybeSingle();
      setArch(a);

      if (a) {
        const [{ data: progs }, { data: pics }] = await Promise.all([
          supabase.from("programmes").select("*")
            .eq("archdeaconry_slug", slug).eq("is_published", true)
            .order("starts_at", { ascending: true }),
          supabase.from("gallery_images").select("*")
            .eq("archdeaconry_slug", slug).eq("is_published", true)
            .order("created_at", { ascending: false }).limit(12),
        ]);
        setProgrammes(progs ?? []);
        setPhotos(pics ?? []);
      }
      setLoading(false);
      window.scrollTo(0, 0);
    })();
  }, [slug]);

  if (loading) {
    return <div className="content-page"><Navbar /><p className="content-status">Loading…</p></div>;
  }

  if (!arch) {
    return (
      <div className="content-page">
        <Navbar />
        <div className="content-status">
          <h2>Archdeaconry not found</h2>
          <p><Link to="/">Back to the home page</Link></p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="content-page">
      <Navbar />

      <header className="content-head"
              style={arch.cover_url ? {
                backgroundImage: `linear-gradient(rgba(40,0,0,.55),rgba(40,0,0,.8)),url(${arch.cover_url})`,
                backgroundSize: "cover", backgroundPosition: "center",
                color: "#fff", borderBottom: "none", borderRadius: 0,
              } : undefined}>
        <p className="content-eyebrow" style={arch.cover_url ? { color: "#ffd700" } : undefined}>
          Archdeaconry
        </p>
        <h1>{arch.name}</h1>
        {arch.blurb && <p style={arch.cover_url ? { color: "rgba(255,255,255,.85)" } : undefined}>
          {arch.blurb}
        </p>}
      </header>

      <div className="content-body">
        <h2 className="post-more-title" style={{ borderTop: "none", paddingTop: 0 }}>
          Programmes
        </h2>
        {programmes.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No programmes listed yet.</p>
        ) : (
          <div className="blog-grid" style={{ marginBottom: 40 }}>
            {programmes.map((p) => {
              const w = registrationWindow(p);
              return (
                <Link key={p.id} to={`/programmes/${p.slug}`} className="blog-card">
                  {p.flyer_url && <img src={p.flyer_url} alt="" loading="lazy" />}
                  <div className="blog-card-body">
                    <p className="blog-meta">{formatEventDate(p.starts_at)}</p>
                    <h3>{p.title}</h3>
                    <p className="blog-excerpt">
                      {p.fee_naira > 0 ? naira(p.fee_naira) : "Free"} · {w.label}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {photos.length > 0 && (
          <>
            <h2 className="post-more-title">Gallery</h2>
            <div className="gallery-grid">
              {photos.map((photo) => (
                <div key={photo.id} className="gallery-tile" style={{ cursor: "default" }}>
                  <img src={photo.image_url} alt={photo.caption ?? ""} loading="lazy" />
                  {photo.caption && <span>{photo.caption}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}