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
    archdeaconry: "",
    church: "",
    phone: "",
    email: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

 const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files || !e.target.files[0]) return;

  setPhotoProcessing(true);
  setUploadProgress(0);

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
    setPhotoProcessing(false);
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
    // 1️⃣ Check if user already exists
    const { data: existingUser } = await supabase
      .from("ignition_attendance")
      .select("id")
      .eq("full_name", formData.full_name.trim())
      .eq("phone", formData.phone.trim())
      .eq("email", formData.email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
  navigate(`/success/${existingUser.id}`);
  return;
    }

    // 2️⃣ Upload photo
    let photo_url = null;

   if (photo) {
  const fileName = `${Date.now()}_${photo.name}`;

  setPhotoUploading(true);
  setUploadProgress(0);

  // Fake smooth progress animation
  const progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      if (prev >= 90) return prev;
      return prev + 5;
    });
  }, 200);

  const { error: uploadError } = await supabase.storage
    .from("youth-photos")
    .upload(fileName, photo);

  clearInterval(progressInterval);

  if (uploadError) throw uploadError;

  setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("youth-photos")
        .getPublicUrl(fileName);

      photo_url = urlData.publicUrl;
    }
      setTimeout(() => {
    setPhotoUploading(false);
  }, 500);

    // // 3️⃣ Insert registration AND return inserted row
const { data: insertedData, error: insertError } = await supabase
  .from("ignition_attendance")
  .insert([
    {
      ...formData,
      photo_url,
      payment_status: "registered",
    },
  ])
  .select("id")
  .single();

if (insertError) throw insertError;

// 4️⃣ Redirect to SUCCESS page with ID
navigate(`/success/${insertedData.id}`);

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
              <option>Non-Anglican</option>
            </select>
            <input name="church" placeholder="Church" value={formData.church} onChange={handleChange} required />
            <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
            
            <label className="upload-label">Upload Picture</label>
            <input type="file" accept="image/*" onChange={handleFileChange} required />
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="photo-preview" />
            )}

            {photoProcessing && (
  <p style={{ color: "#fcf8f8", fontWeight: "bold" }}>
    🔄 Processing photo...
  </p>
)}

{photoUploading && (
  <div style={{ marginTop: 10 }}>
    <p style={{ marginBottom: 5 }}>
      📤 Uploading Photo... {uploadProgress}%
    </p>
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#eee",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${uploadProgress}%`,
          height: "100%",
          background: "#800000",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  </div>
)}

            <button
  type="submit"
  disabled={loading || photoProcessing || photoUploading}
>
  {loading
    ? "Submitting..."
    : photoUploading
    ? "Uploading Photo..."
    : photoProcessing
    ? "Processing Photo..."
    : "Register"}
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
