import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";

export default function DonationReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [donor, setDonor] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadDonor = async () => {
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("id", id)
        .single();

      setDonor(data);
    };

    loadDonor();
  }, [id]);

  const handleDownload = async () => {
    if (!receiptRef.current) return;

    setDownloading(true);

    const canvas = await html2canvas(receiptRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
    });

    const link = document.createElement("a");
    link.download = `${donor.full_name}_Donation_Receipt.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    setTimeout(() => navigate("/"), 1000);
  };

  if (!donor)
    return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ padding: 30, textAlign: "center" }}>
      <h1 style={{ color: "green" }}>✔ Donation Successful!</h1>
      <p>Thank you for your generosity.</p>

      {/* RECEIPT DESIGN */}
      <div
        ref={receiptRef}
        style={{
          width: 350,
          margin: "20px auto",
          padding: 20,
          borderRadius: 20,
          background: "linear-gradient(135deg, #fff7e6, #fdebd0, #fff)",
          border: "4px solid #800000",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          textAlign: "center",
        }}
      >
        <img src={logo} alt="Logo" style={{ width: 80 }} />

        <h2 style={{ color: "#800000", marginTop: 10 }}>
          DONATION RECEIPT
        </h2>

        <hr />

        <p>
          <b>Name:</b> {donor.full_name}
        </p>
        <p>
          <b>Email:</b> {donor.email}
        </p>
        <p>
          <b>Amount:</b> ₦{donor.amount}
        </p>

        <br />

        {/* BARCODE (simple SVG) */}
        <svg width="180" height="60">
          <rect width="10" height="60" x="0" fill="#000" />
          <rect width="10" height="60" x="20" fill="#000" />
          <rect width="10" height="60" x="40" fill="#000" />
          <rect width="10" height="60" x="70" fill="#000" />
          <rect width="10" height="60" x="90" fill="#000" />
          <rect width="10" height="60" x="120" fill="#000" />
          <rect width="10" height="60" x="140" fill="#000" />
        </svg>

        <h3 style={{ marginTop: 10, color: "green" }}>
          Thank You for Donating!
        </h3>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          padding: "12px 25px",
          background: "#ffd700",
          border: "none",
          color: "#800000",
          borderRadius: 8,
          fontWeight: "bold",
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {downloading ? "Generating Receipt..." : "Download Receipt"}
      </button>
    </div>
  );
}
