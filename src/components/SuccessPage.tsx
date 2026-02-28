import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/LOGO.jpeg";

export default function SuccessPage() {
  const { id } = useParams();
  const tagRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      const { data } = await supabase
        .from("ignition_attendance")
        .select("*")
        .eq("id", id)
        .single();

      setUser(data);
    };

    loadData();
  }, [id]);

  const handleDownload = async () => {
  if (!tagRef.current || !user) return;

  setDownloading(true);

  // 1️⃣ Generate image
  const canvas = await html2canvas(tagRef.current, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
  });

  const imgData = canvas.toDataURL("image/png");

  // 2️⃣ Download for user
  const link = document.createElement("a");
  link.href = imgData;
  link.download = `${user.full_name}_Convention_Tag.png`;
  link.click();

  // 3️⃣ Convert base64 → Blob
  const res = await fetch(imgData);
  const blob = await res.blob();

  // 4️⃣ UPLOAD ADMIN TAG (IMPORTANT)
  const adminFileName = `admin_tags/${user.archdeaconry}/${user.full_name
    .replace(/\s+/g, "_")}_${user.id}.png`;

  const { error: adminUploadError } = await supabase.storage
    .from("tags")
    .upload(adminFileName, blob, {
      contentType: "image/png",
      upsert: true,
    });

  if (adminUploadError) {
    console.error("Admin tag upload failed:", adminUploadError);
  }

  // 5️⃣ SAVE ADMIN TAG URL TO DB (OPTIONAL BUT GOOD)
  const { data: publicData } = supabase.storage
    .from("tags")
    .getPublicUrl(adminFileName);

  await supabase
    .from("ignition_attendance")
    .update({ tag_url: publicData.publicUrl })
    .eq("id", user.id);

  // 6️⃣ Redirect home
  setTimeout(() => navigate("/"), 1200);

  setDownloading(false);
};



  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  return (
  <div style={{ padding: 30, textAlign: "center", width: "100vw" }}>
    <h1 style={{ color: "green", marginBottom: 10 }}>
      🎉 Registration Successful!
    </h1>
    <p>Your registration is confirmed.</p>

    {/* TAG DESIGN */}
    <div
      ref={tagRef}
      style={{
        width: 320,
        margin: "10px auto",
        padding: 5,
        background: "#fff",
        borderRadius: 12,
        border: "4px solid #000",
        textAlign: "center",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <img src={logo} alt="Logo" style={{ width: 70 }} />

      <h1 style={{ fontSize: 26, margin: "5px 0", fontWeight: 900 }}>
        I AM ATTENDING
      </h1>

      <h1 style={{ fontSize: 28, color: "red", margin: 0 }}>
        IGNITION 26
      </h1>

      <img
        src={user.photo_url}
        crossOrigin="anonymous"
        alt="Participant"
        style={{
          width: 180,
          height: 180,
          objectFit: "cover",
          marginTop: 15,
          border: "2px solid #000"
        }}
      />

      <h2 style={{ marginTop: 15, fontWeight: "bold" }}>
        {user.full_name}
      </h2>

      <p style={{ color: "red", marginBottom: 5 }}>
        THEME:
      </p>

      <p style={{ fontWeight: "bold", margin: 0 }}>
        THE BELIEVER'S IDENTITY
      </p>

      <div
        style={{
          marginTop: 15,
          height: 40,
          background:
            "repeating-linear-gradient(90deg,#000 0px,#000 2px,#fff 2px,#fff 4px)"
        }}
      />
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
        marginTop: 10
      }}
    >
      {downloading ? "Generating..." : "Download Convention Tag"}
    </button>
  </div>
);}