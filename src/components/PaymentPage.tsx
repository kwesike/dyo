import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./PaymentPage.css";
import logo from "../assets/ibadan_north.png";
import { Link } from "react-router-dom";



export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRegistration();
  }, []);

  async function loadRegistration() {
    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert("Unable to load registration.");
      return setLoading(false);
    }

    setUser(data);
    setLoading(false);
  }

  // ======================
  // VERIFY VOUCHER
  // ======================
  async function verifyVoucher() {
    if (!voucher.trim()) {
      alert("Enter voucher code.");
      return;
    }

    setProcessing(true);

    try {
      const { data: voucherData, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", voucher.trim().toUpperCase())
        .eq("used", false)
        .single();

      if (error || !voucherData) {
        alert("Invalid or already used voucher code.");
        return setProcessing(false);
      }

      await supabase
        .from("vouchers")
        .update({ used: true, used_by: id })
        .eq("id", voucherData.id);

      await supabase
        .from("registrations")
        .update({ payment_status: "paid" })
        .eq("id", id);

      alert("Voucher accepted! Payment completed.");
      navigate(`/success/${id}`);
    } catch (err) {
      alert("Unexpected error.");
      console.error(err);
    }

    setProcessing(false);
  }


  if (loading) return <p>Loading...</p>;

  return (
  
    <div className="payment-container">
          <div style={{ maxWidth: 640, margin: "5px auto", padding: 2 }}>
       <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="logo" />
          <h1>Diocesan Youth Organization</h1>
        </div>
        <nav className="navbar-links">
          <Link to="/HomePage">Home</Link>
        </nav>
      </header>
      </div>
      <div className="payment-card">
      <h2>Complete Payment for {user?.full_name}</h2>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Payment status:</strong> {user?.payment_status}</p></div>

      <div>
      <section style={{ marginTop: 20 }}>
        <h3>Use Voucher</h3>
        <input
          type="text"
          value={voucher}
          onChange={(e) => setVoucher(e.target.value)}
          placeholder="Enter voucher code"
          style={{ width: "100%", padding: 10 }}
        />
        <button
          onClick={verifyVoucher}
          disabled={processing}
          style={{ marginTop: 10 }}
        >
          {processing ? "Processing..." : "Verify Voucher"}
        </button>
      </section></div>

      <hr style={{ margin: "30px 0" }} />

   
    </div>
  );
}
