import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";

/**
 * LEGACY DASHBOARD — the old three-table view.
 *
 * Kept only so the convention, village-mission and ignition data collected
 * before the restructure stays readable. New programmes are created in
 * /admin/programmes and their registrations live in one place.
 *
 * Two things were removed from the original:
 *
 *  1. Its own session check. It only asked "is anyone signed in", which every
 *     registered member now is — so it would have shown every registrant's
 *     name, phone, email and payment status to any member who found the URL.
 *     It's mounted inside the guarded /admin block instead, which checks role.
 *
 *  2. Its own logout button, which pointed at /admin-login. That page is gone;
 *     signing out lives in the navbar now.
 *
 * Retire this file once the old rows are migrated or exported.
 */

/* ================= INTERFACES ================= */

interface Registration {
  id: number;
  full_name: string;
  gender: string;
  date_of_birth: string;
  archdeaconry: string;
  church: string;
  occupation: string;
  educational_qualification: string;
  phone: string;
  email: string;
  address: string;
  photo_url: string;
  payment_status: "paid" | "not_paid" | null;
  created_at?: string;
}

interface MissionVoluteer {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  church: string;
  archdeaconry: string;
  reason_for_registering: string;
  created_at?: string;
}

interface IgnitionAttendance {
  id: number;
  full_name: string;
  gender: string;
  archdeaconry: string;
  church: string;
  phone: string;
  email: string;
  photo_url: string;
  payment_status: string;
  created_at?: string;
}

type Tab = "youth" | "mission" | "ignition";

/* ================= COMPONENT ================= */

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("youth");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [missionVoluteers, setMissionVoluteers] = useState<MissionVoluteer[]>([]);
  const [ignitionAttendance, setIgnitionAttendance] = useState<IgnitionAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (activeTab === "youth") void fetchRegistrations();
    else if (activeTab === "mission") void fetchMissionVoluteer();
    else void fetchIgnitionAttendance();
  }, [activeTab]);

  const fetchRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations").select("*").order("id", { ascending: false });
    if (error) console.error(error);
    else setRegistrations(data || []);
    setLoading(false);
  };

  const fetchMissionVoluteer = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("village_mission").select("*").order("id", { ascending: false });
    if (error) console.error(error);
    else setMissionVoluteers(data || []);
    setLoading(false);
  };

  const fetchIgnitionAttendance = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ignition_attendance").select("*").order("id", { ascending: false });
    if (error) console.error(error);
    else setIgnitionAttendance(data || []);
    setLoading(false);
  };

  /* ================= SEARCH ================= */

  const q = search.toLowerCase();
  const matches = (r: { full_name?: string; archdeaconry?: string; church?: string }) =>
    !q ||
    r.full_name?.toLowerCase().includes(q) ||
    r.archdeaconry?.toLowerCase().includes(q) ||
    r.church?.toLowerCase().includes(q);

  const filteredYouth = registrations.filter(matches);
  const filteredMissionVoluteers = missionVoluteers.filter(matches);
  const filteredIgnition = ignitionAttendance.filter(matches);

  /* ================= EXPORT ================= */

  const exportToExcel = () => {
    const sheets: Record<Tab, { data: any[]; name: string; file: string }> = {
      youth: { data: filteredYouth, name: "Youth Registrations",
               file: "Youth_Convention_Registrations.xlsx" },
      mission: { data: filteredMissionVoluteers, name: "Mission Volunteers",
                 file: "Mission_Volunteers.xlsx" },
      ignition: { data: filteredIgnition, name: "Family Weekend Attendance",
                  file: "Family_Weekend_Attendance.xlsx" },
    };

    const { data, name, file } = sheets[activeTab];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
    XLSX.writeFile(wb, file);
  };

  /* ================= UI ================= */

  const TabButton = ({ id, label, colour }: { id: Tab; label: string; colour: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded ${activeTab === id ? `${colour} text-white` : "bg-gray-200"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6 w-full max-w-7xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-5 text-sm">
        <strong>Archive.</strong> This is data from before the site was
        restructured. New programmes and their registrations live in{" "}
        <Link to="/admin/programmes" className="underline">Programmes</Link>.
      </div>

      <h2 className="text-2xl font-bold mb-4">Previous registrations</h2>

      <div className="flex gap-3 mb-4 flex-wrap">
        <TabButton id="youth" label="Youth Convention" colour="bg-blue-600" />
        <TabButton id="mission" label="Mission Volunteers" colour="bg-purple-600" />
        <TabButton id="ignition" label="Family Weekend Attendance" colour="bg-orange-600" />
      </div>

      <div className="flex flex-wrap gap-3 justify-between mb-5">
        <input
          type="text"
          placeholder="Search by name, archdeaconry or church…"
          className="border px-3 py-2 rounded flex-1 min-w-[220px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={exportToExcel} className="bg-green-700 text-white px-4 py-2 rounded">
          Export to Excel
        </button>
      </div>

      {loading ? (
        <p className="text-center">Loading…</p>
      ) : activeTab === "youth" ? (
        <div className="table-scroll">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Photo</th>
                <th className="border px-2 py-1">Full Name</th>
                <th className="border px-2 py-1">Gender</th>
                <th className="border px-2 py-1">Archdeaconry</th>
                <th className="border px-2 py-1">Church</th>
                <th className="border px-2 py-1">Phone</th>
                <th className="border px-2 py-1">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filteredYouth.map((reg) => (
                <tr key={reg.id} className="text-center">
                  <td className="border px-2 py-1">
                    {reg.photo_url
                      ? <img src={reg.photo_url} alt=""
                             className="w-10 h-10 rounded-full mx-auto object-cover" />
                      : "N/A"}
                  </td>
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.gender}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.phone}</td>
                  <td className="border px-2 py-1">
                    {reg.payment_status === "paid" ? (
                      <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">PAID</span>
                    ) : (
                      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">NOT PAID</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === "mission" ? (
        <div className="table-scroll">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Full Name</th>
                <th className="border px-2 py-1">Church</th>
                <th className="border px-2 py-1">Archdeaconry</th>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Phone Number</th>
                <th className="border px-2 py-1">Reason for Registration</th>
              </tr>
            </thead>
            <tbody>
              {filteredMissionVoluteers.map((reg) => (
                <tr key={reg.id} className="text-center">
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.email}</td>
                  <td className="border px-2 py-1">{reg.phone_number}</td>
                  <td className="border px-2 py-1">{reg.reason_for_registering}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Photo</th>
                <th className="border px-2 py-1">Full Name</th>
                <th className="border px-2 py-1">Gender</th>
                <th className="border px-2 py-1">Archdeaconry</th>
                <th className="border px-2 py-1">Church</th>
                <th className="border px-2 py-1">Phone</th>
                <th className="border px-2 py-1">Email</th>
              </tr>
            </thead>
            <tbody>
              {filteredIgnition.map((reg) => (
                <tr key={reg.id} className="text-center">
                  <td className="border px-2 py-1">
                    {reg.photo_url
                      ? <img src={reg.photo_url} alt=""
                             className="w-10 h-10 rounded-full mx-auto object-cover" />
                      : "N/A"}
                  </td>
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.gender}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.phone}</td>
                  <td className="border px-2 py-1">{reg.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}