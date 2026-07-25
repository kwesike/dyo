// ============================================================
//  delete-user  —  Edge Function
//
//  Deleting someone from auth.users needs the service role key,
//  which must NEVER touch the browser. So the browser calls this
//  function, the function checks the CALLER is a super admin, and
//  only then deletes.
//
//  Deploy with "Verify JWT" ON — we need the caller's identity.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { userId } = await req.json();
    if (!userId) {
      return json({ error: "No user specified." }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Who is asking? Read their identity from their own token.
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: whoError } = await caller.auth.getUser();
    if (whoError || !user) {
      return json({ error: "Not signed in." }, 401);
    }

    // 2. Is the caller actually a super admin? Check the database, not a claim.
    const admin = createClient(url, serviceKey);
    const { data: me } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();

    if (me?.role !== "super_admin") {
      return json({ error: "Only a super admin can remove users." }, 403);
    }

    // 3. Don't let a super admin delete themselves — that's how an org
    //    locks itself out entirely.
    if (userId === user.id) {
      return json({ error: "You can't delete your own account here." }, 400);
    }

    // 4. Don't let one super admin delete another. Demote first, deliberately.
    const { data: target } = await admin
      .from("profiles").select("role").eq("id", userId).maybeSingle();

    if (target?.role === "super_admin") {
      return json({ error: "Remove their super-admin role before deleting." }, 400);
    }

    // 5. Delete. The profile row and any owned data cascade via foreign keys
    //    (ON DELETE CASCADE / SET NULL as defined in the schema).
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      return json({ error: delError.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}