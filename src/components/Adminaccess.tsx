import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth, ADMIN_SECTIONS } from "./Authcontext";

/**
 * Access control — super admin only.
 *
 * Where the super admin decides who is what:
 *   member             - no admin access
 *   admin              - sees only the sections ticked here
 *   archdeaconry_admin - sees only their one archdeaconry's page
 *
 * The database enforces all of this (guard_role_change + RLS). This screen is
 * the friendly face on top; a member editing the request by hand still can't
 * grant themselves anything.
 */

interface Person {
  id: string;
  full_name: string | null;
  email: string | null;
  photo_url: string | null;
  role: "member" | "admin" | "super_admin" | "archdeaconry_admin";
  managed_archdeaconry: string | null;
  admin_sections: string[] | null;
}

const SECTION_LABELS: Record<string, string> = {
  programmes: "Programmes", registrations: "Registrations", store: "Store items",
  orders: "Orders", donations: "Donations", receipts: "Receipts", draws: "Lucky draws", vouchers: "Vouchers", tags: "Tags", announcements: "Flyers & updates",
  gallery: "Gallery", blog: "Blog", carousel: "Slideshow", leadership: "Leadership",
  archdeaconries: "All archdeaconries", pages: "Custom pages", members: "Members", birthdays: "Birthdays", tournaments: "Tournaments",
  overview: "Overview (dashboard)",
  audit: "Audit trail",
};

export default function AdminAccess() {
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [archdeaconries, setArchdeaconries] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: archs } = await supabase
      .from("archdeaconries").select("slug, name").order("sort_order");
    setArchdeaconries(archs ?? []);

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, photo_url, role, managed_archdeaconry, admin_sections")
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    setPeople((data as Person[]) ?? []);
  }

  const shown = useMemo(() => {
    const q = search.toLowerCase();
    return people.filter((p) =>
      !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }, [people, search]);

  async function removeUser(target: Person) {
    if (target.id === me?.id) {
      setMessage("You can't delete your own account.");
      return;
    }
    if (target.role === "super_admin") {
      setMessage("Remove their super-admin role before deleting.");
      return;
    }
    if (!confirm(
      `Permanently delete ${target.full_name ?? target.email}? ` +
      `This removes their account and cannot be undone.`
    )) return;

    setSaving(true);
    setMessage("");

    // Deletion runs server-side — the browser can't touch auth.users.
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ userId: target.id }),
      },
    );

    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setMessage(body.error ?? "Couldn't delete that user.");
      return;
    }

    setMessage(`${target.full_name ?? target.email} was removed.`);
    setEditing(null);
    void load();
  }

  async function persist(target: Person) {
    setSaving(true);
    setMessage("");

    const patch = {
      role: target.role,
      managed_archdeaconry: target.role === "archdeaconry_admin" ? target.managed_archdeaconry : null,
      admin_sections: (target.role === "admin" || target.role === "archdeaconry_admin")
        ? (target.admin_sections ?? []) : [],
    };

    const { error } = await supabase.from("profiles").update(patch).eq("id", target.id);
    setSaving(false);

    if (error) {
      setMessage(error.message.includes("super admin")
        ? "Only a super admin can do that."
        : "Couldn't save that change.");
      return;
    }

    setEditing(null);
    setMessage(`${target.full_name ?? "That person"}'s access updated.`);
    void load();
  }

  const staff = shown.filter((p) => p.role !== "member");
  const members = shown.filter((p) => p.role === "member");

  const Badge = ({ p }: { p: Person }) => {
    if (p.role === "super_admin")
      return <span className="a-pill" style={{ background: "#efe3fb", color: "#5b2a86" }}>Super admin</span>;
    if (p.role === "archdeaconry_admin")
      return <span className="a-pill" style={{ background: "#e3eefb", color: "#1e4b86" }}>
        {archdeaconries.find((a) => a.slug === p.managed_archdeaconry)?.name ?? p.managed_archdeaconry ?? "Archdeaconry"} admin
      </span>;
    if (p.role === "admin")
      return <span className="a-pill a-pill--live">
        Admin · {(p.admin_sections ?? []).length} section{(p.admin_sections ?? []).length === 1 ? "" : "s"}
      </span>;
    return <span className="a-pill a-pill--draft">Member</span>;
  };

  return (
    <>
      <div className="a-head">
        <div>
          <p className="a-eyebrow">People</p>
          <h1>Access &amp; roles</h1>
          <p>Decide who helps run the site and exactly what each person can touch.</p>
        </div>
      </div>

      <input className="a-search" placeholder="Search by name or email"
             value={search} onChange={(e) => setSearch(e.target.value)}
             style={{ width: "100%", marginBottom: 20 }} />

      {message && (
        <p style={{ borderLeft: "3px solid var(--maroon)", background: "#faf0ee",
                    padding: "10px 12px", marginBottom: 16, fontSize: "0.9rem" }}>
          {message}
        </p>
      )}

      <h2 className="a-section-title">Team ({staff.length})</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {staff.map((p) => (
          <PersonRow key={p.id} p={p} me={me?.id} onEdit={() => setEditing({ ...p })} Badge={Badge} />
        ))}
      </div>

      <h2 className="a-section-title">Members ({members.length})</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: -6, marginBottom: 14 }}>
        Give someone a role to move them up here into the team.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {members.slice(0, 40).map((p) => (
          <PersonRow key={p.id} p={p} me={me?.id} onEdit={() => setEditing({ ...p })} Badge={Badge} />
        ))}
        {members.length > 40 && (
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Showing 40 of {members.length}. Search to find a specific person.
          </p>
        )}
      </div>

      {editing && (
        <div className="a-modal-scrim" onClick={() => setEditing(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: "1.3rem", margin: "0 0 4px" }}>
              {editing.full_name ?? editing.email}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0 0 18px" }}>
              {editing.email}
            </p>

            {editing.id === me?.id ? (
              <p className="a-pill a-pill--warn">You can't change your own access.</p>
            ) : editing.role === "super_admin" ? (
              <p className="a-pill a-pill--warn">
                Super admins can only be changed directly in the database, on purpose.
              </p>
            ) : (
              <>
                <label className="a-field-label">Role</label>
                <div className="a-role-choices">
                  {([
                    ["member", "Member", "No admin access"],
                    ["admin", "Admin", "Sees only the sections you tick"],
                    ["archdeaconry_admin", "Archdeaconry admin", "Manages one archdeaconry's page"],
                  ] as const).map(([role, label, note]) => (
                    <button key={role}
                            className={`a-role-choice${editing.role === role ? " is-active" : ""}`}
                            onClick={() => setEditing({ ...editing, role })}>
                      <strong>{label}</strong>
                      <span>{note}</span>
                    </button>
                  ))}
                </div>

                {editing.role === "archdeaconry_admin" && (
                  <>
                    <label className="a-field-label">Which archdeaconry?</label>
                    <select value={editing.managed_archdeaconry ?? ""}
                            onChange={(e) => setEditing({ ...editing, managed_archdeaconry: e.target.value })}
                            style={{ width: "100%" }}>
                      <option value="">Choose one</option>
                      {archdeaconries.map((a) => (
                        <option key={a.slug} value={a.slug}>{a.name}</option>
                      ))}
                    </select>

                    <label className="a-field-label" style={{ marginTop: 16 }}>
                      Extra access <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional — beyond their archdeaconry)</span>
                    </label>
                    <div className="a-section-grid">
                      {ADMIN_SECTIONS.map((section) => {
                        const on = (editing.admin_sections ?? []).includes(section);
                        return (
                          <label key={section} className={`a-section-toggle${on ? " is-on" : ""}`}>
                            <input type="checkbox" checked={on}
                              onChange={(e) => {
                                const set = new Set(editing.admin_sections ?? []);
                                e.target.checked ? set.add(section) : set.delete(section);
                                setEditing({ ...editing, admin_sections: [...set] });
                              }} />
                            {SECTION_LABELS[section] ?? section}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                {editing.role === "admin" && (
                  <>
                    <label className="a-field-label">What can they open?</label>
                    <div className="a-section-grid">
                      {ADMIN_SECTIONS.map((section) => {
                        const on = (editing.admin_sections ?? []).includes(section);
                        return (
                          <label key={section} className={`a-section-toggle${on ? " is-on" : ""}`}>
                            <input type="checkbox" checked={on}
                              onChange={(e) => {
                                const set = new Set(editing.admin_sections ?? []);
                                e.target.checked ? set.add(section) : set.delete(section);
                                setEditing({ ...editing, admin_sections: [...set] });
                              }} />
                            {SECTION_LABELS[section] ?? section}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button className="a-btn"
                          disabled={saving ||
                            (editing.role === "archdeaconry_admin" && !editing.managed_archdeaconry)}
                          onClick={() => persist(editing)}>
                    {saving ? "Saving…" : "Save access"}
                  </button>
                  <button className="a-btn a-btn--quiet" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  {editing.id !== me?.id && (
                    <button className="a-btn a-btn--danger"
                            style={{ marginLeft: "auto" }}
                            disabled={saving}
                            onClick={() => removeUser(editing)}>
                      Delete user
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PersonRow({ p, me, onEdit, Badge }: {
  p: Person; me?: string; onEdit: () => void; Badge: (props: { p: Person }) => ReactNode;
}) {
  return (
    <div className="a-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
      {p.photo_url
        ? <img src={p.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
        : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e8dede",
                        display: "grid", placeItems: "center", fontWeight: 700, color: "#9a8888" }}>
            {p.full_name?.[0] ?? "?"}
          </div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block" }}>
          {p.full_name ?? "No name yet"}
          {p.id === me && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · you</span>}
        </strong>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{p.email}</span>
      </div>
      <Badge p={p} />
      <button className="a-btn a-btn--ghost" onClick={onEdit}>Manage</button>
    </div>
  );
}