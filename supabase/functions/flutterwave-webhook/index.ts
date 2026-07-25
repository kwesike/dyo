// supabase/functions/flutterwave-webhook/index.ts
//
// Safety net. If someone pays and their phone dies before the callback runs,
// the browser never tells us — but Flutterwave still will. Point your
// Flutterwave dashboard webhook URL here and set the same secret hash.
//
// Deploy:  supabase functions deploy flutterwave-webhook --no-verify-jwt
// Secrets: supabase secrets set FLW_SECRET_HASH=some-long-random-string

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SECRET_HASH = Deno.env.get("FLW_SECRET_HASH")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.headers.get("verif-hash") !== SECRET_HASH) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await req.json();
  const tx = event?.data;
  if (tx?.status !== "successful") return new Response("ignored", { status: 200 });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: payment } = await db
    .from("payments").select("*").eq("tx_ref", tx.tx_ref).single();

  if (!payment || payment.status === "successful") {
    return new Response("ok", { status: 200 });
  }
  if (Number(tx.amount) < Number(payment.amount_naira) || tx.currency !== "NGN") {
    return new Response("amount mismatch", { status: 200 });
  }

  await db.from("payments").update({
    status: "successful",
    flw_transaction_id: String(tx.id),
    raw_response: event,
    verified_at: new Date().toISOString(),
  }).eq("id", payment.id);

  if (payment.purpose === "order") {
    await db.from("orders").update({ status: "paid" }).eq("id", payment.reference_id);
    await db.rpc("decrement_stock_for_order", { p_order_id: payment.reference_id });
  } else if (payment.purpose === "registration") {
    await db.from("programme_registrations")
      .update({ payment_status: "paid" }).eq("id", payment.reference_id);
  } else if (payment.purpose === "donation") {
    await db.from("donations")
      .update({ status: "paid", flw_id: String(tx.id) }).eq("id", payment.reference_id);
  }

  return new Response("ok", { status: 200 });
});