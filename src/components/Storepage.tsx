import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { naira } from "../lib/Payments";
import { useCart } from "./Cartcontext";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Store.css";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  price_naira: number;
  images: string[];
  product_variants: { id: string; label: string; stock: number }[];
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const { count } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*, product_variants(id, label, stock)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const categories = ["All", ...Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[]),
  )];

  const shown = category === "All"
    ? products
    : products.filter((p) => p.category === category);

  const soldOut = (p: Product) =>
    p.product_variants.length > 0 &&
    p.product_variants.every((v) => v.stock <= 0);

  return (
    <div className="store">
      <Navbar />

      <header className="store-head">
        <div>
          <p className="store-eyebrow">Diocesan Youth Organization</p>
          <h1>The store</h1>
          <p className="store-sub">
            Programme polos, wristbands and books. Pay online, collect at your
            archdeaconry or have it delivered.
          </p>
        </div>
        <Link to="/cart" className="store-cart">
          Cart{count > 0 && <span className="store-cart-badge">{count}</span>}
        </Link>
      </header>

      {categories.length > 2 && (
        <nav className="store-filters">
          {categories.map((c) => (
            <button key={c}
                    className={c === category ? "is-active" : ""}
                    onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </nav>
      )}

      {loading ? (
        <p className="store-status">Loading the shelves…</p>
      ) : shown.length === 0 ? (
        <div className="store-status">
          <h2>Nothing on sale right now</h2>
          <p>New items go up ahead of each programme. Check back soon.</p>
        </div>
      ) : (
        <div className="store-grid">
          {shown.map((p) => (
            <Link key={p.id} to={`/store/${p.slug}`} className="store-card">
              <div className="store-card-image">
                {p.images[0]
                  ? <img src={p.images[0]} alt={p.name} loading="lazy" />
                  : <div className="store-card-placeholder">{p.name.slice(0, 1)}</div>}
                {soldOut(p) && <span className="store-tag">Sold out</span>}
              </div>
              <h3>{p.name}</h3>
              <p className="store-price">{naira(p.price_naira)}</p>
            </Link>
          ))}
        </div>
      )}

      <SiteFooter />
    </div>
  );
}