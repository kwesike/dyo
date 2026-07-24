import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { naira } from "../lib/Payments";
import { registrationWindow, formatEventDate } from "../lib/programmeWindow";

/**
 * The landing page of the admin console.
 *
 * Deliberately not a chart wall. The youth office wants to know three things
 * when they sit down: what needs doing, what's coming, and how the money is
 * going. Everything here answers one of those.
 */

export default function AdminHome() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nextProgramme, setNextProgramme] = useState<any>(null);
  const [stats, setStats] = useState({
    registered: 0, unpaid: 0, toPack: 0,
    programmeRevenue: 0, storeRevenue: 0, members: 0, drafts: 0,
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    const nowIso = new Date().toISOString();
    const head = { count: "exact" as const, head: true };

    const [
      { data: upcoming },
      { data: regs },
      { data: orders },
      members,
      drafts,
    ] = await Promise.all([
      supabase.from("programmes").select("*")
        .eq("is_published", true).gte("starts_at", nowIso)
        .order("starts_at", { ascending: true }).limit(1),
      supabase.from("programme_registrations")
        .select("payment_status, amount_naira, programme_id"),
      supabase.from("orders").select("status, fulfilment, total_naira"),
      supabase.from("profiles").select("id", head),
      supabase.from("programmes").select("id", head).eq("is_published", false),
    ]);

    const programme = upcoming?.[0] ?? null;
    setNextProgramme(programme);

    const forThis = (regs ?? []).filter(
      (r) => !programme || r.programme_id === programme.id,
    );

    setStats({
      registered: forThis.length,
      unpaid: (regs ?? []).filter((r) => r.payment_status === "pending").length,
      toPack: (orders ?? []).filter(
        (o) => o.status === "paid" && o.fulfilment === "unfulfilled").length,
      programmeRevenue: (regs ?? [])
        .filter((r) => r.payment_status === "paid")
        .reduce((s, r) => s + (r.amount_naira ?? 0), 0),
      storeRevenue: (orders ?? [])
        .filter((o) => o.status === "paid")
        .reduce((s, o) => s + (o.total_naira ?? 0), 0),
      members: members.count ?? 0,
      drafts: drafts.count ?? 0,
    });

    setLoading(false);
  }

  const window_ = nextProgramme ? registrationWindow(nextProgramme) : null;
  const firstName = profile?.full_name?.split(" ")[0];

  const needsAttention = [
    stats.unpaid > 0 && {
      label: `${stats.unpaid} registration${stats.unpaid === 1 ? "" : "s"} awaiting payment`,
      to: "/admin/registrations",
      action: "Review",
    },
    stats.toPack > 0 && {
      label: `${stats.toPack} paid order${stats.toPack === 1 ? "" : "s"} not packed`,
      to: "/admin/orders",
      action: "Pack them",
    },
    stats.drafts > 0 && {
      label: `${stats.drafts} programme${stats.drafts === 1 ? "" : "s"} still in draft`,
      to: "/admin/programmes",
      action: "Publish",
    },
  ].filter(Boolean) as { label: string; to: string; action: string }[];

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">Youth office</p>
          <h1>{firstName ? `Good to see you, ${firstName}` : "Overview"}</h1>
          <p>Everything the organization is running, in one place.</p>
        </div>
        <Link to="/admin/programmes" className="a-btn">New programme</Link>
      </div>

      {/* What needs doing */}
      {needsAttention.length > 0 && (
        <div className="a-card" style={{ borderLeft: "3px solid var(--gold-aged)" }}>
          <p className="a-eyebrow">Needs attention</p>
          {needsAttention.map((item) => (
            <div key={item.to} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 14, padding: "9px 0", borderBottom: "1px solid var(--line)",
            }}>
              <span>{item.label}</span>
              <Link to={item.to} className="a-btn a-btn--ghost">{item.action} →</Link>
            </div>
          ))}
        </div>
      )}

      {/* The next programme */}
      <h2 className="a-section-title">Next up</h2>
      {nextProgramme ? (
        <div className="a-card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20,
                        justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="a-eyebrow">{formatEventDate(nextProgramme.starts_at)}</p>
              <h3 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: "1.4rem",
                           margin: "0 0 6px", fontWeight: 600 }}>
                {nextProgramme.title}
              </h3>
              {nextProgramme.venue && (
                <p style={{ color: "var(--muted)", margin: 0 }}>{nextProgramme.venue}</p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={`a-pill a-pill--${
                window_?.state === "open" ? "live"
                  : window_?.state === "opens_later" ? "warn" : "draft"}`}>
                {window_?.label}
              </span>
              <p style={{ margin: "10px 0 0", fontVariantNumeric: "tabular-nums",
                          fontSize: "1.6rem", fontFamily: "Newsreader, Georgia, serif" }}>
                {stats.registered}
              </p>
              <small style={{ color: "var(--faint)" }}>registered</small>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to={`/admin/programmes/${nextProgramme.id}/registrations`}
                  className="a-btn a-btn--quiet">
              See who's registered
            </Link>
            <Link to={`/programmes/${nextProgramme.slug}`} className="a-btn a-btn--quiet">
              View the public page
            </Link>
          </div>
        </div>
      ) : (
        <div className="a-empty">
          <h3>Nothing scheduled</h3>
          <p>Create a programme and it appears on the site for members to register.</p>
          <Link to="/admin/programmes" className="a-btn">Create a programme</Link>
        </div>
      )}

      {/* The numbers */}
      <h2 className="a-section-title">Where things stand</h2>
      <dl className="a-figures">
        <div className="a-figure">
          <dt>Members</dt>
          <dd>{stats.members}</dd>
          <small>accounts created</small>
        </div>
        <div className="a-figure">
          <dt>Programme fees</dt>
          <dd>{naira(stats.programmeRevenue)}</dd>
          <small>confirmed payments</small>
        </div>
        <div className="a-figure">
          <dt>Store sales</dt>
          <dd>{naira(stats.storeRevenue)}</dd>
          <small>paid orders</small>
        </div>
        <div className="a-figure">
          <dt>Awaiting payment</dt>
          <dd>{stats.unpaid}</dd>
          <small>places held, not paid</small>
        </div>
      </dl>

      {/* Shortcuts */}
      <h2 className="a-section-title">Jump to</h2>
      <div style={{ display: "grid", gap: 12,
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {[
          { to: "/admin/leadership", title: "Leadership",
            note: "Clergy and executives shown on the home page" },
          { to: "/admin/announcements", title: "Flyers & updates",
            note: "Publish a popup or a news item" },
          { to: "/admin/products", title: "Store items",
            note: "Polos, wristbands, stock levels" },
          { to: "/admin/members", title: "Members",
            note: "Search accounts, grant admin access" },
        ].map((card) => (
          <Link key={card.to} to={card.to} className="a-card"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <strong style={{ display: "block", fontFamily: "Newsreader, Georgia, serif",
                             fontSize: "1.05rem" }}>
              {card.title}
            </strong>
            <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{card.note}</span>
          </Link>
        ))}
      </div>
    </>
  );
}