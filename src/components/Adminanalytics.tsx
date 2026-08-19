import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Site analytics dashboard — total visits, per-day trend, top pages,
 * views by section, and most-viewed tournaments/programmes. All from
 * our own page_views table (no third-party analytics).
 */
export default function AdminAnalytics() {
  const [totals, setTotals] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [topPaths, setTopPaths] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);
  const [topTourneys, setTopTourneys] = useState<any[]>([]);
  const [topProgs, setTopProgs] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [days]);

  async function load() {
    setLoading(true);
    const [t, d, p, ty, tt, tp] = await Promise.all([
      supabase.rpc("analytics_totals"),
      supabase.rpc("analytics_daily", { p_days: days }),
      supabase.rpc("analytics_top_paths", { p_limit: 15 }),
      supabase.rpc("analytics_by_type"),
      supabase.rpc("analytics_top_content", { p_type: "tournament", p_limit: 8 }),
      supabase.rpc("analytics_top_content", { p_type: "programme", p_limit: 8 }),
    ]);
    setTotals(t.data?.[0] ?? null);
    setDaily(d.data ?? []);
    setTopPaths(p.data ?? []);
    setByType(ty.data ?? []);
    setTopTourneys(tt.data ?? []);
    setTopProgs(tp.data ?? []);
    setLoading(false);
  }

  if (loading) return <div className="p-6">Loading analytics…</div>;

  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.views)));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Site traffic</h1>
      <p className="text-gray-600 mb-6">How people are visiting the site.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total views", value: totals?.total_views ?? 0 },
          { label: "Unique visitors", value: totals?.unique_visitors ?? 0 },
          { label: "Today", value: totals?.today_views ?? 0 },
          { label: "Last 7 days", value: totals?.week_views ?? 0 },
        ].map((s) => (
          <div key={s.label} className="border rounded-lg p-4">
            <p className="text-xs uppercase text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{Number(s.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Daily trend — simple bar chart */}
      <div className="border rounded-lg p-4 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Views per day</h2>
          <select className="border rounded px-2 py-1 text-sm" value={days}
                  onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        {daily.length === 0 ? (
          <p className="text-gray-500 text-sm">No views recorded yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative">
                <div className="w-full bg-[#800000] rounded-t hover:bg-[#a00000]"
                     style={{ height: `${(Number(d.views) / maxDaily) * 100}%`, minHeight: 2 }} />
                <span className="absolute -top-6 text-xs bg-black text-white px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {new Date(d.day).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}: {d.views}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* By section */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Views by section</h2>
          {byType.map((t) => {
            const max = Math.max(1, ...byType.map((x) => Number(x.views)));
            return (
              <div key={t.page_type} className="mb-2">
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="capitalize">{t.page_type}</span>
                  <span className="text-gray-500">{t.views}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-[#800000] rounded" style={{ width: `${(Number(t.views) / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top pages */}
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Most-visited pages</h2>
          <div className="grid gap-1 text-sm">
            {topPaths.map((p) => (
              <div key={p.path} className="flex justify-between border-b py-1">
                <span className="truncate mr-2">{p.path}</span>
                <span className="text-gray-500 flex-shrink-0">{p.views}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top content */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Most-viewed tournaments</h2>
          {topTourneys.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> :
            topTourneys.map((t) => (
              <div key={t.ref_slug} className="flex justify-between border-b py-1 text-sm">
                <span>{t.ref_slug}</span><span className="text-gray-500">{t.views}</span>
              </div>
            ))}
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Most-viewed programmes</h2>
          {topProgs.length === 0 ? <p className="text-gray-500 text-sm">No data yet.</p> :
            topProgs.map((t) => (
              <div key={t.ref_slug} className="flex justify-between border-b py-1 text-sm">
                <span>{t.ref_slug}</span><span className="text-gray-500">{t.views}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}