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

  // ======================
// PAY WITH FLUTTERWAVE
// ======================
async function payWithFlutterwave() {
  if (!user) return;

  setProcessing(true);

  const response = await fetch(
    "https://toqkuvrbywyyqyicjehc.functions.supabase.co/flutterwave-pay",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // VERY IMPORTANT
      },
      body: JSON.stringify({
        full_name: user.full_name,
        email: user.email,
        amount: 4000,
        regId: id,
      }),
    }
  );

  const data = await response.json();
  setProcessing(false);

  if (!data?.data?.link) {
    alert("Unable to initialize payment.");
    return;
  }

  // Redirect to Flutterwave checkout
  window.location.href = data.data.link;
}



  if (loading) return <p>Loading...</p>;

  return (
  
    
    <div style={{ maxWidth: 640, margin: "20px auto", padding: 20 }}>
      <div style={{ maxWidth: 640, margin: "5px auto", padding: 5 }}>
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


      <section>
        <h3>Or Pay Online</h3>
        <p>Pay ₦4,000 via FlutterWave (securely handled)</p>
        <button onClick={payWithFlutterwave} disabled={processing}>
  Pay ₦4,000 Online
</button>

      </section>
    </div>
  );
}
