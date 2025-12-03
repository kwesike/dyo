import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ✅ Protect route
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/admin-login");
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    fetchRegistrations();
  }, []);

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

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(registrations);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, "DYC_Registrations.xlsx");
  };

  // ✅ Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  const filteredData = registrations.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.archdeaconry.toLowerCase().includes(search.toLowerCase()) ||
      r.church.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 w-full max-w-6xl mx-auto bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-center">
          Admin Dashboard – Youth Convention Registrations
        </h2>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>

      <div className="flex justify-between mb-4">
        <input
          type="text"
          placeholder="Search by name, archdeaconry, or church..."
          className="border px-3 py-2 rounded w-2/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Export to Excel
        </button>
      </div><br/>
      <button onClick={() => navigate('/admin/vouchers')} className="bg-blue-600 text-white px-3 py-2 rounded">Voucher Generator</button>

      {loading ? (
        <p className="text-center text-gray-600">Loading registrations...</p>
      ) : filteredData.length === 0 ? (
        <p className="text-center text-gray-600">No registrations found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Photo</th>
                <th className="border px-2 py-1">Full Name</th>
                <th className="border px-2 py-1">Gender</th>
                <th className="border px-2 py-1">Date of Birth</th>
                <th className="border px-2 py-1">Archdeaconry</th>
                <th className="border px-2 py-1">Church</th>
                <th className="border px-2 py-1">Occupation</th>
                <th className="border px-2 py-1">Qualification</th>
                <th className="border px-2 py-1">Phone</th>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Address</th>
                <th className="border px-2 py-1">Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((reg) => (
                <tr key={reg.id} className="text-center">
                  <td className="border px-2 py-1">
                    {reg.photo_url ? (
                      <img
                        src={reg.photo_url}
                        alt={reg.full_name}
                        className="w-10 h-10 object-cover rounded-full mx-auto"
                      />
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="border px-2 py-1">{reg.full_name}</td>
                  <td className="border px-2 py-1">{reg.gender}</td>
                  <td className="border px-2 py-1">{reg.date_of_birth}</td>
                  <td className="border px-2 py-1">{reg.archdeaconry}</td>
                  <td className="border px-2 py-1">{reg.church}</td>
                  <td className="border px-2 py-1">{reg.occupation}</td>
                  <td className="border px-2 py-1">{reg.educational_qualification}</td>
                  <td className="border px-2 py-1">{reg.phone}</td>
                  <td className="border px-2 py-1">{reg.email}</td>
                  <td className="border px-2 py-1">{reg.address}</td>
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
      )}
    </div>
  );
}
