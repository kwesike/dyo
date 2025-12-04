import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import logo from "../assets/ibadan_north.png";

export default function SuccessPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tagRef = useRef<HTMLDivElement>(null);

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

  const handleDownload = async () => {
  if (!tagRef.current) return;

  setDownloading(true);

  const canvas = await html2canvas(tagRef.current, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
  });

  const imgData = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = imgData;
  link.download = `${user.full_name}_Convention_Tag.png`;
  link.click();

  setTimeout(() => navigate("/"), 800);//autoredirect
};


  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: 30, textAlign: "center", width: '100vw' }}>
      <h1 style={{ color: "green", marginBottom: 10 }}>🎉 Payment Successful!</h1>
      <p>Your registration is confirmed.</p>

      {/* TAG DESIGN */}
     <div
  ref={tagRef}
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
    overflow: "hidden"
  }}
>
  {/* Decorative top banner */}
  <div
    style={{
      height: 60,
      width: "120%",
      background: "linear-gradient(90deg, #800000, #ff9800)",
      position: "absolute",
      top: -10,
      left: "-10%",
      transform: "skewY(-5deg)"
    }}
  ></div>

  <img src={logo} alt="Logo" style={{ marginTop: 15, width: 90 }} />

  <h3 style={{ margin: "10px 0", fontWeight: "bold", color: "#800000" }}>
    DIOCESAN YOUTH CONVENTION 2025<br></br>Theme: Walking in Integrity<br></br> 
Text: Proverbs 11:3
  </h3>

  <img
    src={`${user.photo_url}?download=1`}
    crossOrigin="anonymous"
    alt="Participant"
    style={{
      width: 200,
      height: 200,
      borderRadius: "50%",
      objectFit: "cover",
      border: "4px solid #800000",
      marginTop: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
    }}
  />

  <h2 style={{ marginTop: 7, marginBottom: 2, fontWeight: "bold", fontSize: 20 }}>
    {user.full_name}
  </h2>
<hr style={{ margin: "5px 0" }} />
  <p style={{ margin: 0, fontSize: 20 }}><b>Archdeaconry:</b>{user.archdeaconry}</p>
  <p style={{ margin: 0, fontSize: 20 }}><b>Church:</b>{user.church}</p>

  {/*<h3 style={{ marginTop: 10, color: "green", fontWeight: "bold", fontSize: 20 }}>
    I WILL BE ATTENDING
  </h3>*/}
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
          marginTop: 10
        }}
      >
        {downloading ? "Generating..." : "Download Convention Tag"}
      </button>
    </div>
  );
}
