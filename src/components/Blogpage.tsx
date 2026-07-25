import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Content.css";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  category: string | null;
  author_name: string | null;
  published_at: string | null;
  reading_minutes: number | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, category, author_name, published_at, reading_minutes")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const categories = ["All", ...Array.from(
    new Set(posts.map((p) => p.category).filter(Boolean) as string[]))];

  const shown = category === "All" ? posts : posts.filter((p) => p.category === category);
  const [lead, ...rest] = shown;

  return (
    <div className="content-page">
      <Navbar />

      <header className="content-head">
        <p className="content-eyebrow">Ibadan North Diocese</p>
        <h1>From the youth office</h1>
        <p>Reflections, teaching and reports from what we've been doing.</p>
      </header>

      <div className="content-body">
        {loading ? (
          <p className="content-status">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="content-status">
            <h2>Nothing published yet</h2>
            <p>Come back soon.</p>
          </div>
        ) : (
          <>
            {categories.length > 2 && (
              <nav className="content-filters">
                {categories.map((c) => (
                  <button key={c} className={c === category ? "is-active" : ""}
                          onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </nav>
            )}

            {lead && (
              <Link to={`/blog/${lead.slug}`} className="blog-lead">
                {lead.cover_url && <img src={lead.cover_url} alt="" />}
                <div>
                  <p className="blog-meta">
                    {lead.category}
                    {lead.published_at &&
                      ` · ${new Date(lead.published_at).toLocaleDateString("en-NG",
                        { day: "numeric", month: "long", year: "numeric" })}`}
                  </p>
                  <h2>{lead.title}</h2>
                  {lead.excerpt && <p className="blog-excerpt">{lead.excerpt}</p>}
                  <span className="blog-more">Read it →</span>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="blog-grid">
                {rest.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="blog-card">
                    {post.cover_url && <img src={post.cover_url} alt="" loading="lazy" />}
                    <div className="blog-card-body">
                      <p className="blog-meta">
                        {post.category}
                        {post.reading_minutes ? ` · ${post.reading_minutes} min` : ""}
                      </p>
                      <h3>{post.title}</h3>
                      {post.excerpt && <p className="blog-excerpt">{post.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}