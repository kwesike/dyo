import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";
import "./DonationPage.css";

export default function DonationPage() {
  const [amount, setAmount] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();

  const handleFlutterwave = async () => {
    if (!amount || !email || !fullName) {
      alert("Please enter your name, email and amount.");
      return;
    }

    // Insert donor temporarily into DB
    const { data: inserted, error } = await supabase
      .from("donations")
      .insert([{ full_name: fullName, email, amount, status: "pending" }])
      .select("id")
      .single();

    if (error) {
      console.error(error);
      alert("Error creating donation record.");
      return;
    }

    const donationId = inserted.id;

    // OPEN FLUTTERWAVE POPUP
    const FlutterwaveCheckout = (window as any).FlutterwaveCheckout;
    FlutterwaveCheckout({
      public_key: "YOUR_FLUTTERWAVE_PUBLIC_KEY",
      tx_ref: "DYODON_" + Date.now(),
      amount: amount,
      currency: "NGN",
      customer: {
        email: email,
        name: fullName,
      },
      customizations: {
        title: "Donation",
        description: "DYO Support Donation",
        logo: logo,
      },
      callback: async function (response: any) {
        if (response.status === "successful") {
          // Update donation status in DB
          await supabase
            .from("donations")
            .update({ status: "paid", reference: response.transaction_id })
            .eq("id", donationId);

          navigate(`/donation-receipt/${donationId}`);
        } else {
          alert("Payment not completed.");
        }
      },
      onclose: function () {
        console.log("Flutterwave popup closed.");
      },
    });
  };

  return (
    <div className="donation-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="logo" />
          <h1>Diocesan Youth Organization</h1>
        </div>
        <nav className="navbar-links">
          <Link to="/">Home</Link>
          <Link to="/register">Register</Link>
          <Link to="/donate">Donate</Link>
        </nav>
      </header>

      {/* Donation Form */}
      <main className="donation-content">
        <div className="donation-box">
          <h2>Support the Ministry</h2>
          <p>Your giving helps strengthen the work of God. Thank you!</p>

          <div className="donation-form">
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="number"
              placeholder="Enter Amount (₦)"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />

            <button onClick={handleFlutterwave}>Donate Now</button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Diocesan Youth Organization</p>
      </footer>
    </div>
  );
}
