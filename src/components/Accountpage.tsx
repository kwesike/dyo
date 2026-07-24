import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./../lib/supabaseClient";
import { useAuth } from "./Authcontext";
import { uploadPublicFile } from "./../lib/Storage";
import { ARCHDEACONRIES } from "./../lib/Constants";
import { naira } from "./../lib/Payments";
import { loadFaceModels, detectFace } from "./../utils/faceDetection";

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
  const { session, profile, refreshProfile, signOut } = useAuth();
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">My account</h1>
          <p className="text-gray-600 text-sm">{profile?.email}</p>
        </div>
        <button className="linkish" onClick={signOut}>Sign out</button>
      </div>

      {/* photo */}
      <div className="flex items-center gap-4 mb-6">
        {profile?.photo_url
          ? <img src={profile.photo_url} alt="" className="w-24 h-24 rounded-full object-cover border" />
          : <div className="w-24 h-24 rounded-full bg-gray-200 grid place-items-center text-2xl">
              {profile?.full_name?.[0] ?? "?"}
            </div>}
        <div>
          <p className="font-medium">Profile photo</p>
          <p className="text-sm text-gray-600 mb-1">
            This is the face that appears on your attendance cards.
          </p>
          <input type="file" accept="image/*"
                 onChange={(e) => changePhoto(e.target.files?.[0])} disabled={busy} />
        </div>
      </div>

      {/* details */}
      <div className="grid md:grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2" name="full_name" placeholder="Full name"
               value={form.full_name ?? ""} onChange={set} />
        <select className="border rounded px-3 py-2" name="gender" value={form.gender ?? ""} onChange={set}>
          <option value="">Gender</option><option>Male</option><option>Female</option>
        </select>
        <input className="border rounded px-3 py-2" name="phone" placeholder="Phone"
               value={form.phone ?? ""} onChange={set} />
        <input className="border rounded px-3 py-2" type="date" name="date_of_birth"
               value={form.date_of_birth ?? ""} onChange={set} />
        <select className="border rounded px-3 py-2" name="archdeaconry"
                value={form.archdeaconry ?? ""} onChange={set}>
          <option value="">Archdeaconry</option>
          {ARCHDEACONRIES.map((a) => <option key={a}>{a}</option>)}
        </select>
        <input className="border rounded px-3 py-2" name="church" placeholder="Church"
               value={form.church ?? ""} onChange={set} />
        <input className="border rounded px-3 py-2" name="occupation" placeholder="Occupation"
               value={form.occupation ?? ""} onChange={set} />
        <input className="border rounded px-3 py-2" name="educational_qualification"
               placeholder="Highest qualification"
               value={form.educational_qualification ?? ""} onChange={set} />
      </div>
      <input className="border rounded px-3 py-2 w-full mt-3" name="address" placeholder="Address"
             value={form.address ?? ""} onChange={set} />

      {message && <p className="text-sm mt-3">{message}</p>}

      <button onClick={save} disabled={busy}
              className="bg-[#800000] text-white px-5 py-2 rounded mt-4">
        {busy ? "Saving…" : "Save changes"}
      </button>

      {/* registrations */}
      <h2 className="text-xl font-semibold mt-10 mb-3">My programmes</h2>
      {registrations.length === 0 ? (
        <p className="text-gray-600">
          You haven't registered for anything yet. <Link className="underline" to="/programmes">See what's on</Link>.
        </p>
      ) : (
        <div className="grid gap-2">
          {registrations.map((r) => (
            <Link key={r.id} to={`/programmes/${r.programmes?.slug}`}
                  className="border rounded p-3 flex justify-between items-center">
              <span>
                <strong>{r.programmes?.title}</strong>
                {r.programmes?.starts_at &&
                  <span className="text-gray-500 text-sm">
                    {" · "}{new Date(r.programmes.starts_at).toLocaleDateString("en-NG")}
                  </span>}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                r.payment_status === "pending"
                  ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                {r.payment_status === "pending" ? "Payment due" : "Confirmed"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* orders */}
      <h2 className="text-xl font-semibold mt-10 mb-3">My orders</h2>
      {orders.length === 0 ? (
        <p className="text-gray-600">
          Nothing ordered yet. <Link className="underline" to="/store">Visit the store</Link>.
        </p>
      ) : (
        <div className="grid gap-2">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`}
                  className="border rounded p-3 flex justify-between">
              <span>{o.order_number} · {new Date(o.created_at).toLocaleDateString("en-NG")}</span>
              <span>{naira(o.total_naira)} · {o.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}