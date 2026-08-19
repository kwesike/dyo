import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Upcoming birthdays — admin view.
 *
 * Shows members ordered by whose birthday is next, with the date. Admin-only
 * (the RPC checks the caller's role). Today's birthdays are highlighted.
 */
type Row = { id: string; full_name: string; date_of_birth: string; turns_on: string };

export default function AdminBirthdays() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("upcoming_birthdays", { p_days: 60 });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const isToday = (d: string) => {
    const t = new Date(); const x = new Date(d);
    return t.getDate() === x.getDate() && t.getMonth() === x.getMonth();
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long" });

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Birthdays</h1>
      <p className="text-gray-600 mb-6">Members ordered by whose birthday comes next.</p>

      {rows.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">
          No birthdays on record yet. They appear as members add their date of birth.
        </p>
      ) : (
        <div className="border rounded divide-y">
          {rows.map((r) => (
            <div key={r.id}
                 className={`p-3 flex items-center justify-between ${isToday(r.turns_on) ? "bg-pink-50" : ""}`}>
              <div>
                <p className="font-medium">
                  {r.full_name}
                  {isToday(r.turns_on) && <span className="ml-2 text-pink-700 font-semibold">🎂 Today!</span>}
                </p>
                <p className="text-sm text-gray-500">{fmt(r.turns_on)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}