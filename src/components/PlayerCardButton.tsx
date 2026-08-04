import { useState } from "react";
import { composeAttendingCard, shareCard } from "../lib/Attendingcard";

/**
 * Generates a player/coach card by placing their photo + name + team + role
 * onto the tournament's uploaded template, reusing the attendance-card engine
 * (which finds the blank panel in the design and composes onto it).
 */
export default function PlayerCardButton({
  templateUrl, photoUrl, name, team, role,
}: {
  templateUrl: string | null;
  photoUrl: string | null;
  name: string;
  team: string;
  role: string;
}) {
  const [busy, setBusy] = useState(false);

  if (!templateUrl || !photoUrl) return null;

  async function make(download: boolean) {
    setBusy(true);
    try {
      const blob = await composeAttendingCard({
        templateUrl: templateUrl!,
        photoUrl: photoUrl!,
        details: { name, church: team, archdeaconry: role },
      });
      const filename = `${name.replace(/\s+/g, "-")}-card.png`;
      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        await shareCard(blob, filename, `${name}'s tournament card`);
      }
    } catch (e: any) {
      alert(e?.message ?? "Couldn't generate the card.");
    }
    setBusy(false);
  }

  return (
    <button onClick={() => make(true)} disabled={busy}
            className="text-xs px-3 py-1.5 rounded bg-[#800000] text-white">
      {busy ? "Generating…" : "Download card"}
    </button>
  );
}