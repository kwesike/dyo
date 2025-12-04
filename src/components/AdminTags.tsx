import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminTags() {
  const [tags, setTags] = useState<any[]>([]);
  const [archdeaconries, setArchdeaconries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedArch, setSelectedArch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
    loadArchdeaconries();
  }, []);

  //  Load all admin tags from Supabase bucket
  const loadTags = async () => {
    setLoading(true);

    const { data, error } = await supabase.storage
      .from("tags")
      .list("admin_tags", { limit: 500 });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setTags(data || []);
    setLoading(false);
  };

  //  Pull unique archdeaconries from database
  const loadArchdeaconries = async () => {
    const { data } = await supabase
      .from("registrations")
      .select("archdeaconry");

    if (data) {
      const unique = Array.from(
        new Set(data.map((x) => x.archdeaconry).filter(Boolean))
      );
      setArchdeaconries(unique);
    }
  };

  const getPublicUrl = (name: string) => {
    return supabase.storage.from("tags").getPublicUrl(`admin_tags/${name}`).data.publicUrl;
  };

  const handlePrint = (imageUrl: string) => {
    const win = window.open("", "_blank");
    win!.document.write(`<img src="${imageUrl}" style="width:100%">`);
    win!.print();
  };

  const handlePrintAll = () => {
    const win = window.open("", "_blank");

    filteredTags.forEach((file) => {
      const url = getPublicUrl(file.name);
      win!.document.write(`<img src="${url}" style="width:100%; margin-bottom:20px">`);
    });

    win!.print();
  };

  //  Filtering Logic
  const filteredTags = tags.filter((file) => {
    const lower = file.name.toLowerCase();
    const matchesSearch = lower.includes(search.toLowerCase());
    const matchesArch =
      selectedArch === "" || lower.includes(selectedArch.toLowerCase());

    return matchesSearch && matchesArch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-4">All Convention Tags</h1>

      {/*  Search + Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name..."
          className="border px-3 py-2 rounded w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border px-3 py-2 rounded w-full sm:w-1/3"
          value={selectedArch}
          onChange={(e) => setSelectedArch(e.target.value)}
        >
          <option value="">Filter by Archdeaconry</option>
          {archdeaconries.map((arch) => (
            <option key={arch} value={arch}>
              {arch}
            </option>
          ))}
        </select>
      </div>

      {/*  Print All */}
      <button
        onClick={handlePrintAll}
        className="bg-green-600 text-white px-4 py-2 rounded mb-4"
      >
        Print All Filtered Tags
      </button>

      {loading ? (
        <p>Loading tags...</p>
      ) : filteredTags.length === 0 ? (
        <p>No tags found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredTags.map((file) => (
            <div key={file.name} className="border p-3 rounded shadow">
              <img
                src={getPublicUrl(file.name)}
                alt="Tag"
                className="w-full rounded"
              />

              <p className="mt-2 font-semibold text-center text-sm truncate">
                {file.name}
              </p>

              <button
                onClick={() => handlePrint(getPublicUrl(file.name))}
                className="bg-blue-600 text-white px-3 py-1 rounded mt-2 w-full"
              >
                Print Tag
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
