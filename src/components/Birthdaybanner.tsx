import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Winnerbanner.css";

/**
 * Birthday celebration — a homepage shout-out for members celebrating today,
 * each shown with their photo. Uses todays_birthdays() which returns first
 * name + day/month + photo (never the birth year/age).
 */
type Bday = { full_name: string; photo_url: string | null };

export default function BirthdayBanner() {
  const [people, setPeople] = useState<Bday[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("todays_birthdays");
      setPeople((data ?? []).map((b: any) => ({
        full_name: b.full_name ?? "",
        photo_url: b.photo_url ?? null,
      })).filter((b: Bday) => b.full_name));
    })();
  }, []);

  if (people.length === 0) return null;

  const firstName = (n: string) => n.split(" ")[0];

  // Each celebrant becomes a chip with photo + first name; duplicate the row
  // for a seamless scroll.
  const chips = people.map((p, i) => (
    <span className="wb-item bday-chip" key={i}>
      {p.photo_url
        ? <img className="bday-photo" src={p.photo_url} alt="" />
        : <span className="bday-photo bday-photo--blank">{firstName(p.full_name)[0]}</span>}
      🎉 Happy birthday <strong>{firstName(p.full_name)}</strong>!
    </span>
  ));

  return (
    <div className="wb-banner wb-banner--birthday" role="status">
      <span className="wb-label wb-label--birthday">🎂 Today</span>
      <div className="wb-track">
        <div className="wb-slide">
          {chips}
          {chips}
        </div>
      </div>
    </div>
  );
}