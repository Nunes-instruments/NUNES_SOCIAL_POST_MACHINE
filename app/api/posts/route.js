import { list } from "@vercel/blob";
export const runtime = "nodejs";

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: true, posts: [] });
  }

  try {
    const { blobs } = await list({ prefix: "posts/" });
    const posts = [];
    for (const blob of blobs.slice(-100).reverse()) {
      try {
        const r = await fetch(blob.url, { cache: "no-store" });
        posts.push(await r.json());
      } catch {}
    }
    return Response.json({ ok: true, posts });
  } catch {
    return Response.json({ ok: true, posts: [] });
  }
}
