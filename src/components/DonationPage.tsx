import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function DonationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [donor, setDonor] = useState({
    full_name: "",
    email: "",
    amount: ""
  });

  const handleChange = (e: any) => {
    setDonor({ ...donor, [e.target.name]: e.target.value });
  };

  const loadFlutterwave = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.flutterwave.com/v3.js";
      script.onload = resolve;
      document.body.appendChild(script);
    });
  };

  const initiateDonation = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    await loadFlutterwave();

    // Insert donation row first
    const { data, error } = await supabase
      .from("donations")
      .insert([
        {
          full_name: donor.full_name,
          email: donor.email,
          amount: donor.amount,
          status: "pending"
        }
      ])
      .select()
      .single();

    if (error) {
      alert("Database error");
      setLoading(false);
      return;
    }

    const donationId = data.id;

    // FLW popup
    //@ts-ignore
    FlutterwaveCheckout({
      public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
      tx_ref: `DONATION-${donationId}-${Date.now()}`,
      amount: Number(donor.amount),
      currency: "NGN",
      customer: {
        email: donor.email,
        name: donor.full_name,
      },
      callback: async (payment: any) => {
        if (payment.status === "successful") {
          await supabase
            .from("donations")
            .update({ status: "paid", flw_id: payment.transaction_id })
            .eq("id", donationId);

          navigate(`/donation-receipt/${donationId}`);
        } else {
          alert("Payment failed or cancelled.");
        }
      },
      onclose: () => {
        setLoading(false);
      },
    });
  };

  return (
    <div className="donation-container" style={{ padding: 30 }}>
      <h2 style={{ textAlign: "center" }}>Support Our Ministry</h2>
      
      <form
        onSubmit={initiateDonation}
        style={{
          maxWidth: 400,
          margin: "20px auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <input
          name="full_name"
          placeholder="Full Name"
          required
          onChange={handleChange}
        />

        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          onChange={handleChange}
        />

        <input
          name="amount"
          type="number"
          placeholder="Donation Amount (₦)"
          required
          onChange={handleChange}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            background: "#800000",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {loading ? "Processing..." : "Donate"}
        </button>
      </form>
    </div>
  );
}
