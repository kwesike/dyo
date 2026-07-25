import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./Authcontext";

function Waiting() {
  return <p style={{ padding: 40, textAlign: "center" }}>Checking your account…</p>;
}

/** Signed-in members only. Sends people to sign-in and brings them back after. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Waiting />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Admins only. A signed-in member who lands here is told plainly, not bounced. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Waiting />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <h2>This area is for programme administrators</h2>
        <p>Your account doesn't have admin access. Ask the youth office to grant it.</p>
      </div>
    );
  }
  return <>{children}</>;
}


/**
 * Gates an admin route on a specific section. A super admin passes everything;
 * a plain admin needs the section granted; an archdeaconry admin only ever
 * passes "my-archdeaconry". The database enforces the same rules on write —
 * this just stops the page rendering at all.
 */
export function RequireSection({ section, children }: {
  section: string; children: ReactNode;
}) {
  const { loading, canAccess, isAdmin } = useAuth();
  if (loading) return <Waiting />;
  if (!isAdmin || !canAccess(section)) {
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        <h2>Not your section</h2>
        <p>You don't have access to this part of the admin area.</p>
      </div>
    );
  }
  return <>{children}</>;
}