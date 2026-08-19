import { supabase } from "./supabaseClient";

/**
 * Lightweight page-view tracking. Call trackPageView() on route changes.
 * A visitor id (persistent) and session id (per tab) let us count unique-ish
 * visitors without any third-party analytics. Fire-and-forget — never blocks
 * or breaks the page if it fails.
 */
function id(key: string, store: Storage): string {
  try {
    let v = store.getItem(key);
    if (!v) { v = crypto.randomUUID(); store.setItem(key, v); }
    return v;
  } catch { return "anon"; }
}

// Classify the path into a page type + slug for content-level stats.
function classify(path: string): { type: string; slug: string | null } {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { type: "home", slug: null };
  const [head, second] = parts;
  const map: Record<string, string> = {
    tournaments: "tournament", programmes: "programme", store: "store",
    gallery: "gallery", blog: "blog", give: "donate", archdeaconry: "archdeaconry",
  };
  const type = map[head] ?? head;
  return { type, slug: second ?? null };
}

let lastPath = "";

export function trackPageView(path: string) {
  if (path === lastPath) return;   // avoid double-count on same path
  lastPath = path;
  const { type, slug } = classify(path);
  // fire and forget
  supabase.rpc("record_page_view", {
    p_path: path,
    p_page_type: type,
    p_ref_slug: slug,
    p_visitor_id: id("dyo_visitor", localStorage),
    p_session_id: id("dyo_session", sessionStorage),
    p_referrer: document.referrer || null,
  }).then(() => {}, () => {});   // swallow errors silently
}