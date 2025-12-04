import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./RegistrationForm.css";
import logo from "../assets/ibadan_north.png";
import { loadFaceModels, detectFace } from "../utils/faceDetection";


export default function RegistrationForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    gender: "",
    date_of_birth: "",
    archdeaconry: "",
    church: "",
    occupation: "",
    educational_qualification: "",
    phone: "",
    email: "",
    address: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files || !e.target.files[0]) return;

  const originalFile = e.target.files[0];
  const reader = new FileReader();

  reader.onload = async (event) => {
    if (!event.target) return;

    const img = new Image();
    img.src = event.target.result as string;

    img.onload = async () => {
      // Ensure models are loaded
      await loadFaceModels();

      // Detect face
      const detection = await detectFace(img);

      if (!detection) {
        alert("❌ No face detected! Please upload a clear photo.");
        return;
      }

      const box  = detection;

      // Crop square around the face
      const cropSize = Math.max(box.width, box.height) * 1.6; // include shoulders
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Create square crop coordinates
      const startX = Math.max(0, centerX - cropSize / 2);
      const startY = Math.max(0, centerY - cropSize / 2);

      const canvas = document.createElement("canvas");
      const FINAL_SIZE = 1000;

      canvas.width = FINAL_SIZE;
      canvas.height = FINAL_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(
        img,
        startX,
        startY,
        cropSize,
        cropSize,
        0,
        0,
        FINAL_SIZE,
        FINAL_SIZE
      );

      // Convert to file
      canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const croppedFile = new File(
            [blob],
            originalFile.name.replace(/\.[^/.]+$/, "") + "_facecrop.jpg",
            { type: "image/jpeg", lastModified: Date.now() }
          );

          setPhoto(croppedFile);
          setPhotoPreview(URL.createObjectURL(croppedFile));
        },
        "image/jpeg",
        0.8
      );
    };
  };

  reader.readAsDataURL(originalFile);
};


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1. FIRST: check if this person has registered before
    const { data: existingUser } = await supabase
      .from("registrations")
      .select("id, payment_status")
      .eq("full_name", formData.full_name.trim())
      .eq("phone", formData.phone.trim())
      .eq("email", formData.email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      // Redirect directly to payment page
      navigate(`/payment/${existingUser.id}`);
      return;
    }

    // 2. Upload photo if new user
    let photo_url = null;

    if (photo) {
      const fileName = `${Date.now()}_${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("youth-photos")
        .upload(fileName, photo);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("youth-photos")
        .getPublicUrl(fileName);

      photo_url = urlData.publicUrl;
    }

    // 3. Insert NEW registration
    const { data: insertedData, error: insertError } = await supabase
      .from("registrations")
      .insert([
        {
          ...formData,
          photo_url,
          payment_status: "not_paid",
        },
      ])
      .select("id")
      .single();

    if (insertError) throw insertError;

    // 4. Redirect to payment page
    navigate(`/payment/${insertedData.id}`);

  } catch (error) {
    console.error(error);
    alert("❌ Error submitting form.");
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
          <Link to="/register">Register</Link>
          <Link to="/donate">Donate</Link>
        </nav>
      </header>

      {/* Registration Form */}
      <main className="form-section">
        <div className="form-box">
          <h2>Diocesan Youth Convention Registration</h2>
          <form onSubmit={handleSubmit}>
            <input name="full_name" placeholder="Full Name" value={formData.full_name} onChange={handleChange} required />
            <select name="gender" value={formData.gender} onChange={handleChange} required>
              <option value="">Select Gender</option>
              <option>Male</option>
              <option>Female</option>
            </select>
            <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
            <select name="archdeaconry" value={formData.archdeaconry} onChange={handleChange} required>
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
            <input name="church" placeholder="Church" value={formData.church} onChange={handleChange} required />
            <input name="occupation" placeholder="Occupation" value={formData.occupation} onChange={handleChange} required />
            <input name="educational_qualification" placeholder="Educational Qualification" value={formData.educational_qualification} onChange={handleChange} required />
            <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
            <input name="address" placeholder="Address" value={formData.address} onChange={handleChange} required />

            <label className="upload-label">Upload Picture</label>
            <input type="file" accept="image/*" onChange={handleFileChange} required />
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="photo-preview" />
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Register"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Diocesan Youth Organization. All rights reserved.</p>
      </footer>
    </div>
  );
}
