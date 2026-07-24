/**
 * src/types/flutterwave.ts
 *
 * NOT a .d.ts file — a plain .ts module. Declaration files are meant to
 * describe things, not to be imported from, and some setups won't resolve
 * `from "../types/flutterwave"` to a `.d.ts`. A normal module always resolves.
 *
 * The `declare global` block below still applies project-wide, because any
 * file inside `src` is part of the compilation. You do NOT need to import
 * this file to get `window.FlutterwaveCheckout` typed.
 *
 * Delete the `declare global { interface Window { FlutterwaveCheckout: any } }`
 * block from components/PaymentPage.tsx — that duplicate is what caused TS2717.
 */

export interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  redirect_url?: string;
  meta?: Record<string, unknown>;
  customer: {
    email: string;
    name?: string;
    phone_number?: string;
  };
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  callback?: (payment: FlutterwaveResponse) => void | Promise<void>;
  onclose?: () => void;
}

export interface FlutterwaveResponse {
  status?: string;
  transaction_id?: number | string;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    FlutterwaveCheckout: (config: FlutterwaveConfig) => void;
  }

  // The script also exposes it bare, which is how DonationPage calls it.
  // With this declared you can drop the `//@ts-ignore` in that file.
  function FlutterwaveCheckout(config: FlutterwaveConfig): void;
}