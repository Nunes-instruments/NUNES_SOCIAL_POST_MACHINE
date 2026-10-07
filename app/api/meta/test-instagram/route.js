import { getSharedState } from "../../../lib/shared-state";
import { ensureInstagramConnection } from "../../../lib/meta-instagram";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mediaUrl = String(body.mediaUrl || "").trim();
    const caption = String(body.caption || "NUNES Instagram connection test").trim();

    if (!/^https:\/\//i.test(mediaUrl)) {
      return Response.json({ ok:false, error:"A public HTTPS image/video URL is required." }, { status:400 });
    }

    const [fbToken, igConfig] = await Promise.all([
      getSharedState("token:facebook"),
      getSharedState("config:instagram")
    ]);

    const verified = await ensureInstagramConnection(igConfig || {}, fbToken || null);
    if (!verified?.connected) {
      return Response.json({
        ok:false,
        error:"Instagram is not verified for publishing.",
        reason:verified?.reason || "not-connected",
        detail:verified?.detail || ""
      }, { status:409 });
    }

    const [token, config] = await Promise.all([
      getSharedState("token:instagram"),
      getSharedState("config:instagram")
    ]);

    if (!token?.access_token || !config?.accountId || config?.verified !== true) {
      return Response.json({ ok:false, error:"Verified Instagram credentials are unavailable." }, { status:409 });
    }

    const isVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl);
    const create = new URLSearchParams({
      access_token: token.access_token,
      caption
    });

    if (isVideo) {
      create.set("media_type", "REELS");
      create.set("video_url", mediaUrl);
    } else {
      create.set("image_url", mediaUrl);
    }

    const r1 = await fetch(`https://graph.facebook.com/v24.0/${encodeURIComponent(config.accountId)}/media`, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body:create,
      cache:"no-store"
    });
    const j1 = await r1.json().catch(() => ({}));

    if (!r1.ok || !j1.id) {
      return Response.json({
        ok:false,
        error:"Instagram media container creation failed.",
        meta:j1
      }, { status:502 });
    }

    if (isVideo) {
      // Reels need processing. Poll instead of relying on a fixed delay.
      for (let i = 0; i < 12; i++) {
        const sr = await fetch(
          `https://graph.facebook.com/v24.0/${encodeURIComponent(j1.id)}?fields=status_code&access_token=${encodeURIComponent(token.access_token)}`,
          { cache:"no-store" }
        );
        const sj = await sr.json().catch(() => ({}));
        if (sj.status_code === "FINISHED") break;
        if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") {
          return Response.json({ ok:false, error:"Instagram Reel processing failed.", meta:sj }, { status:502 });
        }
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    const publish = new URLSearchParams({
      creation_id: String(j1.id),
      access_token: token.access_token
    });

    const r2 = await fetch(`https://graph.facebook.com/v24.0/${encodeURIComponent(config.accountId)}/media_publish`, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body:publish,
      cache:"no-store"
    });
    const j2 = await r2.json().catch(() => ({}));

    if (!r2.ok || !j2.id) {
      return Response.json({
        ok:false,
        error:"Instagram publish failed.",
        containerId:j1.id,
        meta:j2
      }, { status:502 });
    }

    return Response.json({
      ok:true,
      status:"POSTED",
      mediaId:String(j2.id),
      instagramAccountId:String(config.accountId),
      username:config.name || token.username || "",
      facebookPageId:config.secondaryId || token.facebook_page_id || ""
    });
  } catch (e) {
    return Response.json({ ok:false, error:String(e?.message || "Instagram test post failed") }, { status:500 });
  }
}
