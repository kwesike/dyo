import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Content.css";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [more, setMore] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("blog_posts")
        .select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      setPost(data);

      if (data) {
        const { data: others } = await supabase.from("blog_posts")
          .select("id, slug, title, cover_url, category")
          .eq("is_published", true).neq("id", data.id)
          .order("published_at", { ascending: false }).limit(3);
        setMore(others ?? []);
      }
      setLoading(false);
      window.scrollTo(0, 0);
    })();
  }, [slug]);

  if (loading) {
    return <div className="content-page"><Navbar /><p className="content-status">Loading…</p></div>;
  }

  if (!post) {
    return (
      <div className="content-page">
        <Navbar />
        <div className="content-status">
          <h2>We can't find that post</h2>
          <p><Link to="/blog">Back to the blog</Link></p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="content-page">
      <Navbar />

      <article className="post">
        <Link to="/blog" className="post-back">← All posts</Link>

        <p className="blog-meta">
          {post.category}
          {post.published_at &&
            ` · ${new Date(post.published_at).toLocaleDateString("en-NG",
              { day: "numeric", month: "long", year: "numeric" })}`}
          {post.reading_minutes ? ` · ${post.reading_minutes} min read` : ""}
        </p>

        <h1>{post.title}</h1>
        {post.author_name && <p className="post-author">By {post.author_name}</p>}

        {post.cover_url && <img className="post-cover" src={post.cover_url} alt="" />}

        <div className="post-body">
          {post.body.split(/\n{2,}/).map((para: string, i: number) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>

      {more.length > 0 && (
        <section className="content-body">
          <h2 className="post-more-title">More from the youth office</h2>
          <div className="blog-grid">
            {more.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="blog-card">
                {p.cover_url && <img src={p.cover_url} alt="" loading="lazy" />}
                <div className="blog-card-body">
                  <p className="blog-meta">{p.category}</p>
                  <h3>{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}