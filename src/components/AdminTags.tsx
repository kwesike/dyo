import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Convention tags — names and faces of every registrant.
 *
 * The original version called getPublicUrl on a public bucket, which meant
 * anyone who guessed a filename could fetch a tag without signing in. Run
 * supabase/lock-down-tags.sql to make the bucket private; this version asks
 * for signed URLs, which only work for a signed-in admin and expire after an
 * hour.
 */

const SIGNED_URL_TTL = 60 * 60; // one hour

interface TagFile {
  name: string;
  url: string;
}

export default function AdminTags() {
  const [tags, setTags] = useState<TagFile[]>([]);
  const [archdeaconries, setArchdeaconries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedArch, setSelectedArch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadTags();
    void loadArchdeaconries();
  }, []);

  async function loadTags() {
    setLoading(true);
    setError("");

    const { data, error: listError } = await supabase.storage
      .from("tags")
      .list("admin_tags", { limit: 500, sortBy: { column: "name", order: "asc" } });

    if (listError) {
      setError("Couldn't load the tags. Your session may have expired — try signing in again.");
      setLoading(false);
      return;
    }

    const files = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));

    // One request for all of them rather than one per tile.
    const { data: signed, error: signError } = await supabase.storage
      .from("tags")
      .createSignedUrls(files.map((f) => `admin_tags/${f.name}`), SIGNED_URL_TTL);

    if (signError) {
      setError("Couldn't get access to the tag images.");
      setLoading(false);
      return;
    }

    setTags(
      (signed ?? [])
        .filter((s) => s.signedUrl)
        .map((s) => ({
          name: (s.path ?? "").replace("admin_tags/", ""),
          url: s.signedUrl as string,
        })),
    );
    setLoading(false);
  }

  async function loadArchdeaconries() {
    const { data } = await supabase.from("profiles").select("archdeaconry");
    if (data) {
      setArchdeaconries(
        Array.from(new Set(data.map((x) => x.archdeaconry).filter(Boolean) as string[])).sort(),
      );
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const arch = selectedArch.toLowerCase();
    return tags.filter((f) => {
      const name = f.name.toLowerCase();
      return name.includes(q) && (!arch || name.includes(arch));
    });
  }, [tags, search, selectedArch]);

  /**
   * Printing via document.write on a new window races the image loads —
   * print() often fires before anything has rendered, giving blank pages.
   * A hidden iframe that waits for every image is reliable.
   */
  async function print(urls: string[]) {
    if (urls.length === 0) return;

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);

    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`
      <style>
        @page { margin: 10mm; }
        body { margin: 0; }
        img { width: 100%; display: block; page-break-after: always; }
        img:last-child { page-break-after: auto; }
      </style>
      ${urls.map((u) => `<img src="${u}">`).join("")}
    `);
    doc.close();

    const images = Array.from(doc.images);
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => { img.onload = res; img.onerror = res; }),
      ),
    );

    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-end gap-3 mb-1">
        <h1 className="text-2xl font-bold">Convention tags</h1>
        <button onClick={loadTags} className="underline text-sm">Refresh</button>
      </div>
      <p className="text-gray-600 text-sm mb-5">
        {tags.length} tags · links expire after an hour, so refresh if images stop loading.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name…"
          className="border px-3 py-2 rounded w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border px-3 py-2 rounded w-full sm:w-1/3"
          value={selectedArch}
          onChange={(e) => setSelectedArch(e.target.value)}
        >
          <option value="">Every archdeaconry</option>
          {archdeaconries.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <button
        onClick={() => print(filtered.map((f) => f.url))}
        disabled={filtered.length === 0}
        className="bg-green-700 text-white px-4 py-2 rounded mb-5 disabled:opacity-50"
      >
        Print these {filtered.length} tags
      </button>

      {error && (
        <p className="text-sm border-l-4 border-red-600 bg-red-50 px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p>Loading tags…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No tags match that.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map((file) => (
            <div key={file.name} className="border p-3 rounded shadow-sm">
              <img src={file.url} alt="" className="w-full rounded" loading="lazy" />
              <p className="mt-2 font-semibold text-center text-sm truncate" title={file.name}>
                {file.name}
              </p>
              <button
                onClick={() => print([file.url])}
                className="bg-blue-600 text-white px-3 py-1 rounded mt-2 w-full"
              >
                Print this tag
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}