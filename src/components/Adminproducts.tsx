import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { slugify, uploadPublicFile } from "./../lib/Storage";
import { naira } from "./../lib/Payments";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL"];

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", description: "", category: "Apparel",
    price_naira: 0, programme_id: "", images: [] as string[],
  });
  const [sizes, setSizes] = useState<{ label: string; stock: number }[]>(
    DEFAULT_SIZES.map((label) => ({ label, stock: 0 })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from("products")
        .select("*, product_variants(id, label, stock)")
        .order("created_at", { ascending: false }),
      supabase.from("programmes").select("id, title").order("starts_at", { ascending: false }),
    ]);
    setProducts(p ?? []);
    setProgrammes(pr ?? []);
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) =>
          uploadPublicFile("product-images", f, slugify(form.name || "product"))),
      );
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      setMessage((err as Error).message);
    }
    setBusy(false);
  }

  async function createProduct() {
    if (!form.name.trim() || !form.price_naira) {
      return setMessage("A name and a price are required.");
    }
    setBusy(true);
    setMessage("");

    const { data: product, error } = await supabase.from("products").insert({
      name: form.name.trim(),
      slug: slugify(form.name),
      description: form.description.trim() || null,
      category: form.category,
      price_naira: Number(form.price_naira),
      images: form.images,
      programme_id: form.programme_id || null,
      is_active: true,
    }).select().single();

    if (error || !product) {
      setBusy(false);
      return setMessage(error?.code === "23505"
        ? "An item with that name already exists."
        : "Couldn't create the item.");
    }

    const stocked = sizes.filter((s) => s.label.trim());
    if (stocked.length) {
      await supabase.from("product_variants").insert(
        stocked.map((s) => ({
          product_id: product.id,
          label: s.label.trim(),
          stock: Number(s.stock) || 0,
          sku: `${slugify(form.name)}-${slugify(s.label)}`,
        })),
      );
    }

    setBusy(false);
    setMessage(`${product.name} is now on sale.`);
    setForm({ name: "", description: "", category: "Apparel",
              price_naira: 0, programme_id: "", images: [] });
    setSizes(DEFAULT_SIZES.map((label) => ({ label, stock: 0 })));
    void load();
  }

  async function updateStock(variantId: string, stock: number) {
    await supabase.from("product_variants").update({ stock }).eq("id", variantId);
    void load();
  }

  async function toggleActive(product: any) {
    await supabase.from("products")
      .update({ is_active: !product.is_active }).eq("id", product.id);
    void load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Store items</h1>
      <p className="text-gray-600 mb-6">
        Polos, wristbands, books. Stock counts drop automatically when an order is paid for.
      </p>

      <div className="border rounded-lg p-5 mb-10 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">New item</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Item name, e.g. Convention Polo 2026"
                 value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-3 py-2" type="number" placeholder="Price in naira"
                 value={form.price_naira || ""}
                 onChange={(e) => setForm({ ...form, price_naira: Number(e.target.value) })} />
          <select className="border rounded px-3 py-2" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option>Apparel</option><option>Books</option>
            <option>Accessories</option><option>Media</option>
          </select>
          <select className="border rounded px-3 py-2" value={form.programme_id}
                  onChange={(e) => setForm({ ...form, programme_id: e.target.value })}>
            <option value="">Not tied to a programme</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <textarea className="border rounded px-3 py-2 w-full mt-3" rows={3}
                  placeholder="Describe it — fabric, fit, what it's for"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div className="mt-4">
          <p className="text-sm font-medium mb-1">Photos</p>
          <input type="file" accept="image/*" multiple onChange={(e) => addImages(e.target.files)} />
          <div className="flex gap-2 mt-2 flex-wrap">
            {form.images.map((src) => (
              <img key={src} src={src} alt="" className="w-20 h-20 object-cover rounded border" />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium mb-2">Sizes and stock</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s, i) => (
              <div key={i} className="border rounded px-2 py-1 flex items-center gap-2">
                <input className="w-14 outline-none" value={s.label}
                       onChange={(e) => setSizes(sizes.map((x, idx) =>
                         idx === i ? { ...x, label: e.target.value } : x))} />
                <input className="w-16 border-l pl-2 outline-none" type="number" value={s.stock}
                       onChange={(e) => setSizes(sizes.map((x, idx) =>
                         idx === i ? { ...x, stock: Number(e.target.value) } : x))} />
              </div>
            ))}
            <button className="underline text-sm"
                    onClick={() => setSizes([...sizes, { label: "", stock: 0 }])}>
              Add a size
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Leave every stock at 0 for a pre-order item and raise it once stock lands.
          </p>
        </div>

        {message && <p className="mt-3 text-sm">{message}</p>}

        <button onClick={createProduct} disabled={busy}
                className="bg-[#800000] text-white px-5 py-2 rounded mt-4">
          {busy ? "Working…" : "Put it on sale"}
        </button>
      </div>

      <h2 className="font-semibold mb-3">On sale</h2>
      <div className="grid gap-3">
        {products.map((p) => (
          <div key={p.id} className="border rounded p-4 flex flex-wrap gap-4 items-center">
            {p.images?.[0] && (
              <img src={p.images[0]} alt="" className="w-14 h-14 object-cover rounded" />
            )}
            <div className="flex-1 min-w-[180px]">
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-gray-500">{naira(p.price_naira)} · {p.category}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {p.product_variants?.map((v: any) => (
                <label key={v.id} className="text-xs border rounded px-2 py-1">
                  {v.label}
                  <input className="w-12 ml-1 text-right" type="number" defaultValue={v.stock}
                         onBlur={(e) => updateStock(v.id, Number(e.target.value))} />
                </label>
              ))}
            </div>
            <button onClick={() => toggleActive(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
              {p.is_active ? "On sale" : "Hidden"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}