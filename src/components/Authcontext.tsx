import {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export interface Profile {
  id: string;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  archdeaconry: string | null;
  church: string | null;
  occupation: string | null;
  educational_qualification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  photo_url: string | null;
  role: "member" | "admin" | "super_admin" | "archdeaconry_admin";
  managed_archdeaconry: string | null;
  admin_sections: string[] | null;
}

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** True if the user may open a given admin section. */
  canAccess: (section: string) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** The admin sections a super admin implicitly holds — mirrors the SQL. */
export const ADMIN_SECTIONS = [
  "programmes", "registrations", "store", "orders", "vouchers", "tags",
  "announcements", "gallery", "blog", "carousel", "leadership",
  "archdeaconries", "pages", "members",
] as const;

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);            // don't hold the whole app on a profile fetch
      if (data.session) void loadProfile(data.session.user.id);
    });

    /**
     * IMPORTANT: do not await other Supabase calls inside this callback.
     *
     * onAuthStateChange holds an internal lock while the callback runs. Calling
     * supabase.from(...) inside it means that query waits on the lock the
     * callback is still holding — the two block each other and sign-in appears
     * to hang for several seconds before recovering. This is the usual cause of
     * a "Signing in…" button that just sits there.
     *
     * Setting the session synchronously and deferring the profile fetch to a
     * later tick releases the lock first. The UI updates immediately and the
     * profile arrives a moment behind it.
     */
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        return;
      }
      setTimeout(() => { void loadProfile(s.user.id); }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  /**
   * Signing out must ALWAYS work from the person's point of view.
   *
   * supabase.auth.signOut() calls the server to revoke the refresh token, and
   * on a flaky connection — or when the token has already expired — that call
   * can fail or hang. Waiting for it before clearing state is why the button
   * appeared to do nothing.
   *
   * So: clear local state first, then tell the server as a courtesy. Worst
   * case the server-side token lives out its remaining life; the browser has
   * forgotten it either way.
   */
  const signOut = useCallback(async () => {
    setSession(null);
    setProfile(null);

    try {
      await supabase.auth.signOut();
    } catch {
      // Already signed out locally — nothing useful left to do.
    }

    // Belt and braces: drop the stored token if anything failed to clear it.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.includes("auth-token"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* private browsing can block localStorage */
    }
  }, []);

  const value: AuthValue = {
    session,
    profile,
    loading,
    isAdmin:
      profile?.role === "admin" ||
      profile?.role === "super_admin" ||
      profile?.role === "archdeaconry_admin",
    isSuperAdmin: profile?.role === "super_admin",
    canAccess: (section: string) => {
      if (!profile) return false;
      if (profile.role === "super_admin") return true;
      // Archdeaconry admins only ever see their own archdeaconry page.
      if (profile.role === "archdeaconry_admin") return section === "my-archdeaconry";
      if (profile.role === "admin") return (profile.admin_sections ?? []).includes(section);
      return false;
    },
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id);
    },
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}