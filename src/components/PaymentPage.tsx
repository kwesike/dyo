// ==========================================
// FIX 1: Declare Flutterwave globally
// ==========================================
declare global {
  interface Window {
    FlutterwaveCheckout: any;
  }
}

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./PaymentPage.css";
import logo from "../assets/ibadan_north.png";

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState("");
  const [processing, setProcessing] = useState(false);
  const [onlinePaying, setOnlinePaying] = useState(false);

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

  // ==================================================
  // VERIFY VOUCHER
  // ==================================================
  async function verifyVoucher() {
    if (!voucher.trim()) return alert("Enter voucher code.");

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
        setProcessing(false);
        return;
      }

      await supabase
        .from("vouchers")
        .update({ used: true, used_by: id })
        .eq("id", voucherData.id);

      await supabase
        .from("registrations")
        .update({ payment_status: "paid" })
        .eq("id", id);

      navigate(`/success/${id}`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error.");
    }
    setProcessing(false);
  }

  // ==================================================
  // PAY ONLINE WITH FLUTTERWAVE
  // ==================================================
  async function payOnline() {
    try {
      const PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

      if (!PUBLIC_KEY) {
        alert("Flutterwave public key missing.");
        return;
      }

      setOnlinePaying(true);

      window.FlutterwaveCheckout({
        public_key: PUBLIC_KEY,
        tx_ref: "DYC-" + Date.now(),
        amount: 4000, // your online fee
        currency: "NGN",
        payment_options: "card,ussd,banktransfer",
        customer: {
          email: user.email,
          name: user.full_name,
        },
        meta: {
          registration_id: id,
        },
        customizations: {
          title: "Diocesan Youth Convention",
          description: "Convention Registration Payment",
          logo,
        },
        callback: async function (paymentData: any) {
          console.log("Payment callback:", paymentData);

          if (paymentData.status === "successful") {
            await supabase
              .from("registrations")
              .update({ payment_status: "paid" })
              .eq("id", id);

            navigate(`/success/${id}`);
          } else {
            alert("Payment not completed.");
          }
        },
        onclose: function () {
          console.log("Payment popup closed.");
          setOnlinePaying(false);
        },
      });
    } catch (error) {
      console.error(error);
      alert("Payment initialization failed.");
      setOnlinePaying(false);
    }
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
        <p><strong>Payment status:</strong> {user?.payment_status}</p>
      </div>

      {/* Voucher */}
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
      </section>

      <hr style={{ margin: "30px 0" }} />

      {/* Flutterwave */}
      <h3>Or Pay Online (Flutterwave)</h3>
      <button
        onClick={payOnline}
        disabled={onlinePaying}
        style={{
          width: "100%",
          background: "#f7a400",
          padding: "12px",
          borderRadius: 8,
          border: "none",
          color: "white",
          fontSize: 16,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {onlinePaying ? "Redirecting..." : "Pay ₦4,000 Online"}
      </button>
    </div>
  );
}
