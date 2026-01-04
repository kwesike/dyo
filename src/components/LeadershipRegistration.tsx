import { useState, type ChangeEvent, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/ibadan_north.png";
import "./RegistrationForm.css";

export default function LeadershipRegistration() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    church: "",
    position_held: "",
    archdeaconry: "",
    position_held_in_arch:"",
    position_held_in_dio:"",
    phone_number:"",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("leadership_registrations")
        .insert([formData]);

      if (error) throw error;

      alert("✅ Registration successful!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to submit registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="logo" />
          <h1>Diocesan Youth Organization</h1>
        </div>
        <nav className="navbar-links">
          <Link to="/">Home</Link>
          <Link to="/register">Youth Convention</Link>
        </nav>
      </header>

      {/* Form */}
      <main className="form-section">
        <div className="form-box">
          <h2>Leadership Retreat Registration</h2>

          <form onSubmit={handleSubmit}>
            <input
              name="full_name"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />

            <input
              name="church"
              placeholder="Church"
              value={formData.church}
              onChange={handleChange}
              required
            />

            <input
              name="position_held"
              placeholder="Position Held In Church(e.g. Vicar, Youth Leader)"
              value={formData.position_held}
              onChange={handleChange}
              required
            />

            <select
              name="archdeaconry"
              value={formData.archdeaconry}
              onChange={handleChange}
              required
            >
              <option value="">Select Archdeaconry</option>
              <option>Agodi</option>
              <option>Agbrigidi</option>
              <option>Agugu</option>
              <option>Akinyele</option>
              <option>Alakia/Egbeda</option>
              <option>Alegongo</option>
              <option>Cathedral</option>
              <option>Igbo Elerin</option>
              <option>Kutayi</option>
              <option>Olorunda</option>
              <option>Olorunsogo/Akanran</option>
              <option>Orogun</option>
              <option>Yemetu</option>
            </select>

            <input
              name="position_held_in_arch"
              placeholder="Position Held in Archdeaconry"
              value={formData.position_held_in_arch}
              onChange={handleChange}
              required
            />

            <input
              name="position_held_in_dio"
              placeholder="Position Held in Diocese"
              value={formData.position_held_in_dio}
              onChange={handleChange}
              required
            />

            <input
              name="phone_number"
              placeholder="Phone Number"
              value={formData.phone_number}
              onChange={handleChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Register"}
            </button>
          </form>
        </div>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Diocesan Youth Organization</p>
      </footer>
    </div>
  );
}
