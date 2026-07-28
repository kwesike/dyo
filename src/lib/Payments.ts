import { supabase } from "./supabaseClient";
import type { FlutterwaveResponse } from "../types/flutterwave";

const FLW_SCRIPT = "https://checkout.flutterwave.com/v3.js";

// The Window.FlutterwaveCheckout type lives in src/types/flutterwave.ts.
// Declaring it here as well is what caused TS2717.

/** Loads the Flutterwave script once, no matter how many pages ask for it. */
let scriptPromise: Promise<void> | null = null;
export function loadFlutterwave(): Promise<void> {
  if (typeof window.FlutterwaveCheckout === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = FLW_SCRIPT;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't reach Flutterwave. Check your connection and try again."));
    };
    document.body.appendChild(el);
  });
  return scriptPromise;
}

export type PaymentPurpose = "order" | "registration" | "donation" | "sponsorship"|"body_payment";

export interface PayArgs {
  purpose: PaymentPurpose;
  referenceId: string;        // orders.id | programme_registrations.id | donations.id
  amountNaira: number;
  customer: { email: string; name: string; phone?: string };
  title: string;              // shown in the Flutterwave modal
  description: string;
  logo?: string;
}

export interface PayResult {
  status: "success" | "failed" | "closed";
  message?: string;
}

/**
 * One entry point for every payment on the site.
 *
 * 1. Writes a `payments` row holding the amount WE expect. The browser never
 *    gets to decide what was owed.
 * 2. Opens Flutterwave.
 * 3. Hands the transaction to the verify-payment Edge Function, which asks
 *    Flutterwave directly and is the only thing that can mark anything paid.
 */
export async function startPayment(args: PayArgs): Promise<PayResult> {
  const publicKey = import.meta.env.VITE_FLW_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    return { status: "failed", message: "Payment isn't configured yet. Contact the youth office." };
  }

  await loadFlutterwave();

  const txRef = `DYO-${args.purpose.toUpperCase()}-${args.referenceId.slice(0, 8)}-${Date.now()}`;

  // The RPC re-reads the real amount from the order/registration row, so a
  // tampered price in the browser is simply ignored.
  const { error: intentError } = await supabase.rpc("create_payment_intent", {
    p_purpose: args.purpose,
    p_reference_id: args.referenceId,
    p_tx_ref: txRef,
    p_amount_naira: args.amountNaira,
    p_payer_email: args.customer.email,
  });

  if (intentError) {
    return { status: "failed", message: "Couldn't start the payment. Try again." };
  }

  return new Promise<PayResult>((resolve) => {
    window.FlutterwaveCheckout({
      public_key: publicKey,
      tx_ref: txRef,
      amount: args.amountNaira,
      currency: "NGN",
      payment_options: "card,ussd,banktransfer",
      customer: {
        email: args.customer.email,
        name: args.customer.name,
        phone_number: args.customer.phone ?? "",
      },
      customizations: {
        title: args.title,
        description: args.description,
        logo: args.logo ?? "",
      },
      callback: async (payment: FlutterwaveResponse) => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", {
            body: { transaction_id: payment.transaction_id, tx_ref: txRef },
          });
          if (error || (data?.status !== "success" && data?.status !== "already_verified")) {
            resolve({ status: "failed", message: "We couldn't confirm that payment. If you were debited, send your receipt to the youth office and it will be applied." });
          } else {
            resolve({ status: "success" });
          }
        } catch {
          resolve({ status: "failed", message: "We couldn't confirm that payment yet. Check back in a few minutes." });
        }
      },
      onclose: () => resolve({ status: "closed" }),
    });
  });
}

export const naira = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString("en-NG")}`;