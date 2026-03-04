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
  ref={tagRef}
  style={{
    width: 600,
    height: 900,
    margin: "20px auto",
    position: "relative",
    fontFamily: "Arial, sans-serif",
    backgroundImage: `url(${bgImage})`, // 🔥 Put your fire background image in public folder
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: "#000",
    overflow: "hidden",
  }}
>
  {/* White inner paper effect */}
  <div
    style={{
      width: "90%",
      height: "85%",
      margin: "40px auto",
      borderRadius: 20,
      padding: 30,
      textAlign: "center",
      position: "relative",
    }}
  >
    {/* TOP LOGO + THEME */}
    {/*<div style={{ display: "flex", justifyContent: "space-between" }}>
      <img src={logo} alt="DYO Logo" style={{ width: 120 }} />

      <div
        style={{
          background: "red",
          color: "#fff",
          padding: "8px 15px",
          borderRadius: 20,
          fontWeight: "bold",
          fontSize: 14,
        }}
      >
        Theme: The Believer’s IDENTITY
      </div>
    </div>

    {/* TITLE */}
    {/*<h2 style={{ marginTop: 20, fontWeight: 600 }}>
      I will be attending
    </h2>

    {/*<h1
      style={{
        fontSize: 60,
        margin: 0,
        color: "#0d47a1",
        fontWeight: 900,
        letterSpacing: 2,
      }}
    >
      IGNITION ’26
    </h1>

    {/*<p style={{ marginTop: 5, fontWeight: 600 }}>
      (WORD & PRAYER CONFERENCE)
    </p>*/}

    {/* PHOTO FRAME */}
    <div
      style={{
        width: 350,
        height: 350,
        marginRight: "1px",
        marginLeft: "1px",
        margin: "270px auto 0",
        border: "5px solid #000",
        borderRadius: 30,
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

    {/* BLUE NAME BAR */}
    <div
      style={{
        background: "#0b1979",
        color: "#fff",
        padding: "2px 2px",
       
        fontSize: 20,
        fontWeight: "bold",
      }}
    >
      {user.full_name}<br />
      {user.archdeaconry} Archdeaconry
    </div>
  </div>

  {/* BOTTOM EVENT INFO */}
  <div
    style={{
      position: "absolute",
      bottom: 0,
      width: "100%",
      background: "#fff",
      padding: 3,
      textAlign: "center",
    }}
  >
    <h2 style={{ margin: 0 }}>
      FRIDAY 17TH APRIL, 2026
    </h2>

    <div
      style={{
        background: "red",
        color: "#fff",
        display: "inline-block",
        padding: "8px 20px",
        marginTop: 2,
        fontWeight: "bold",
        fontSize: 20,
      }}
    >
      6pm - 6am
    </div>

    <p style={{ marginTop: 2, fontSize: 20 }}>
      Venue: St. Paul’s Anglican Church, Yemetu, Ibadan
    </p>
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