import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";

export default function SuccessPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const userTagRef = useRef<HTMLDivElement>(null);
  const adminTagRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      const { data } = await supabase
        .from("registrations")
        .select("*")
        .eq("id", id)
        .single();

      setUser(data);
    };

    loadData();
  }, [id]);

  // Convert base64 → Blob
  const dataURLtoBlob = (dataURL: string) => {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleDownload = async () => {
    if (!userTagRef.current || !adminTagRef.current) return;

    setDownloading(true);

    /** ============================
     *  1️⃣ Generate USER TAG
     *  ============================ */
    const userCanvas = await html2canvas(userTagRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    });

    const userImg = userCanvas.toDataURL("image/png");

    // Trigger download
    const link = document.createElement("a");
    link.href = userImg;
    link.download = `${user.full_name}_Convention_Tag.png`;
    link.click();

    /** ============================
     *  2️⃣ Generate ADMIN TAG
     *  Upload to Supabase
     *  ============================ */
    const adminCanvas = await html2canvas(adminTagRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });

    const adminImg = adminCanvas.toDataURL("image/png");
    const adminBlob = dataURLtoBlob(adminImg);

    // Upload to supabase storage
    const fileName = `${user.full_name}_${Date.now()}.png`;

    const adminFilePath = `admin-tags/${fileName}`;

const { error: uploadErr } = await supabase.storage
  .from("tags")
  .upload(adminFilePath, adminBlob, {
    contentType: "image/png",
    upsert: true,
  });

if (!uploadErr) {
  const adminTagUrl = supabase.storage
    .from("tags")
    .getPublicUrl(adminFilePath).data.publicUrl;

  await supabase
    .from("registrations")
    .update({ admin_tag_url: adminTagUrl })
    .eq("id", id);
}

    /** ============================
     *  3️⃣ Redirect Home
     *  ============================ */
   setTimeout(() => {
    navigate("/");
  }, 1500);
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
      <h1 style={{ color: "green", marginBottom: 10 }}>🎉 Payment Successful!</h1>
      <p>Your registration is confirmed.</p>

      {/* 🌟 USER TAG (VISIBLE) */}
      <div
        ref={userTagRef}
        style={{
          width: 350,
          margin: "20px auto",
          padding: 20,
          borderRadius: 25,
          color: "#000",
          textAlign: "center",
          boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
          background: "linear-gradient(135deg, #ffefd5, #ffe4e1, #fffafa)",
          border: "6px solid #800000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative Banner */}
        <div
          style={{
            height: 60,
            width: "120%",
            background: "linear-gradient(90deg, #800000, #ff9800)",
            position: "absolute",
            top: -10,
            left: "-10%",
            transform: "skewY(-5deg)",
          }}
        ></div>

        <img src={logo} alt="Logo" style={{ marginTop: 15, width: 90 }} />

        <h3 style={{ margin: "10px 0", fontWeight: "bold", color: "#800000" }}>
          DIOCESAN YOUTH CONVENTION 2025
          <br />
          Theme: Walking in Integrity
          <br />
          Text: Proverbs 11:3
        </h3>

        <img
          src={`${user.photo_url}?download=1`}
          crossOrigin="anonymous"
          alt="Participant"
          style={{
            width: 150,
            height: 150,
            borderRadius: "50%",
            objectFit: "cover",
            border: "4px solid #800000",
            marginTop: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        />

        <h2 style={{ marginTop: 7, marginBottom: 2, fontWeight: "bold", fontSize: 20 }}>
          {user.full_name}
        </h2>

        <hr style={{ margin: "5px 0" }} />

        <p style={{ margin: 0, fontSize: 20 }}>
          <b>Archdeaconry:</b> {user.archdeaconry}
        </p>
        <p style={{ margin: 0, fontSize: 20 }}>
          <b>Church:</b> {user.church}
        </p>

        <h3 style={{ marginTop: 10, color: "green", fontWeight: "bold", fontSize: 20 }}>
          I WILL BE ATTENDING
        </h3>
      </div>

      {/* HIDDEN ADMIN TAG (DIFFERENT DESIGN) */}
      <div
        ref={adminTagRef}
        style={{
          width: 600,
          padding: 40,
          background: "#ffffff",
          color: "#000",
          display: "none", // HIDDEN from user
        }}
      >
        
        <img src={logo} alt="Logo" style={{ marginTop: 15, width: 90 }} />

        <h3 style={{ margin: "10px 0", fontWeight: "bold", color: "#800000" }}>
          DIOCESAN YOUTH CONVENTION 2025
          <br />
          Theme: Walking in Integrity
          <br />
          Text: Proverbs 11:3
        </h3>

        <img
          src={`${user.photo_url}?download=1`}
          crossOrigin="anonymous"
          alt="Participant"
          style={{
            width: 150,
            height: 150,
            borderRadius: "50%",
            objectFit: "cover",
            border: "4px solid #800000",
            marginTop: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        />

        <p style={{ fontSize: 22 }}><b>Name:</b> {user.full_name}</p>
        <p style={{ fontSize: 22 }}><b>Archdeaconry:</b> {user.archdeaconry}</p>
        <p style={{ fontSize: 22 }}><b>Church:</b> {user.church}</p>
        <h3 style={{ marginTop: 10, color: "green", fontWeight: "bold", fontSize: 20 }}>
          Participant
        </h3>

        <img
          src={`${user.photo_url}?download=1`}
          alt="Photo"
          style={{
            width: 220,
            height: 220,
            objectFit: "cover",
            border: "3px solid #000",
            marginTop: 20,
          }}
        />
      </div>

      {/* DOWNLOAD BUTTON */}
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
          marginTop: 15,
        }}
      >
        {downloading ? "Processing..." : "Download Convention Tag"}
      </button>
    </div>
  );
}
