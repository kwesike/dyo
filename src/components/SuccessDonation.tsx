import React from "react";
import { Link, useParams } from "react-router-dom";
import logo from "../assets/ibadan_north.png";

export default function DonationSuccess() {
  const { ref } = useParams();

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <img src={logo} alt="Logo" style={{ width: 120 }} />

      <h2>Donation Successful</h2>
      <p>Thank you for your generosity!</p>

      <div
        style={{
          marginTop: 20,
          padding: 20,
          background: "#f7f7f7",
          width: "70%",
          marginInline: "auto",
          borderRadius: 8,
        }}
      >
        <h3>Donation Receipt</h3>
        <p><strong>Reference:</strong> {ref}</p>
        <p>Your donation has been received and recorded.</p>
      </div>

      <Link to="/">
        <button style={{ marginTop: 30, padding: "12px 30px" }}>
          Back to Home
        </button>
      </Link>
    </div>
  );
}
