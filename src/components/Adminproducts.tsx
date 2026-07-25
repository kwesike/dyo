import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { slugify, uploadPublicFile } from "./../lib/Storage";
import { naira } from "./../lib/Payments";

interface Variant { id?: string; label: string; stock: number; }

const BLANK = {
  name: "", description: "", category: "", price_naira: "",
  images: [] as string[], is_active: true,
  variants: [] as Variant[],
};

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(id, label, stock)")
      .order("created_at", { ascending: false });
    setProducts(data ?? []);
  }

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  async function addImage(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicFile("product-images", file, slugify(form.name || "product"));
      set("images", [...form.images, url]);
    } catch (err) {
      setMessage((err as Error).message);
    }
    setUploading(false);
  }

  const addVariant = () =>
    set("variants", [...form.variants, { label: "", stock: 0 }]);
  const updateVariant = (i: number, patch: Partial<Variant>) =>
    set("variants", form.variants.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  const removeVariant = (i: number) =>
    set("variants", form.variants.filter((_, idx) => idx !== i));

  function startEdit(p: any) {
    setEditing(p.id);
    setForm({
      name: p.name, description: p.description ?? "", category: p.category ?? "",
      price_naira: String(p.price_naira ?? ""),
      images: p.images ?? [], is_active: p.is_active,
      variants: (p.product_variants ?? []).map((v: any) => ({
        id: v.id, label: v.label, stock: v.stock,
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.name.trim()) return setMessage("Give the item a name.");
    if (!form.price_naira || Number(form.price_naira) <= 0)
      return setMessage("Set a price.");

    setSaving(true);
    setMessage("");

    const payload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      price_naira: Number(form.price_naira),
      images: form.images,
      is_active: form.is_active,
    };

    let productId = editing;

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing);
      if (error) { setSaving(false); return setMessage(error.message); }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error || !data) { setSaving(false); return setMessage(error?.message ?? "Couldn't save."); }
      productId = data.id;
    }

    // Replace variants for this product wholesale — simplest correct approach.
    if (productId) {
      await supabase.from("product_variants").delete().eq("product_id", productId);
      if (form.variants.length) {
        await supabase.from("product_variants").insert(
          form.variants
            .filter((v) => v.label.trim())
            .map((v) => ({ product_id: productId, label: v.label.trim(), stock: Number(v.stock) || 0 })),
        );
      }
    }

    setSaving(false);
    setMessage(editing ? "Item updated." : "Item added.");
    setForm({ ...BLANK });
    setEditing(null);
    void load();
  }

  /** Take an item off the shop without losing it or its order history. */
  async function toggleActive(p: any) {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    void load();
  }

  /**
   * Hard delete. Refuses if the item has been ordered — past receipts point at
   * it, and losing that breaks financial history. In that case, hide it instead.
   */
  async function remove(p: any) {
    if (!confirm(`Delete "${p.name}"? This removes the item and its sizes. This cannot be undone.`)) return;

    setDeletingId(p.id);
    setMessage("");

    await supabase.from("product_variants").delete().eq("product_id", p.id);
    const { error } = await supabase.from("products").delete().eq("id", p.id);

    setDeletingId(null);

    if (error) {
      setMessage(`"${p.name}" has been ordered before, so it can't be deleted — past receipts point at it. Use "Hide from store" instead.`);
      void load();
      return;
    }

    setMessage(`"${p.name}" was deleted.`);
    if (editing === p.id) { setEditing(null); setForm({ ...BLANK }); }
    void load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Store items</h1>
      <p className="text-gray-600 mb-6">Polos, wristbands, books — anything the organization sells.</p>

      {/* editor */}
      <div className="border rounded-lg p-5 mb-10 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">{editing ? "Edit item" : "New item"}</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Item name"
                 value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Category (e.g. Clothing)"
                 value={form.category} onChange={(e) => set("category", e.target.value)} />
          <input className="border rounded px-3 py-2" type="number" placeholder="Price in naira"
                 value={form.price_naira} onChange={(e) => set("price_naira", e.target.value)} />
        </div>

        <textarea className="border rounded px-3 py-2 w-full mt-3" rows={3}
                  placeholder="Description"
                  value={form.description} onChange={(e) => set("description", e.target.value)} />

        {/* images */}
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Photos</p>
          <div className="flex gap-2 flex-wrap mb-2">
            {form.images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="w-20 h-20 object-cover rounded" />
                <button onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs">
                  ×
                </button>
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" onChange={(e) => addImage(e.target.files?.[0])} />
          {uploading && <p className="text-xs mt-1">Uploading…</p>}
        </div>

        {/* variants */}
        <div className="mt-5">
          <div className="flex justify-between items-center mb-2">
            <p className="font-medium text-sm">Sizes / options</p>
            <button className="text-sm underline" onClick={addVariant}>Add a size</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Leave empty if the item has no sizes. Stock counts down as people buy.
          </p>
          {form.variants.map((v, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input className="border rounded px-2 py-1 flex-1" placeholder="Label (e.g. M, L, XL)"
                     value={v.label} onChange={(e) => updateVariant(i, { label: e.target.value })} />
              <input className="border rounded px-2 py-1 w-24" type="number" placeholder="Stock"
                     value={v.stock} onChange={(e) => updateVariant(i, { stock: Number(e.target.value) })} />
              <button className="text-red-600 text-sm" onClick={() => removeVariant(i)}>Remove</button>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-5 text-sm">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set("is_active", e.target.checked)} />
          Show it in the store
        </label>

        {message && <p className="mt-3 text-sm">{message}</p>}

        <div className="flex gap-3 mt-4">
          <button onClick={save} disabled={saving}
                  className="bg-[#800000] text-white px-5 py-2 rounded">
            {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ ...BLANK }); }}
                    className="px-5 py-2 rounded border">Cancel</button>
          )}
        </div>
      </div>

      {/* list */}
      <h2 className="font-semibold mb-3">All items</h2>
      <div className="grid gap-3">
        {products.map((p) => {
          const stock = (p.product_variants ?? []).reduce((n: number, v: any) => n + v.stock, 0);
          return (
            <div key={p.id} className="border rounded p-4 flex flex-wrap gap-4 items-center">
              {p.images?.[0] && <img src={p.images[0]} alt="" className="w-14 h-14 object-cover rounded" />}
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {naira(p.price_naira)}
                  {p.product_variants?.length ? ` · ${stock} in stock` : ""}
                </p>
              </div>
              <button onClick={() => toggleActive(p)}
                      className={`px-3 py-1 rounded text-sm ${
                        p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200"}`}>
                {p.is_active ? "In store" : "Hidden"}
              </button>
              <button onClick={() => startEdit(p)} className="underline text-sm">Edit</button>
              <button onClick={() => remove(p)} disabled={deletingId === p.id}
                      className="text-red-600 text-sm">
                {deletingId === p.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}