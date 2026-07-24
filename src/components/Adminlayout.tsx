import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import logo from "../assets/LOGO.jpeg";
import "./Admin.css";

/**
 * The admin shell.
 *
 * Counts in the nav are deliberate: a number only appears when something
 * actually needs doing — unpaid registrations, orders waiting to be packed,
 * unpublished drafts. A badge that's always there stops meaning anything.
 */

interface Counts {
  drafts: number;
  unpaid: number;
  toPack: number;
  leaders: number;
}

const Icon = ({ d }: { d: string }) => (
  <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICONS = {
  overview: "M3 12h6v9H3zM15 3h6v18h-6zM9 8h6v13H9z",
  programmes: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  store: "M3 3h2l2.2 10.4a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20.5 6H5.2M9.5 19.5h.01M16.5 19.5h.01",
  orders: "M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM14 2v6h6M9 14h6M9 18h4",
  flyers: "M4 3h16v12H4zM8 21h8M12 15v6",
  leadership: "M12 3a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 12 3zM5 21v-1.6A4.4 4.4 0 0 1 9.4 15h5.2a4.4 4.4 0 0 1 4.4 4.4V21",
  members: "M9 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1M17 11h5M19.5 8.5v5",
  vouchers: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8zM13 6v12",
  tags: "M3 3h7l11 11-7 7L3 10V3zM7.5 7.5h.01",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
};

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({
    drafts: 0, unpaid: 0, toPack: 0, leaders: 0,
  });

  // Close the drawer whenever the route changes, or it stays open over
  // the page you just navigated to.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => { void loadCounts(); }, [location.pathname]);

  async function loadCounts() {
    const head = { count: "exact" as const, head: true };

    const [drafts, unpaid, toPack, leaders] = await Promise.all([
      supabase.from("programmes").select("id", head).eq("is_published", false),
      supabase.from("programme_registrations").select("id", head).eq("payment_status", "pending"),
      supabase.from("orders").select("id", head).eq("status", "paid").eq("fulfilment", "unfulfilled"),
      supabase.from("leadership").select("id", head).eq("is_active", true),
    ]);

    setCounts({
      drafts: drafts.count ?? 0,
      unpaid: unpaid.count ?? 0,
      toPack: toPack.count ?? 0,
      leaders: leaders.count ?? 0,
    });
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  const Item = ({ to, icon, label, count, alert = false }: {
    to: string; icon: string; label: string; count?: number; alert?: boolean;
  }) => (
    <NavLink to={to} end={to === "/admin"}>
      <Icon d={icon} />
      <span className="admin-nav-label">{label}</span>
      {count ? (
        <span className={`admin-nav-count${alert ? " admin-nav-count--alert" : ""}`}>
          {count}
        </span>
      ) : null}
    </NavLink>
  );

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <button onClick={() => setOpen((o) => !o)}
                aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? "\u2715" : "\u2630"}
        </button>
        <span>Youth office</span>
      </div>

      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}

      <aside className={`admin-spine${open ? " is-open" : ""}`}>
        <div className="admin-spine-head">
          <img src={logo} alt="" />
          <div>
            <p className="admin-spine-title">Youth office</p>
            <p className="admin-spine-sub">Ibadan North</p>
          </div>
        </div>

        <nav className="admin-nav">
          <Item to="/admin" icon={ICONS.overview} label="Overview" />

          <p className="admin-nav-group">Programmes</p>
          <Item to="/admin/programmes" icon={ICONS.programmes} label="Programmes"
                count={counts.drafts} />
          <Item to="/admin/registrations" icon={ICONS.members} label="Registrations"
                count={counts.unpaid} alert />
          <Item to="/admin/vouchers" icon={ICONS.vouchers} label="Vouchers" />
          <Item to="/admin/tags" icon={ICONS.tags} label="Tags" />

          <p className="admin-nav-group">Store</p>
          <Item to="/admin/products" icon={ICONS.store} label="Items" />
          <Item to="/admin/orders" icon={ICONS.orders} label="Orders"
                count={counts.toPack} alert />

          <p className="admin-nav-group">The site</p>
          <Item to="/admin/announcements" icon={ICONS.flyers} label="Flyers & updates" />
          <Item to="/admin/leadership" icon={ICONS.leadership} label="Leadership"
                count={counts.leaders} />

          <p className="admin-nav-group">People</p>
          <Item to="/admin/members" icon={ICONS.members} label="Members" />

          <p className="admin-nav-group">Archive</p>
          <Item to="/admin/legacy" icon={ICONS.archive} label="Old records" />
        </nav>

        <div className="admin-spine-foot">
          <p>{profile?.full_name ?? "Signed in"}</p>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            View the site
          </a>
          <a href="#signout" onClick={(e) => { e.preventDefault(); void handleSignOut(); }}>
            Sign out
          </a>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}