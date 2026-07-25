import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { useCart } from "./Cartcontext";
import logo from "../assets/LOGO.jpeg";
import "./Navbar.css";

/**
 * One navbar for the whole site.
 *
 * HomePage, RegistrationForm and PaymentPage each carry their own copy of this
 * markup, and each of their CSS files defines `.navbar` differently. Vite
 * bundles all CSS globally, so whichever loaded last was winning — which is
 * why the header shifted slightly depending on the route. Use this everywhere
 * and delete the other three <header> blocks.
 */
export default function Navbar() {
  const { session, profile, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [archOpen, setArchOpen] = useState(false);
  const [progOpen, setProgOpen] = useState(false);
  const [archs, setArchs] = useState<{ slug: string; name: string }[]>([]);
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: p }] = await Promise.all([
        supabase.from("archdeaconries").select("slug, name")
          .order("sort_order", { ascending: true }),
        supabase.from("site_pages").select("slug, title")
          .eq("is_published", true).eq("in_menu", true)
          .order("sort_order", { ascending: true }),
      ]);
      setArchs(a ?? []);
      setPages(p ?? []);
    })();
  }, []);

  const close = () => setOpen(false);

  async function handleSignOut() {
    close();
    await signOut();
    // Send them somewhere that makes sense signed out — staying put on
    // /account or /admin would just bounce them into a guard.
    navigate("/", { replace: true });
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Account";

  return (
    <header className="site-nav">
      <Link to="/" className="site-nav-brand" onClick={close}>
        <img src={logo} alt="" />
        <span>Diocesan Youth Organization</span>
      </Link>

      <button
        className="site-nav-toggle"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "\u2715" : "\u2630"}
      </button>

      <nav className={`site-nav-links${open ? " is-open" : ""}`}>
        <div className={`site-nav-drop${progOpen ? " is-open" : ""}`}>
          <button className="site-nav-droptrigger"
                  aria-expanded={progOpen}
                  onClick={() => setProgOpen((o) => !o)}>
            Programmes ▾
          </button>
          <div className="site-nav-dropmenu">
            <NavLink to="/programmes" onClick={() => { setProgOpen(false); close(); }}>
              All programmes
            </NavLink>
            <NavLink to="/mission-voluteer" onClick={() => { setProgOpen(false); close(); }}>
              Village Missions
            </NavLink>
          </div>
        </div>
        <NavLink to="/store" onClick={close}>Store</NavLink>
        <NavLink to="/gallery" onClick={close}>Gallery</NavLink>
        <NavLink to="/blog" onClick={close}>Blog</NavLink>

        {archs.length > 0 && (
          <div className={`site-nav-drop${archOpen ? " is-open" : ""}`}>
            <button className="site-nav-droptrigger"
                    aria-expanded={archOpen}
                    onClick={() => setArchOpen((o) => !o)}>
              Archdeaconries ▾
            </button>
            <div className="site-nav-dropmenu">
              {archs.map((a) => (
                <NavLink key={a.slug} to={`/archdeaconry/${a.slug}`}
                         onClick={() => { setArchOpen(false); close(); }}>
                  {a.name}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {pages.map((pg) => (
          <NavLink key={pg.slug} to={`/p/${pg.slug}`} onClick={close}>{pg.title}</NavLink>
        ))}
        <NavLink to="/donate" onClick={close}>Give</NavLink>

        {/* Cart is a symbol, with the count riding on the corner. The word
            comes back in the mobile menu, where icons alone read as cryptic. */}
        <NavLink
          to="/cart"
          className="site-nav-cart"
          onClick={close}
          aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 3h2l2.2 10.4a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20.5 6H5.2" />
            <circle cx="9.5" cy="19" r="1.5" />
            <circle cx="16.5" cy="19" r="1.5" />
          </svg>
          <span className="site-nav-cart-word">Cart</span>
          {count > 0 && <span className="site-nav-badge">{count}</span>}
        </NavLink>

        {session ? (
          <>
            <NavLink to="/account" className="site-nav-account" onClick={close}>
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="" className="site-nav-avatar" />
              ) : (
                <span className="site-nav-avatar site-nav-avatar--blank">
                  {firstName[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span>My account</span>
            </NavLink>

            {isAdmin && <NavLink to="/admin" onClick={close}>Admin</NavLink>}

            <button type="button" className="site-nav-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <NavLink to="/login" className="site-nav-cta" onClick={close}>Sign in</NavLink>
        )}
      </nav>
    </header>
  );
}