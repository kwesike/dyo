import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";

export default function PaymentComplete() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const txRef = params.get("tx_ref"); // example: reg-14-17387562
    const regId = txRef?.split("-")[1] ?? null;

    const transactionId = params.get("transaction_id");

    if (!transactionId) {
      alert("Payment verification failed. No transaction ID.");
      navigate("/");
      return;
    }

    verifyPayment(transactionId, regId);
  }, []);

  async function verifyPayment(transactionId: string, regId: string | null) {
    try {
      // ⭐ CALL YOUR SUPABASE EDGE FUNCTION (NO CORS PROBLEM)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/verify-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_id: transactionId }),
        }
      );

      const result = await response.json();
      console.log("VERIFY RESULT:", result);

      if (
        result.status !== "success" ||
        result.data.status !== "successful"
      ) {
        alert("Payment verification failed.");
        return;
      }

      const finalRegId =
        result.data.meta?.regId ??
        regId ??
        null;

      if (!finalRegId) {
        alert("Registration ID missing.");
        return;
      }

      await supabase
        .from("registrations")
        .update({ payment_status: "paid" })
        .eq("id", finalRegId);

      navigate(`/success/${finalRegId}`);
    } catch (error) {
      console.error(error);
      alert("Error verifying payment.");
    }
  }

  return (
    
    <div style={{ padding: 40, textAlign: "center" }}>
      <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="logo" />
          <h1>Diocesan Youth Organization</h1>
        </div>
      </header>
      <h2>Verifying Payment...</h2>
      <p>Please wait...</p>
    </div>
  );
}
