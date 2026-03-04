import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/LOGO.jpeg";
import bgImage from "../assets/ignition-bg.jpeg";

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
    scale: 4,
    useCORS: true,
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
  style={{
    width: "100%",
    maxWidth: 420,
    margin: "20px auto",
  }}
>
  <div
    ref={tagRef}
    style={{
      width: "100%",
      aspectRatio: "2 / 3",
      position: "relative",
      fontFamily: "Arial, sans-serif",
      backgroundImage: `url(${bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      overflow: "hidden",
      borderRadius: 12,
    }}

    
  >
    {/* CENTER CONTENT */}
    <div
      style={{
        position: "absolute",
        top: "58%",
        left: "61.4%",
        transform: "translate(-50%, -50%)",
        width: "80%",
        textAlign: "center",
      }}
    >
      {/* PHOTO FRAME */}
      <div
        style={{
          width: "70%",
          aspectRatio: "1 / 1",
          border: "4px solid black",
          borderRadius: 20,
          overflow: "hidden",
          background: "#eee",
        }}
      >
        <img
          src={user.photo_url}
          crossOrigin="anonymous"
          alt="Participant"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
{/* NAME BAR */}
      <div
        style={{
         position: "absolute",
    top: "90%",
    left: "35%",
    transform: "translate(-50%, -50%)", // 👈 THIS centers it perfectly
    width: "100%",                       // optional, so it's not full width
    background: "#0b1979",
    color: "#fff",
    padding: "8px",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    zIndex: 20,
           
        }}
      >
        {user.full_name}
        <br />
        {user.archdeaconry} Archdeaconry
      </div>

    </div>
    
    {/* BOTTOM INFO */}
    <div
      style={{
        position: "absolute",
        bottom: 0,
        width: "100%",
        background: "#fff",
        textAlign: "center",
        padding: 1,
        color:"red",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14 }}>
        FRIDAY 17TH APRIL, 2026
      </h3>

      <div
        style={{
          background: "red",
          color: "#fff",
          display: "inline-block",
          padding: "6px 14px",
          marginTop: 2,
          fontWeight: "bold",
          fontSize: 14,
        }}
      >
        6pm - 6am
      </div>

      <p style={{ marginTop: 3, fontSize: 13, color:"red" }}>
        St. Paul’s Anglican Church, Yemetu, Ibadan
      </p>
    </div>
  </div>
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
      {downloading ? "Downloaded" : "Download Convention Tag"}
    </button>
  </div>
);}
