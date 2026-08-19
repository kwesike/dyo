import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/trackView";

/**
 * Mount once inside the Router. Records a page view whenever the route
 * changes. Admin pages are skipped so staff activity doesn't inflate the
 * public traffic numbers.
 */
export default function PageTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;  // don't track admin
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}