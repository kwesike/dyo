// supabase/functions/verify-payment/index.ts
//
// THE MOST IMPORTANT FILE IN THIS RESTRUCTURE.
//
// Your current code marks a registration "paid" from the browser callback.
// Anyone can open devtools and run that same Supabase update — free tickets
// for everybody. This function is the only thing allowed to mark money as
// received. It re-asks Flutterwave what actually happened, checks the amount
// matches what we expected, and only then writes.
//
// Deploy:  supabase functions deploy verify-payment
// Secrets: supabase secrets set FLW_SECRET_KEY=FLWSECK-xxxxx

import { createClient } from "@supabase/supabase-js";

const FLW_SECRET_KEY = Deno.env.get("FLW_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { transaction_id, tx_ref } = await req.json();
    if (!transaction_id || !tx_ref) {
      return json({ error: "transaction_id and tx_ref are required." }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. What did we expect to be paid?
    const { data: payment } = await db
      .from("payments")
      .select("*")
      .eq("tx_ref", tx_ref)
      .single();

    if (!payment) return json({ error: "Unknown transaction reference." }, 404);
    if (payment.status === "successful") {
      return json({ status: "already_verified", purpose: payment.purpose,
                    reference_id: payment.reference_id });
    }

    // 2. Ask Flutterwave what really happened.
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } },
    );
    const flw = await res.json();
    const tx = flw?.data;

    const ok =
      flw?.status === "success" &&
      tx?.status === "successful" &&
      tx?.tx_ref === tx_ref &&
      tx?.currency === "NGN" &&
      Number(tx?.amount) >= Number(payment.amount_naira);

    await db.from("payments").update({
      flw_transaction_id: String(transaction_id),
      status: ok ? "successful" : "failed",
      raw_response: flw,
      verified_at: new Date().toISOString(),
    }).eq("id", payment.id);

    if (!ok) {
      if (payment.purpose === "order") {
        await db.from("orders").update({ status: "failed" }).eq("id", payment.reference_id);
      }
      return json({ status: "failed", reason: tx?.processor_response ?? "Verification failed." }, 402);
    }

    // 3. Apply the payment.
    if (payment.purpose === "order") {
      await db.from("orders")
        .update({ status: "paid" })
        .eq("id", payment.reference_id);
      await db.rpc("decrement_stock_for_order", { p_order_id: payment.reference_id });
    } else if (payment.purpose === "registration") {
      await db.from("programme_registrations")
        .update({ payment_status: "paid" })
        .eq("id", payment.reference_id);
    } else if (payment.purpose === "donation") {
      await db.from("donations")
        .update({ status: "paid", flw_id: String(transaction_id) })
        .eq("id", payment.reference_id);
    }

    return json({
      status: "success",
      purpose: payment.purpose,
      reference_id: payment.reference_id,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Verification error." }, 500);
  }
});