import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Content.css";

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  album: string;
  taken_on: string | null;
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [album, setAlbum] = useState("All");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("gallery_images")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      setPhotos((data as Photo[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const albums = useMemo(
    () => ["All", ...Array.from(new Set(photos.map((p) => p.album))).sort()],
    [photos],
  );

  const shown = album === "All" ? photos : photos.filter((p) => p.album === album);

  // Arrow keys and Escape in the lightbox — people expect them.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => ((i ?? 0) + 1) % shown.length);
      if (e.key === "ArrowLeft") setLightbox((i) => ((i ?? 0) - 1 + shown.length) % shown.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, shown.length]);

  return (
    <div className="content-page">
      <Navbar />

      <header className="content-head">
        <p className="content-eyebrow">Ibadan North Diocese</p>
        <h1>Gallery</h1>
        <p>Moments from conventions, missions and everything in between.</p>
      </header>

      <div className="content-body">
        {loading ? (
          <p className="content-status">Loading…</p>
        ) : photos.length === 0 ? (
          <div className="content-status">
            <h2>No photographs yet</h2>
            <p>Pictures from our programmes will appear here.</p>
          </div>
        ) : (
          <>
            {albums.length > 2 && (
              <nav className="content-filters">
                {albums.map((a) => (
                  <button key={a} className={a === album ? "is-active" : ""}
                          onClick={() => setAlbum(a)}>
                    {a}
                  </button>
                ))}
              </nav>
            )}

            <div className="gallery-grid">
              {shown.map((photo, i) => (
                <button key={photo.id} className="gallery-tile"
                        onClick={() => setLightbox(i)}
                        aria-label={photo.caption ?? "Open photograph"}>
                  <img src={photo.image_url} alt={photo.caption ?? ""} loading="lazy" />
                  {photo.caption && <span>{photo.caption}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {lightbox !== null && shown[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button className="lightbox-close" aria-label="Close">&#10005;</button>

          <button className="lightbox-arrow left" aria-label="Previous"
                  onClick={(e) => { e.stopPropagation();
                    setLightbox((i) => ((i ?? 0) - 1 + shown.length) % shown.length); }}>
            &#10094;
          </button>

          <figure onClick={(e) => e.stopPropagation()}>
            <img src={shown[lightbox].image_url} alt={shown[lightbox].caption ?? ""} />
            {shown[lightbox].caption && <figcaption>{shown[lightbox].caption}</figcaption>}
          </figure>

          <button className="lightbox-arrow right" aria-label="Next"
                  onClick={(e) => { e.stopPropagation();
                    setLightbox((i) => ((i ?? 0) + 1) % shown.length); }}>
            &#10095;
          </button>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}