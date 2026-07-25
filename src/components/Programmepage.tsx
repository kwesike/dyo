import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import { registrationWindow, formatEventDate } from "../lib/programmeWindow";
import { useAuth } from "./Authcontext";
import Navbar from "./Navbar";
import CountdownTimer from "./CountdownTimer";
import "./Programmes.css";
import SiteFooter from "./Sitefooter";

/** Cuts a description to a readable teaser without slicing a word in half. */
function teaser(text: string | null, max = 180) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(" ", max)) + "…";
}

export default function ProgrammesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("programmes")
        .select("*")
        .eq("is_published", true)
        .order("starts_at", { ascending: true, nullsFirst: false });
      setProgrammes(data ?? []);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const upcoming = programmes.filter(
    (p) => !p.starts_at || new Date(p.starts_at).getTime() >= now,
  );
  const past = programmes
    .filter((p) => p.starts_at && new Date(p.starts_at).getTime() < now)
    .reverse();

  /** Not signed in? Send them to sign in, and come straight back after. */
  function register(slug: string) {
    const target = `/programmes/${slug}`;
    if (!session) navigate(`/login?next=${encodeURIComponent(target)}`);
    else navigate(target);
  }

  const nextOpening = upcoming.find(
    (p) => registrationWindow(p).state === "opens_later",
  );

  return (
    <div className="pg-page">
      <Navbar />

      <header className="pg-list-head">
        <div>
          <p className="pg-eyebrow">Ibadan North Diocese</p>
          <h1>Our programmes</h1>
          <p>
            Everything the youth organization runs through the year. Registration
            for each one opens 60 days before it happens.
          </p>
        </div>
      </header>

      <div className="pg-list">
        {/* countdown to whichever registration opens next */}
        {nextOpening && (
          <div className="pg-next-open">
            <CountdownTimer
              title={`Registration for ${nextOpening.title} opens in`}
              targetDate={registrationWindow(nextOpening).opensAt!.toISOString()}
            />
          </div>
        )}

        {loading ? (
          <p className="pg-status">Loading…</p>
        ) : programmes.length === 0 ? (
          <div className="pg-status">
            <h2>Nothing published yet</h2>
            <p>Programmes appear here as soon as they're announced.</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="pg-section">Coming up</h2>
                <div className="pg-rows">
                  {upcoming.map((p) => {
                    const w = registrationWindow(p);
                    return (
                      <article key={p.id} className="pg-row">
                        {p.flyer_url && (
                          <Link to={`/programmes/${p.slug}`} className="pg-row-media">
                            <img src={p.flyer_url} alt="" loading="lazy" />
                          </Link>
                        )}

                        <div className="pg-row-body">
                          <p className="pg-row-date">{formatEventDate(p.starts_at)}</p>
                          <h3>
                            <Link to={`/programmes/${p.slug}`}>{p.title}</Link>
                          </h3>
                          {p.venue && <p className="pg-row-venue">{p.venue}</p>}
                          <p className="pg-row-desc">
                            {teaser(p.tagline || p.description)}
                          </p>
                          <p className="pg-row-fee">
                            {p.fee_naira > 0 ? naira(p.fee_naira) : "Free to attend"}
                          </p>
                        </div>

                        <div className="pg-row-action">
                          <span className={`pg-pill pg-pill--${w.state}`}>{w.label}</span>

                          {w.canRegister ? (
                            <button className="pg-button"
                                    onClick={() => register(p.slug)}>
                              Register
                            </button>
                          ) : (
                            <button className="pg-button" disabled>
                              {w.state === "opens_later" ? "Not open yet" : "Closed"}
                            </button>
                          )}

                          <Link to={`/programmes/${p.slug}`} className="pg-row-more">
                            Read the details
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="pg-section">Already held</h2>
                <div className="pg-grid">
                  {past.map((p) => (
                    <Link key={p.id} to={`/programmes/${p.slug}`} className="pg-card is-past">
                      {p.flyer_url && <img src={p.flyer_url} alt="" loading="lazy" />}
                      <div className="pg-card-body">
                        <p className="pg-card-date">
                          {p.starts_at
                            ? new Date(p.starts_at).toLocaleDateString("en-NG",
                                { day: "numeric", month: "short", year: "numeric" })
                            : ""}
                        </p>
                        <h3>{p.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}