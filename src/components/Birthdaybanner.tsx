import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./WinnerBanner.css";

/**
 * Birthday celebration — a homepage shout-out for members celebrating today.
 *
 * Uses todays_birthdays(), which returns only first name + day/month — never
 * the birth year or age. So the homepage can celebrate without exposing
 * anyone's age.
 */
export default function BirthdayBanner() {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("todays_birthdays");
      // show first names only, keep it warm and light
      const first = (data ?? []).map((b: any) =>
        (b.full_name ?? "").split(" ")[0]).filter(Boolean);
      setNames(first);
    })();
  }, []);

  if (names.length === 0) return null;

  const list =
    names.length === 1 ? names[0]
      : names.length === 2 ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div className="wb-banner wb-banner--birthday" role="status">
      <span className="wb-label wb-label--birthday">🎂 Today</span>
      <div className="wb-track">
        <div className="wb-slide">
          <span className="wb-item">
            🎉 Happy birthday to <strong>{list}</strong>! Wishing you a blessed year 🎈
          </span>
          <span className="wb-item">
            🎉 Happy birthday to <strong>{list}</strong>! Wishing you a blessed year 🎈
          </span>
        </div>
      </div>
    </div>
  );
}