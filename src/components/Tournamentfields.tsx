import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Field builder — the admin defines what players and coaches must provide
 * when they register for this tournament (beyond their account info).
 */
type Field = {
  id: string; label: string; field_type: string; options: string[] | null;
  required: boolean; applies_to: string; sort_order: number;
};

export default function TournamentFields({ tournamentId }: { tournamentId: string }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [f, setF] = useState({ label: "", field_type: "text", options: "",
                               required: true, applies_to: "both" });

  useEffect(() => { void load(); }, [tournamentId]);

  async function load() {
    const { data } = await supabase.from("tournament_fields")
      .select("*").eq("tournament_id", tournamentId).order("sort_order");
    setFields(data ?? []);
  }

  async function addField() {
    if (!f.label.trim()) return;
    const opts = f.field_type === "select"
      ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : null;
    const { error } = await supabase.from("tournament_fields").insert({
      tournament_id: tournamentId,
      label: f.label.trim(),
      field_type: f.field_type,
      options: opts,
      required: f.required,
      applies_to: f.applies_to,
      sort_order: fields.length,
    });
    if (error) { alert(error.message); return; }
    setF({ label: "", field_type: "text", options: "", required: true, applies_to: "both" });
    void load();
  }

  async function removeField(id: string) {
    if (!confirm("Remove this field?")) return;
    await supabase.from("tournament_fields").delete().eq("id", id);
    void load();
  }

  return (
    <div>
      <div className="border rounded-lg p-4 mb-4 bg-gray-50">
        <h3 className="font-semibold mb-3">Add a registration field</h3>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input className="border rounded px-3 py-2" placeholder="Field label (e.g. Jersey number)"
                 value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <select className="border rounded px-3 py-2" value={f.field_type}
                  onChange={(e) => setF({ ...f, field_type: e.target.value })}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Choice (dropdown)</option>
            <option value="file">File upload</option>
          </select>
          {f.field_type === "select" && (
            <input className="border rounded px-3 py-2 sm:col-span-2"
                   placeholder="Options, comma-separated (e.g. GK, Defender, Midfielder, Striker)"
                   value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />
          )}
          <select className="border rounded px-3 py-2" value={f.applies_to}
                  onChange={(e) => setF({ ...f, applies_to: e.target.value })}>
            <option value="both">Players & coaches</option>
            <option value="player">Players only</option>
            <option value="coach">Coaches only</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.required}
                   onChange={(e) => setF({ ...f, required: e.target.checked })} />
            Required
          </label>
        </div>
        <button onClick={addField} className="bg-[#800000] text-white px-4 py-2 rounded">Add field</button>
      </div>

      <div className="grid gap-2">
        {fields.map((fl) => (
          <div key={fl.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <span className="font-medium">{fl.label}</span>
              <span className="text-xs text-gray-500 ml-2">
                {fl.field_type}{fl.required ? " · required" : " · optional"} · {fl.applies_to}
                {fl.options?.length ? ` · ${fl.options.join(", ")}` : ""}
              </span>
            </div>
            <button onClick={() => removeField(fl.id)} className="text-red-600 text-sm">Remove</button>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-gray-500 text-sm">
            No custom fields yet. Registrants will still provide their account info
            (name, email, phone). Add fields for anything extra you need.
          </p>
        )}
      </div>
    </div>
  );
}