import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { uploadPublicFile } from "../lib/Storage";
import { ARCHDEACONRIES } from "../lib/Constants";
import { naira } from "../lib/Payments";
import { loadFaceModels, detectFace } from "../utils/faceDetection";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Account.css";

/**
 * The profile photo saved here is what lands on every attendance card, so it
 * gets the same face-detect crop the old registration form used — just once,
 * instead of on every single programme.
 */
async function cropToFace(file: File): Promise<File> {
  const dataUrl = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = dataUrl;
  });

  await loadFaceModels();
  const box = await detectFace(img);
  if (!box) throw new Error("We couldn't find a face in that photo. Try a clearer, front-facing one.");

  const size = Math.max(box.width, box.height) * 1.6;
  const startX = Math.max(0, box.x + box.width / 2 - size / 2);
  const startY = Math.max(0, box.y + box.height / 2 - size / 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1000;
  canvas.getContext("2d")!.drawImage(img, startX, startY, size, size, 0, 0, 1000, 1000);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));

  return new File([blob], "profile.jpg", { type: "image/jpeg" });
}

export default function AccountPage() {
  const { session, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState<any>({});
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: regs }, { data: ords }] = await Promise.all([
        supabase.from("programme_registrations")
          .select("*, programmes(title, slug, starts_at)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("orders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
      ]);
      setRegistrations(regs ?? []);
      setOrders(ords ?? []);
    })();
  }, [session]);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function changePhoto(file?: File) {
    if (!file || !session) return;
    setBusy(true);
    setMessage("");
    try {
      const cropped = await cropToFace(file);
      const url = await uploadPublicFile("member-photos", cropped, session.user.id);
      await supabase.from("profiles").update({ photo_url: url }).eq("id", session.user.id);
      await refreshProfile();
      setMessage("Photo updated.");
    } catch (err) {
      setMessage((err as Error).message);
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, gender: form.gender, date_of_birth: form.date_of_birth || null,
      archdeaconry: form.archdeaconry, church: form.church, occupation: form.occupation,
      educational_qualification: form.educational_qualification,
      phone: form.phone, address: form.address,
    }).eq("id", session!.user.id);
    setBusy(false);
    setMessage(error ? "Couldn't save those changes." : "Saved.");
    if (!error) await refreshProfile();
  }

  return (
    <div className="account">
      <Navbar />

      <header className="account-head">
        <p className="account-eyebrow">Your account</p>
        <h1>{profile?.full_name || "My account"}</h1>
        <p>{profile?.email}</p>
      </header>

      <div className="account-body">
        {/* photo + details */}
        <section className="account-card">
          <div className="account-photo-row">
            {profile?.photo_url
              ? <img src={profile.photo_url} alt="" className="account-avatar" />
              : <div className="account-avatar account-avatar--blank">
                  {profile?.full_name?.[0] ?? "?"}
                </div>}
            <div>
              <p className="account-photo-title">Profile photo</p>
              <p className="account-photo-note">
                This is the face that appears on your attendance cards.
              </p>
              <input type="file" accept="image/*"
                     onChange={(e) => changePhoto(e.target.files?.[0])} disabled={busy} />
            </div>
          </div>

          <div className="account-grid">
            <label>Full name
              <input name="full_name" value={form.full_name ?? ""} onChange={set} />
            </label>
            <label>Gender
              <select name="gender" value={form.gender ?? ""} onChange={set}>
                <option value="">Choose</option><option>Male</option><option>Female</option>
              </select>
            </label>
            <label>Phone
              <input name="phone" value={form.phone ?? ""} onChange={set} />
            </label>
            <label>Date of birth
              <input type="date" name="date_of_birth" value={form.date_of_birth ?? ""} onChange={set} />
            </label>
            <label>Archdeaconry
              <select name="archdeaconry" value={form.archdeaconry ?? ""} onChange={set}>
                <option value="">Choose</option>
                {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label>Church
              <input name="church" value={form.church ?? ""} onChange={set} />
            </label>
            <label>Occupation
              <input name="occupation" value={form.occupation ?? ""} onChange={set} />
            </label>
            <label>Highest qualification
              <input name="educational_qualification"
                     value={form.educational_qualification ?? ""} onChange={set} />
            </label>
          </div>
          <label className="account-full">Address
            <input name="address" value={form.address ?? ""} onChange={set} />
          </label>

          {message && <p className="account-message">{message}</p>}

          <button className="account-save" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </section>

        {/* registrations */}
        <section className="account-section">
          <h2>My programmes</h2>
          {registrations.length === 0 ? (
            <p className="account-empty">
              You haven't registered for anything yet.{" "}
              <Link to="/programmes">See what's on</Link>.
            </p>
          ) : (
            <div className="account-list">
              {registrations.map((r) => (
                <Link key={r.id} to={`/programmes/${r.programmes?.slug}`} className="account-row">
                  <span>
                    <strong>{r.programmes?.title}</strong>
                    {r.programmes?.starts_at &&
                      <em>{" · "}{new Date(r.programmes.starts_at).toLocaleDateString("en-NG")}</em>}
                  </span>
                  <span className={`account-pill ${
                    r.payment_status === "pending" ? "is-due" : "is-ok"}`}>
                    {r.payment_status === "pending" ? "Payment due" : "Confirmed"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* orders */}
        <section className="account-section">
          <h2>My orders</h2>
          {orders.length === 0 ? (
            <p className="account-empty">
              Nothing ordered yet. <Link to="/store">Visit the store</Link>.
            </p>
          ) : (
            <div className="account-list">
              {orders.map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="account-row">
                  <span>{o.order_number} · {new Date(o.created_at).toLocaleDateString("en-NG")}</span>
                  <span>{naira(o.total_naira)} · {o.status}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}