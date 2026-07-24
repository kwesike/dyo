import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import "./Programmes.css";

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("programmes")
        .select("*")
        .eq("is_published", true)
        .order("starts_at", { ascending: true });
      setProgrammes(data ?? []);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const upcoming = programmes.filter((p) => !p.starts_at || new Date(p.starts_at).getTime() >= now);
  const past = programmes.filter((p) => p.starts_at && new Date(p.starts_at).getTime() < now).reverse();

  const Card = ({ p, muted = false }: { p: any; muted?: boolean }) => (
    <Link to={`/programmes/${p.slug}`} className={`pg-card${muted ? " is-past" : ""}`}>
      {p.flyer_url && <img src={p.flyer_url} alt="" loading="lazy" />}
      <div className="pg-card-body">
        <p className="pg-card-date">
          {p.starts_at
            ? new Date(p.starts_at).toLocaleDateString("en-NG",
                { day: "numeric", month: "short", year: "numeric" })
            : "Date coming"}
        </p>
        <h3>{p.title}</h3>
        {p.venue && <p className="pg-card-venue">{p.venue}</p>}
        <p className="pg-card-fee">{p.fee_naira > 0 ? naira(p.fee_naira) : "Free"}</p>
      </div>
    </Link>
  );

  return (
    <div className="pg-list">
      <header className="pg-list-head">
        <p className="pg-eyebrow">What's on</p>
        <h1>Programmes</h1>
        <p>Register once with your account and your details fill themselves in.</p>
      </header>

      {loading ? (
        <p className="pg-status">Loading…</p>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <div className="pg-status">
          <h2>Nothing scheduled yet</h2>
          <p>New programmes are posted here as soon as they're announced.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="pg-section">Coming up</h2>
              <div className="pg-grid">
                {upcoming.map((p) => <Card key={p.id} p={p} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="pg-section">Already held</h2>
              <div className="pg-grid">
                {past.map((p) => <Card key={p.id} p={p} muted />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}