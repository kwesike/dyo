import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./../lib/supabaseClient";
import { naira } from "./../lib/Payments";
import { useCart } from "./Cartcontext";
import "./Store.css";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { add } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*, product_variants(id, label, stock, price_override_naira)")
        .eq("slug", slug)
        .maybeSingle();
      setProduct(data);
      const first = data?.product_variants?.find((v: any) => v.stock > 0);
      setVariantId(first?.id ?? null);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <p className="store-status">Loading…</p>;
  if (!product) {
    return (
      <div className="store-status">
        <h2>We can't find that item</h2>
        <p><Link to="/store">Back to the store</Link></p>
      </div>
    );
  }

  const variants = product.product_variants ?? [];
  const variant = variants.find((v: any) => v.id === variantId);
  const price = variant?.price_override_naira ?? product.price_naira;
  const stock = variant ? variant.stock : null;
  const unavailable = variants.length > 0 && (!variant || variant.stock <= 0);

  const addToCart = () => {
    add({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      name: product.name,
      variant_label: variant?.label ?? null,
      unit_price_naira: price,
      image: product.images?.[0] ?? null,
      quantity,
      max_stock: stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="product">
      <Link to="/store" className="product-back">← All items</Link>

      <div className="product-layout">
        <div className="product-gallery">
          <img className="product-image"
               src={product.images?.[activeImage] ?? ""}
               alt={product.name} />
          {product.images?.length > 1 && (
            <div className="product-thumbs">
              {product.images.map((src: string, i: number) => (
                <button key={src}
                        className={i === activeImage ? "is-active" : ""}
                        onClick={() => setActiveImage(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="product-price">{naira(price)}</p>
          <p className="product-description">{product.description}</p>

          {variants.length > 0 && (
            <div className="product-variants">
              <span className="product-label">Size</span>
              <div className="product-chips">
                {variants.map((v: any) => (
                  <button key={v.id}
                          disabled={v.stock <= 0}
                          className={v.id === variantId ? "is-active" : ""}
                          onClick={() => { setVariantId(v.id); setQuantity(1); }}>
                    {v.label}
                  </button>
                ))}
              </div>
              {variant && variant.stock > 0 && variant.stock <= 5 && (
                <p className="product-stock">Only {variant.stock} left in {variant.label}</p>
              )}
            </div>
          )}

          <div className="product-quantity">
            <span className="product-label">Quantity</span>
            <div className="product-stepper">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span>{quantity}</span>
              <button onClick={() =>
                setQuantity((q) => Math.min(stock ?? 99, q + 1))}>+</button>
            </div>
          </div>

          <button className="product-add" onClick={addToCart} disabled={unavailable}>
            {unavailable ? "Sold out" : added ? "Added to cart" : "Add to cart"}
          </button>
          <button className="product-buy" onClick={() => { addToCart(); navigate("/cart"); }}
                  disabled={unavailable}>
            Buy it now
          </button>

          <p className="product-fineprint">
            Collect free at your archdeaconry, or add delivery at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}