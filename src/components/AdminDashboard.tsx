import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";

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

interface LeadershipRegistration {
  id: number;
  full_name: string;
  church: string;
  position_held: string;
  archdeaconry: string;
  position_held_in_arch: string;
  position_held_in_dio: string;
  created_at?: string;
}

/* ================= COMPONENT ================= */

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"youth" | "leadership">("youth");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [leadershipRegs, setLeadershipRegs] = useState<LeadershipRegistration[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ================= AUTH PROTECTION ================= */

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) navigate("/admin-login");
    };
    checkSession();
  }, [navigate]);

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    if (activeTab === "youth") fetchRegistrations();
    else fetchLeadershipRegistrations();
  }, [activeTab]);

  const fetchRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .order("id", { ascending: false });

    if (error) console.error(error);
    else setRegistrations(data || []);
    setLoading(false);
  };

  const fetchLeadershipRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leadership_registrations")
      .select("*")
      .order("id", { ascending: false });

    if (error) console.error(error);
    else setLeadershipRegs(data || []);
    setLoading(false);
  };

  /* ================= SEARCH ================= */

  const filteredYouth = registrations.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.archdeaconry.toLowerCase().includes(search.toLowerCase()) ||
      r.church.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLeadership = leadershipRegs.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.archdeaconry.toLowerCase().includes(search.toLowerCase()) ||
      r.church.toLowerCase().includes(search.toLowerCase())
  );

  /* ================= EXPORT ================= */

  const exportToExcel = () => {
    const data =
      activeTab === "youth" ? filteredYouth : filteredLeadership;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      activeTab === "youth"
        ? "Youth Registrations"
        : "Leadership Registrations"
    );

    XLSX.writeFile(
      wb,
      activeTab === "youth"
        ? "Youth_Convention_Registrations.xlsx"
        : "Leadership_Retreat_Registrations.xlsx"
    );
  };

  /* ================= LOGOUT ================= */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  /* ================= UI ================= */

  return (
    <div className="p-6 w-full max-w-7xl mx-auto bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          Admin Dashboard
        </h2>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-3 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setActiveTab("youth")}
          className={`px-4 py-2 rounded ${
            activeTab === "youth"
              ? "bg-blue-600 text-white"
              : "bg-gray-200"
          }`}
        >
          Youth Convention
        </button>

        <button
          onClick={() => setActiveTab("leadership")}
          className={`px-4 py-2 rounded ${
            activeTab === "leadership"
              ? "bg-purple-600 text-white"
              : "bg-gray-200"
          }`}
        >
          Leadership Retreat
        </button>
      </div>

      {/* Search & Export */}
      <div className="flex justify-between mb-4">
        <input
          type="text"
          placeholder="Search by name, archdeaconry or church..."
          className="border px-3 py-2 rounded w-2/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Export to Excel
        </button>
      </div><br/>
      <button onClick={() => navigate('/admin/vouchers')} className="bg-blue-600 text-white px-3 py-2 rounded">Voucher Generator</button>

      {/* ================= TABLES ================= */}

      {loading ? (
        <p className="text-center">Loading...</p>
      ) : activeTab === "youth" ? (
        /* ===== YOUTH TABLE ===== */
        <div className="overflow-x-auto">
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
                    {reg.photo_url ? (
                      <img
                        src={reg.photo_url}
                        className="w-10 h-10 rounded-full mx-auto"
                      />
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.gender}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.phone}</td>
                  <td className="border px-2 py-1">
                    {reg.payment_status === "paid" ? (
                      <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                        PAID
                      </span>
                    ) : (
                      <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">
                        NOT PAID
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ===== LEADERSHIP TABLE ===== */
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Full Name</th>
                <th className="border px-2 py-1">Church</th>
                <th className="border px-2 py-1">Archdeaconry</th>
                <th className="border px-2 py-1">Position (Church)</th>
                <th className="border px-2 py-1">Position (Arch)</th>
                <th className="border px-2 py-1">Position (Diocese)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeadership.map((reg) => (
                <tr key={reg.id} className="text-center">
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.position_held}</td>
                  <td className="border px-2 py-1">{reg.position_held_in_arch}</td>
                  <td className="border px-2 py-1">{reg.position_held_in_dio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
