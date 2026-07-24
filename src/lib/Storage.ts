import { supabase } from "./supabaseClient";

const slugifyFilename = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");

/** Uploads a file and hands back its public URL. */
export async function uploadPublicFile(
  bucket: "programme-media" | "product-images" | "member-photos",
  file: File,
  folder = "",
): Promise<string> {
  const path = `${folder ? `${folder}/` : ""}${Date.now()}-${slugifyFilename(file.name)}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "31536000", upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Turns a title into a URL slug, e.g. "Family Weekend 2026" → "family-weekend-2026". */
export const slugify = (text: string) =>
  text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");