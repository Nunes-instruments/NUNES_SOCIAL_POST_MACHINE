import { cookies } from "next/headers";
import { put } from "@vercel/blob";
import { cookieName, unseal, readConfig, secretFromJar } from "../../lib/oauth-store";
import { getSharedState } from "../../lib/shared-state";

export const runtime = "nodejs";

async function tokenFor(platform) {
  const id=String(platform||"").toLowerCase();
  const shared=await getSharedState(`token:${id}`);
  if(shared?.access_token) return shared;
  const jar = await cookies();
  return unseal(jar.get(cookieName(platform))?.value, secretFromJar(jar));
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

  const grantedScopes = String(token?.scope || "").split(/[\s,]+/).filter(Boolean);
  const hasOrgPosting = grantedScopes.includes("w_organization_social") || grantedScopes.includes("rw_organization_admin");

  const configuredAuthor = config?.accountId || process.env.LINKEDIN_AUTHOR_URN || null;
  const wantsOrganization = String(configuredAuthor || "").startsWith("urn:li:organization:");

  const author = wantsOrganization && hasOrgPosting
    ? configuredAuthor
    : (token?.author_urn || configuredAuthor);

  if (!author) return {
    status: "ACCOUNT_ID_REQUIRED",
    error: "Reconnect LinkedIn once so NUNES can detect your personal author identity."
  };

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

  if (!r.ok && wantsOrganization && !hasOrgPosting && token?.author_urn) {
    const retry = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": "202606"
      },
      body: JSON.stringify({
        author: token.author_urn,
        commentary: body.text,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      })
    });
    const retryText = await retry.text();
    return {
      status: retry.ok ? "POSTED" : "FAILED",
      httpStatus: retry.status,
      externalId: retry.headers.get("x-restli-id") || null,
      fallbackUsed: true,
      authorUsed: token.author_urn,
      error: retry.ok ? null : retryText.slice(0, 800)
    };
  }

  return {
    status: r.ok ? "POSTED" : "FAILED",
    httpStatus: r.status,
    externalId: r.headers.get("x-restli-id") || null,
    authorUsed: author,
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


async function postInstagram(body, token, config) {
  if (!token?.access_token) return { status: "NOT_CONNECTED" };
  if (!body.mediaUrl) return { status: "MEDIA_REQUIRED", error: "Instagram requires a public image/video URL." };

  let igUserId = config?.accountId || process.env.INSTAGRAM_USER_ID || null;
  let accessToken = token.access_token;

  if (!igUserId) {
    const pages = await fetch("https://graph.facebook.com/v24.0/me/accounts?fields=id,access_token,instagram_business_account&access_token=" + encodeURIComponent(token.access_token), { cache:"no-store" });
    const pj = await pages.json().catch(()=>({}));
    const page = (pj.data || []).find(x => x.instagram_business_account?.id);
    if (page) {
      igUserId = page.instagram_business_account.id;
      accessToken = page.access_token || accessToken;
    }
  }

  if (!igUserId) return { status:"ACCOUNT_ID_REQUIRED", error:"Connect an Instagram Professional account to a Facebook Page, or enter the Instagram User ID in API Setup." };

  const isVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(body.mediaUrl);
  const create = new URLSearchParams({
    access_token: accessToken,
    caption: body.text || ""
  });
  if (isVideo) {
    create.set("media_type","REELS");
    create.set("video_url",body.mediaUrl);
  } else {
    create.set("image_url",body.mediaUrl);
  }

  const r1 = await fetch(`https://graph.facebook.com/v24.0/${igUserId}/media`, {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:create
  });
  const j1 = await r1.json().catch(()=>({}));
  if (!r1.ok || !j1.id) return { status:"FAILED", httpStatus:r1.status, error:JSON.stringify(j1).slice(0,800) };

  if (isVideo) {
    // Give Meta a short time to process a small demo video before publish.
    await new Promise(r=>setTimeout(r,2500));
  }

  const publish = new URLSearchParams({ creation_id:j1.id, access_token:accessToken });
  const r2 = await fetch(`https://graph.facebook.com/v24.0/${igUserId}/media_publish`, {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:publish
  });
  const j2 = await r2.json().catch(()=>({}));
  return { status:r2.ok?"POSTED":"FAILED", httpStatus:r2.status, externalId:j2.id||null, error:r2.ok?null:JSON.stringify(j2).slice(0,800) };
}

async function postThreads(body, token, config) {
  if (!token?.access_token) return { status:"NOT_CONNECTED" };
  let userId = config?.accountId || null;
  if (!userId) {
    const me = await fetch("https://graph.threads.net/v1.0/me?fields=id,username&access_token=" + encodeURIComponent(token.access_token), {cache:"no-store"});
    const mj = await me.json().catch(()=>({}));
    if (me.ok) userId = mj.id;
  }
  if (!userId) return { status:"ACCOUNT_ID_REQUIRED", error:"Threads user ID could not be detected. Reconnect Threads or enter the User ID in API Setup." };

  const createBody = new URLSearchParams({
    media_type:"TEXT",
    text:body.text || "",
    access_token:token.access_token
  });
  const r1=await fetch(`https://graph.threads.net/v1.0/${userId}/threads`,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:createBody
  });
  const j1=await r1.json().catch(()=>({}));
  if(!r1.ok||!j1.id) return {status:"FAILED",httpStatus:r1.status,error:JSON.stringify(j1).slice(0,800)};

  const pubBody=new URLSearchParams({creation_id:j1.id,access_token:token.access_token});
  const r2=await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:pubBody
  });
  const j2=await r2.json().catch(()=>({}));
  return {status:r2.ok?"POSTED":"FAILED",httpStatus:r2.status,externalId:j2.id||null,error:r2.ok?null:JSON.stringify(j2).slice(0,800)};
}

async function postPinterest(body, token, config) {
  if (!token?.access_token) return { status:"NOT_CONNECTED" };
  const boardId = config?.accountId || process.env.PINTEREST_BOARD_ID;
  if (!boardId) return {status:"ACCOUNT_ID_REQUIRED",error:"Enter the Pinterest Board ID in API Setup."};
  if (!body.mediaUrl) return {status:"MEDIA_REQUIRED",error:"Pinterest requires a public image URL."};

  const r=await fetch("https://api.pinterest.com/v5/pins",{
    method:"POST",
    headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      board_id:boardId,
      title:String(body.topic||"Nunes Instruments").slice(0,100),
      description:String(body.text||"").slice(0,500),
      media_source:{source_type:"image_url",url:body.mediaUrl}
    })
  });
  const j=await r.json().catch(()=>({}));
  return {status:r.ok?"POSTED":"FAILED",httpStatus:r.status,externalId:j.id||null,error:r.ok?null:JSON.stringify(j).slice(0,800)};
}

async function postTikTok(body, token) {
  if (!token?.access_token) return {status:"NOT_CONNECTED"};
  if (!body.mediaUrl) return {status:"MEDIA_REQUIRED",error:"TikTok requires a public image/video URL."};

  const info=await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",{
    method:"POST",headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json; charset=UTF-8"}
  });
  const ij=await info.json().catch(()=>({}));
  if(!info.ok || ij?.error?.code!=="ok") return {status:"FAILED",httpStatus:info.status,error:JSON.stringify(ij).slice(0,800)};
  const options=ij?.data?.privacy_level_options||[];
  const privacy=options.includes("SELF_ONLY")?"SELF_ONLY":options[0];
  if(!privacy) return {status:"FAILED",error:"TikTok did not return an allowed privacy level."};

  const isVideo=/\.(mp4|mov|m4v|webm)(\?|$)/i.test(body.mediaUrl);
  const endpoint=isVideo
    ?"https://open.tiktokapis.com/v2/post/publish/video/init/"
    :"https://open.tiktokapis.com/v2/post/publish/content/init/";

  const payload=isVideo ? {
    post_info:{title:String(body.text||"").slice(0,2200),privacy_level:privacy,disable_comment:false,disable_duet:false,disable_stitch:false},
    source_info:{source:"PULL_FROM_URL",video_url:body.mediaUrl}
  } : {
    post_info:{title:String(body.topic||"Nunes Instruments").slice(0,90),description:String(body.text||"").slice(0,2200),privacy_level:privacy,disable_comment:false,auto_add_music:false},
    source_info:{source:"PULL_FROM_URL",photo_images:[body.mediaUrl],photo_cover_index:0},
    post_mode:"DIRECT_POST",
    media_type:"PHOTO"
  };

  const r=await fetch(endpoint,{
    method:"POST",headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json; charset=UTF-8"},
    body:JSON.stringify(payload)
  });
  const j=await r.json().catch(()=>({}));
  const ok=r.ok && j?.error?.code==="ok";
  return {status:ok?"POSTED":"FAILED",httpStatus:r.status,externalId:j?.data?.publish_id||null,error:ok?null:JSON.stringify(j).slice(0,800)};
}

async function postYouTube(body, token) {
  if (!token?.access_token) return {status:"NOT_CONNECTED"};
  if (!body.mediaUrl) return {status:"MEDIA_REQUIRED",error:"YouTube requires a public video URL."};

  const source=await fetch(body.mediaUrl);
  if(!source.ok) return {status:"FAILED",error:"Could not download the video from the supplied Media URL."};
  const contentType=source.headers.get("content-type")||"video/mp4";
  if(!contentType.startsWith("video/")) return {status:"MEDIA_REQUIRED",error:"YouTube Media URL must point to a video file."};
  const buffer=Buffer.from(await source.arrayBuffer());

  const metadata={
    snippet:{
      title:String(body.topic||"Nunes Instruments").slice(0,100),
      description:String(body.text||"").slice(0,5000)
    },
    status:{privacyStatus:"private"}
  };

  const init=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{
    method:"POST",
    headers:{
      Authorization:`Bearer ${token.access_token}`,
      "Content-Type":"application/json; charset=UTF-8",
      "X-Upload-Content-Length":String(buffer.length),
      "X-Upload-Content-Type":contentType
    },
    body:JSON.stringify(metadata)
  });
  if(!init.ok) return {status:"FAILED",httpStatus:init.status,error:(await init.text()).slice(0,800)};
  const location=init.headers.get("location");
  if(!location) return {status:"FAILED",error:"YouTube did not return an upload URL."};

  const up=await fetch(location,{method:"PUT",headers:{"Content-Type":contentType,"Content-Length":String(buffer.length)},body:buffer});
  const j=await up.json().catch(()=>({}));
  return {status:up.ok?"POSTED":"FAILED",httpStatus:up.status,externalId:j.id||null,error:up.ok?null:JSON.stringify(j).slice(0,800)};
}

async function externalPublish(body) {
  if (body.channel === "Bluesky") return postBluesky(body);

  const token = await tokenFor(body.channel);
  const jar = await cookies();
  const id=String(body.channel||"").toLowerCase();
  const cfg = (await getSharedState(`config:${id}`)) || readConfig(jar,id);
  if (body.channel === "LinkedIn") return postLinkedIn(body, token, cfg);
  if (body.channel === "X") return postX(body, token);
  if (body.channel === "Facebook") return postFacebook(body, token, cfg);
  if (body.channel === "Instagram") return postInstagram(body, token, cfg);
  if (body.channel === "Threads") return postThreads(body, token, cfg);
  if (body.channel === "Pinterest") return postPinterest(body, token, cfg);
  if (body.channel === "TikTok") return postTikTok(body, token);
  if (body.channel === "YouTube") return postYouTube(body, token);

  if (!token?.access_token) return { status: "NOT_CONNECTED" };
  return { status: "UNSUPPORTED" };
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
