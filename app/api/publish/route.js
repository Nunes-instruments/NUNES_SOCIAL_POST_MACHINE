import { cookies } from "next/headers";
import { put } from "@vercel/blob";
import { cookieName, unseal, readConfig } from "../../lib/oauth-store";

export const runtime = "nodejs";

async function tokenFor(platform) {
  const jar = await cookies();
  return unseal(jar.get(cookieName(platform))?.value);
}

async function archive(body, external) {
  const post = {
    id: crypto.randomUUID(),
    topic: String(body.topic || body.product || "Post").slice(0, 220),
    channel: String(body.channel || "").slice(0, 40),
    text: String(body.text || "").slice(0, 8000),
    mediaUrl: String(body.mediaUrl || "").slice(0, 2000),
    angle: String(body.angle || "").slice(0, 100),
    publishedAt: new Date().toISOString(),
    external
  };

  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ...post, url: null };

  const blob = await put(
    `posts/${Date.now()}-${post.id}.json`,
    JSON.stringify(post),
    { access: "public", addRandomSuffix: false, contentType: "application/json" }
  );

  return { ...post, url: blob.url };
}

async function postLinkedIn(body, token, config) {
  if (!token?.access_token) return { status: "NOT_CONNECTED" };
  const author = config?.accountId || process.env.LINKEDIN_AUTHOR_URN;
  if (!author) return { status: "ACCOUNT_ID_REQUIRED", error: "Set LINKEDIN_AUTHOR_URN." };

  const r = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": "202606"
    },
    body: JSON.stringify({
      author,
      commentary: body.text,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    })
  });

  const text = await r.text();
  return {
    status: r.ok ? "POSTED" : "FAILED",
    httpStatus: r.status,
    externalId: r.headers.get("x-restli-id") || null,
    error: r.ok ? null : text.slice(0, 800)
  };
}

async function postX(body, token) {
  if (!token?.access_token) return { status: "NOT_CONNECTED" };
  const r = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text })
  });
  const data = await r.json().catch(() => ({}));
  return {
    status: r.ok ? "POSTED" : "FAILED",
    httpStatus: r.status,
    externalId: data?.data?.id || null,
    error: r.ok ? null : JSON.stringify(data).slice(0, 800)
  };
}

async function postFacebook(body, token, config) {
  if (!token?.access_token) return { status: "NOT_CONNECTED" };
  const pageId = config?.accountId || process.env.FACEBOOK_PAGE_ID;
  if (!pageId) return { status: "ACCOUNT_ID_REQUIRED", error: "Set FACEBOOK_PAGE_ID." };

  const data = new URLSearchParams({ message: body.text, access_token: token.access_token });
  const r = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: data
  });

  const j = await r.json().catch(() => ({}));
  return {
    status: r.ok ? "POSTED" : "FAILED",
    httpStatus: r.status,
    externalId: j.id || null,
    error: r.ok ? null : JSON.stringify(j).slice(0, 800)
  };
}

async function postBluesky(body) {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return { status: "NOT_CONNECTED" };

  const sessionResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password })
  });

  const session = await sessionResponse.json().catch(() => ({}));
  if (!session.accessJwt) return { status: "FAILED", error: "Bluesky login failed." };

  const r = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        "$type": "app.bsky.feed.post",
        text: body.text,
        createdAt: new Date().toISOString()
      }
    })
  });

  const j = await r.json().catch(() => ({}));
  return {
    status: r.ok ? "POSTED" : "FAILED",
    externalId: j.uri || null,
    error: r.ok ? null : JSON.stringify(j).slice(0, 800)
  };
}

async function externalPublish(body) {
  if (body.channel === "Bluesky") return postBluesky(body);

  const token = await tokenFor(body.channel);
  const jar = await cookies();
  const cfg = readConfig(jar, String(body.channel||"").toLowerCase());
  if (body.channel === "LinkedIn") return postLinkedIn(body, token, cfg);
  if (body.channel === "X") return postX(body, token);
  if (body.channel === "Facebook") return postFacebook(body, token, cfg);

  if (!token?.access_token) return { status: "NOT_CONNECTED" };

  if (body.channel === "Instagram" && !body.mediaUrl) {
    return { status: "MEDIA_REQUIRED", error: "Instagram requires a public image/video URL." };
  }

  return {
    status: "CONNECTED_NOT_IMPLEMENTED",
    error: "This account is connected, but this platform's final media/account-specific publish call still needs to be completed."
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!String(body.channel || "").trim() || !String(body.text || "").trim()) {
      return Response.json({ ok: false, error: "Missing channel or text" }, { status: 400 });
    }

    const external = await externalPublish(body);
    const post = await archive(body, external);
    return Response.json({ ok: true, post, external });
  } catch {
    return Response.json({ ok: false, error: "Publishing failed" }, { status: 500 });
  }
}
