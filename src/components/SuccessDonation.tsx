import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";

export default function DonationReceipt() {
  const { id } = useParams();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("id", id)
        .single();
      setInfo(data);
    };
    load();
  }, [id]);

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    const canvas = await html2canvas(receiptRef.current, { scale: 3 });
    const img = canvas.toDataURL("image/png");

    const a = document.createElement("a");
    a.href = img;
    a.download = `Donation_Receipt_${info.full_name}.png`;
    a.click();
  };

  if (!info) return <div>Loading...</div>;

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1 style={{ color: "green" }}>Thank You for Donating!</h1>

      <div
        ref={receiptRef}
        style={{
          width: 350,
          margin: "20px auto",
          padding: 20,
          borderRadius: 20,
          background: "white",
          border: "5px solid #800000",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          textAlign: "center",
        }}
      >
        <img src={logo} alt="Logo" style={{ width: 90 }} />

        <h2 style={{ color: "#800000" }}>Donation Receipt</h2>

        <p><b>Name:</b> {info.full_name}</p>
        <p><b>Email:</b> {info.email}</p>
        <p><b>Amount:</b> ₦{info.amount}</p>

        {/* 🔥 BARCODE */}
        <img
          src={`https://barcodeapi.org/api/128/${id}`}
          alt="Barcode"
          style={{ width: "80%", marginTop: 10 }}
        />
      </div>

      <button
        onClick={downloadReceipt}
        style={{
          padding: "12px 24px",
          background: "#ffd700",
          border: "none",
          borderRadius: 10,
          fontWeight: "bold",
          cursor: "pointer",
          color: "#800000",
          marginTop: 10,
        }}
      >
        Download Receipt
      </button>
    </div>
  );
}
