import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface CartLine {
  key: string;             // product_id + variant_id
  product_id: string;
  variant_id: string | null;
  name: string;
  variant_label: string | null;
  unit_price_naira: number;
  image: string | null;
  quantity: number;
  max_stock: number | null;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "dyo.cart.v1";
const CartContext = createContext<CartValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartValue>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + l.quantity * l.unit_price_naira, 0),

    add: (line) => {
      const key = `${line.product_id}:${line.variant_id ?? "base"}`;
      setLines((prev) => {
        const found = prev.find((l) => l.key === key);
        if (!found) return [...prev, { ...line, key }];
        const ceiling = found.max_stock ?? Infinity;
        return prev.map((l) =>
          l.key === key
            ? { ...l, quantity: Math.min(ceiling, l.quantity + line.quantity) }
            : l,
        );
      });
    },

    setQuantity: (key, quantity) =>
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.key !== key)
          : prev.map((l) =>
              l.key === key
                ? { ...l, quantity: Math.min(l.max_stock ?? Infinity, quantity) }
                : l,
            ),
      ),

    remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
    clear: () => setLines([]),
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>.");
  return ctx;
}