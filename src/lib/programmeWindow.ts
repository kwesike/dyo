export const REGISTRATION_LEAD_DAYS = 60;

export type WindowState =
  | "opens_later"   // more than 60 days out
  | "open"
  | "closed"
  | "no_date";      // programme has no start date yet

export interface RegistrationWindow {
  state: WindowState;
  opensAt: Date | null;
  closesAt: Date | null;
  canRegister: boolean;
  /** Short line to show on a card or button. */
  label: string;
}

/**
 * Registration opens 60 days before a programme and closes when it starts,
 * unless an admin set explicit dates. Mirrors the database trigger in
 * supabase/registration-window.sql — the database is what actually enforces it,
 * this is only so the UI agrees.
 */
export function registrationWindow(programme: {
  starts_at?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
}): RegistrationWindow {
  const now = new Date();

  const startsAt = programme.starts_at ? new Date(programme.starts_at) : null;

  const opensAt = programme.registration_opens_at
    ? new Date(programme.registration_opens_at)
    : startsAt
      ? new Date(startsAt.getTime() - REGISTRATION_LEAD_DAYS * 86_400_000)
      : null;

  const closesAt = programme.registration_closes_at
    ? new Date(programme.registration_closes_at)
    : startsAt;

  if (!startsAt) {
    return { state: "no_date", opensAt, closesAt, canRegister: false,
             label: "Date to be announced" };
  }

  if (opensAt && now < opensAt) {
    return {
      state: "opens_later", opensAt, closesAt, canRegister: false,
      label: `Registration opens ${opensAt.toLocaleDateString("en-NG",
        { day: "numeric", month: "long" })}`,
    };
  }

  if (closesAt && now > closesAt) {
    return { state: "closed", opensAt, closesAt, canRegister: false,
             label: "Registration closed" };
  }

  const daysLeft = closesAt
    ? Math.ceil((closesAt.getTime() - now.getTime()) / 86_400_000)
    : null;

  return {
    state: "open", opensAt, closesAt, canRegister: true,
    label: daysLeft !== null && daysLeft <= 7
      ? `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : "Registration open",
  };
}

export const formatEventDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-NG",
        { weekday: "short", day: "numeric", month: "long", year: "numeric" })
    : "Date to be announced";