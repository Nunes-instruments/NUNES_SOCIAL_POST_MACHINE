"use client";
import { useEffect, useState } from "react";

export default function PostsPage() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch("/api/posts").then(r => r.json()).then(j => setPosts(j.posts || [])).catch(() => {});
  }, []);

  return (
    <main>
      <header className="topbar">
        <div><span className="eyebrow">NUNES INSTRUMENTS</span><h1>Published Posts</h1></div>
        <a className="secondaryBtn" href="/">Back</a>
      </header>
      <section className="panel">
        {posts.length ? posts.map(p => (
          <div className="historyRow" key={p.id || p.url}>
            <div><strong>{p.topic || p.product}</strong><span>{p.channel} • {p.publishedAt}</span></div>
            <span>{p.external?.status || "ARCHIVED"}</span>
          </div>
        )) : <div className="empty">No persisted posts yet.</div>}
      </section>
    </main>
  );
}
