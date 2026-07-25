import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Navbar from "./Navbar";
import SiteFooter from "./Sitefooter";
import "./Content.css";

/**
 * Renders a custom page created in /admin/pages at /p/:slug.
 *
 * This is what lets an admin add, say, an "About us" or "Constitution" page
 * to the site without anyone touching the code. The body is stored as plain
 * text with blank lines between paragraphs, same as the blog.
 */
export default function SitePage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("site_pages")
        .select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      setPage(data);
      setLoading(false);
      window.scrollTo(0, 0);
    })();
  }, [slug]);

  if (loading) {
    return <div className="content-page"><Navbar /><p className="content-status">Loading…</p></div>;
  }

  if (!page) {
    return (
      <div className="content-page">
        <Navbar />
        <div className="content-status">
          <h2>We can't find that page</h2>
          <p><Link to="/">Back to the home page</Link></p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="content-page">
      <Navbar />

      <article className="post">
        <Link to="/" className="post-back">← Home</Link>
        <h1>{page.title}</h1>
        {page.cover_url && <img className="post-cover" src={page.cover_url} alt="" />}
        <div className="post-body">
          {page.body.split(/\n{2,}/).map((para: string, i: number) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}