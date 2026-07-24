import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { ARCHDEACONRIES } from "../lib/Constants";

type Role = "member" | "admin" | "super_admin";

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  church: string | null;
  archdeaconry: string | null;
  photo_url: string | null;
  role: Role;
  created_at: string;
}

const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  admin: "Admin",
  super_admin: "Super admin",
};

export default function AdminMembers() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [archdeaconry, setArchdeaconry] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === "super_admin";

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, church, archdeaconry, photo_url, role, created_at")
      .order("created_at", { ascending: false });

    if (error) setMessage("Couldn't load members.");
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => roleFilter === "all" || m.role === roleFilter)
      .filter((m) => !archdeaconry || m.archdeaconry === archdeaconry)
      .filter((m) =>
        !q ||
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.church?.toLowerCase().includes(q) ||
        m.phone?.includes(q));
  }, [members, search, archdeaconry, roleFilter]);

  const adminCount = members.filter(
    (m) => m.role === "admin" || m.role === "super_admin",
  ).length;

  async function changeRole(member: Member, role: Role) {
    setMessage("");

    // Guard rails. The database enforces who may change roles at all; these
    // stop an admin locking everyone (including themselves) out by accident.
    if (member.id === profile?.id) {
      setConfirming(null);
      return setMessage("You can't change your own role — ask another super admin.");
    }
    if (member.role === "super_admin" && !isSuperAdmin) {
      setConfirming(null);
      return setMessage("Only a super admin can change another super admin.");
    }

    const { error } = await supabase
      .from("profiles").update({ role }).eq("id", member.id);

    setConfirming(null);

    if (error) {
      setMessage(
        error.message.includes("Only an admin")
          ? "The database refused that change — your account may have lost admin access."
          : "Couldn't update that role.",
      );
      return;
    }

    setMessage(`${member.full_name ?? "That member"} is now ${ROLE_LABEL[role].toLowerCase()}.`);
    void load();
  }

  function exportMembers() {
    const rows = shown.map((m) => ({
      Name: m.full_name ?? "",
      Email: m.email ?? "",
      Phone: m.phone ?? "",
      Church: m.church ?? "",
      Archdeaconry: m.archdeaconry ?? "",
      Role: ROLE_LABEL[m.role],
      Joined: new Date(m.created_at).toLocaleDateString("en-NG"),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Members");
    XLSX.writeFile(wb, `members-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-end gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-gray-600 text-sm">
            {members.length} accounts · {adminCount} with admin access
          </p>
        </div>
        <button onClick={exportMembers}
                className="bg-green-700 text-white px-4 py-2 rounded">
          Export to Excel
        </button>
      </div>

      {!isSuperAdmin && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded p-3 mb-4">
          You can grant and revoke ordinary admin access. Only a super admin can
          change another super admin.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <input className="border rounded px-3 py-2 md:col-span-1"
               placeholder="Search name, email, church or phone"
               value={search} onChange={(e) => setSearch(e.target.value)} />

        <select className="border rounded px-3 py-2"
                value={archdeaconry} onChange={(e) => setArchdeaconry(e.target.value)}>
          <option value="">Every archdeaconry</option>
          {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
        </select>

        <select className="border rounded px-3 py-2"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
          <option value="all">Every role</option>
          <option value="member">Members only</option>
          <option value="admin">Admins</option>
          <option value="super_admin">Super admins</option>
        </select>
      </div>

      {message && (
        <p className="text-sm border-l-4 border-[#800000] bg-red-50 px-3 py-2 mb-4">
          {message}
        </p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-gray-500">Nobody matches that.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1"></th>
                <th className="border px-2 py-1 text-left">Name</th>
                <th className="border px-2 py-1 text-left">Contact</th>
                <th className="border px-2 py-1 text-left">Church</th>
                <th className="border px-2 py-1">Role</th>
                <th className="border px-2 py-1">Access</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const isSelf = m.id === profile?.id;
                const locked = m.role === "super_admin" && !isSuperAdmin;

                return (
                  <tr key={m.id}>
                    <td className="border px-2 py-1">
                      {m.photo_url
                        ? <img src={m.photo_url} alt=""
                               className="w-9 h-9 rounded-full object-cover mx-auto" />
                        : <div className="w-9 h-9 rounded-full bg-gray-200 grid place-items-center mx-auto text-xs">
                            {m.full_name?.[0] ?? "?"}
                          </div>}
                    </td>
                    <td className="border px-2 py-1">
                      {m.full_name ?? <span className="text-gray-400">No name yet</span>}
                      {isSelf && <span className="text-xs text-gray-500"> (you)</span>}
                    </td>
                    <td className="border px-2 py-1">
                      <div>{m.email}</div>
                      <div className="text-gray-500">{m.phone}</div>
                    </td>
                    <td className="border px-2 py-1">
                      <div>{m.church}</div>
                      <div className="text-gray-500">{m.archdeaconry}</div>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${
                        m.role === "super_admin" ? "bg-purple-100 text-purple-800"
                          : m.role === "admin" ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {isSelf || locked ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : confirming === m.id ? (
                        <span className="flex gap-2 justify-center items-center">
                          <span className="text-xs">Sure?</span>
                          <button
                            onClick={() =>
                              changeRole(m, m.role === "member" ? "admin" : "member")}
                            className="bg-[#800000] text-white px-2 py-1 rounded text-xs">
                            Yes
                          </button>
                          <button onClick={() => setConfirming(null)}
                                  className="underline text-xs">
                            No
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => { setMessage(""); setConfirming(m.id); }}
                                className="underline text-xs">
                          {m.role === "member" ? "Make admin" : "Remove admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}