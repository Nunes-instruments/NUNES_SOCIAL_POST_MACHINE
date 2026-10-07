import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { seal, cookieName, COOKIE_OPTIONS, readConfig, secretFromJar } from "../../../../lib/oauth-store";
import { getSharedState, setSharedState } from "../../../../lib/shared-state";

function publicOrigin(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function GET(request, { params }) {
  const { platform } = await params;
  const id = String(platform || "").toLowerCase();
  const config = OAUTH[id];
  const url = new URL(request.url);

  const metaTarget = (code, detail="") => {
    const q = new URLSearchParams({ error: code });
    if (detail) q.set("detail", String(detail).slice(0,300));
    return new URL(`/connect/Meta?${q.toString()}`, publicOrigin(request));
  };

  const saved=(await getSharedState(`config:${id}`)) || readConfig(request.cookies,id);
  const clientId=saved?.clientId || (config ? process.env[config.clientId] : null);
  const clientSecret=saved?.clientSecret || (config ? process.env[config.clientSecret] : null);
  if (!config || !clientId || !clientSecret) {
    return NextResponse.redirect(id === "facebook"
      ? metaTarget("app-not-configured")
      : new URL(`/connect/${platform}?error=app-not-configured`, publicOrigin(request)));
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expected = request.cookies.get(`nunes_state_${id}`)?.value;

  if (error || !code || !state || !expected || state !== expected) {
    const detail = url.searchParams.get("error_description") || (state !== expected ? "OAuth state mismatch or expired login session" : "");
    return NextResponse.redirect(id === "facebook"
      ? metaTarget("oauth-failed", detail)
      : new URL(`/connect/${config.label}?error=oauth-failed`, publicOrigin(request)));
  }

  const origin = publicOrigin(request);
  const redirectUri = `${origin}/api/oauth/${id}/callback`;
  const body = new URLSearchParams();
  let headers = { "Content-Type": "application/x-www-form-urlencoded" };
  let tokenUrl = config.token;

  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  if (config.tiktok) {
    body.set("client_key", clientId);
    body.set("client_secret", clientSecret);
  } else if (config.basic) {
    headers.Authorization = "Basic " + Buffer.from(
      clientId + ":" + clientSecret
    ).toString("base64");
  } else if (config.meta) {
    tokenUrl += `?client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  if (config.pkce) {
    const verifier = request.cookies.get(`nunes_pkce_${id}`)?.value;
    if (!verifier) {
      return NextResponse.redirect(new URL(`/connect/${config.label}?error=pkce-missing`, publicOrigin(request)));
    }
    body.set("code_verifier", verifier);
    headers.Authorization = "Basic " + Buffer.from(
      clientId + ":" + clientSecret
    ).toString("base64");
  }

  try {
    const tr = await fetch(tokenUrl, {
      method: config.meta ? "GET" : "POST",
      headers,
      body: config.meta ? undefined : body,
      cache: "no-store"
    });

    const text = await tr.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!tr.ok || !data.access_token) {
      const detail = data?.error?.message || data?.error_description || data?.error?.type || text || `HTTP ${tr.status}`;
      console.error("[META OAUTH] token exchange failed", { status: tr.status, detail: String(detail).slice(0,500) });
      return NextResponse.redirect(id === "facebook"
        ? metaTarget("token-exchange", detail)
        : new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request)));
    }

    let author_urn = null;
    let profile = null;

    if (id === "linkedin") {
      try {
        const ur = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${data.access_token}` },
          cache: "no-store"
        });
        if (ur.ok) {
          profile = await ur.json();
          if (profile?.sub) author_urn = `urn:li:person:${profile.sub}`;
        }
      } catch {}
    }

    const payload = {
      platform: config.label,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || null,
      scope: data.scope || config.scope,
      author_urn,
      profile: profile ? { sub: profile.sub || null, name: profile.name || null } : null,
      createdAt: Date.now()
    };

    if (id === "facebook") {
      try {
        const pagesRes = await fetch(
          "https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=" +
          encodeURIComponent(data.access_token),
          { cache: "no-store" }
        );
        const pagesJson = await pagesRes.json().catch(()=>({}));
        const pages = Array.isArray(pagesJson.data) ? pagesJson.data : [];
        const configuredFb = (await getSharedState("config:facebook")) || {};
        const page = (configuredFb.accountId ? pages.find(p=>String(p.id)===String(configuredFb.accountId)) : null) || pages[0] || null;

        if (page) {
          const existingFb = (await getSharedState("config:facebook")) || {};
          await setSharedState("config:facebook", {
            ...existingFb,
            platform:"facebook",
            accountId: page.id || existingFb.accountId || "",
            name: page.name || existingFb.name || "",
            savedAt: Date.now()
          });

          const existingIg = (await getSharedState("config:instagram")) || {};
          const igId = page.instagram_business_account?.id || existingIg.accountId || "";
          if (igId) {
            const igAccessToken = page.access_token || data.access_token;
            const igRes = await fetch(
              `https://graph.facebook.com/v24.0/${encodeURIComponent(igId)}?fields=id,username,account_type&access_token=${encodeURIComponent(igAccessToken)}`,
              { cache:"no-store" }
            );
            const igJson = await igRes.json().catch(()=>({}));
            if (igRes.ok && igJson?.id) {
              await setSharedState("config:instagram", {
                ...existingIg,
                platform:"instagram",
                accountId:String(igJson.id),
                secondaryId:page.id || existingIg.secondaryId || "",
                name:igJson.username || existingIg.name || "",
                accountType:igJson.account_type || existingIg.accountType || "",
                validatedAt:Date.now(),
                savedAt:Date.now()
              });

              await setSharedState("token:instagram", {
                ...payload,
                platform:"Instagram",
                access_token:igAccessToken,
                instagram_user_id:String(igJson.id),
                username:igJson.username || "",
                account_type:igJson.account_type || "",
                linkedFrom:"facebook-meta-token",
                validatedAt:Date.now()
              });
            } else {
              console.warn("[META OAUTH] Instagram validation failed", igJson?.error?.message || `HTTP ${igRes.status}`);
            }
          }
        }

        let businesses = [];
        try {
          const bizRes = await fetch(
            "https://graph.facebook.com/v24.0/me/businesses?fields=id,name&access_token=" +
            encodeURIComponent(data.access_token),
            { cache:"no-store" }
          );
          const bizJson = await bizRes.json().catch(()=>({}));
          businesses = Array.isArray(bizJson.data) ? bizJson.data : [];
        } catch {}

        for (const biz of businesses) {
          try {
            const wabaRes = await fetch(
              `https://graph.facebook.com/v24.0/${biz.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(data.access_token)}`,
              { cache:"no-store" }
            );
            const wabaJson = await wabaRes.json().catch(()=>({}));
            const waba = Array.isArray(wabaJson.data) ? wabaJson.data[0] : null;
            if (!waba?.id) continue;

            const phoneRes = await fetch(
              `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(data.access_token)}`,
              { cache:"no-store" }
            );
            const phoneJson = await phoneRes.json().catch(()=>({}));
            const phone = Array.isArray(phoneJson.data) ? phoneJson.data[0] : null;

            const existingWa = (await getSharedState("config:whatsapp")) || {};
            await setSharedState("config:whatsapp", {
              ...existingWa,
              platform:"whatsapp",
              accountId:phone?.id || existingWa.accountId || "",
              secondaryId:waba.id,
              name:waba.name || existingWa.name || "",
              phone:phone?.display_phone_number || "",
              verifiedName:phone?.verified_name || "",
              savedAt:Date.now()
            });

            await setSharedState("token:whatsapp", {
              ...payload,
              platform:"WhatsApp"
            });
            break;
          } catch {}
        }
      } catch {}
    }

    const response = NextResponse.redirect(new URL(id === "facebook" ? "/connect/Meta?connected=1" : `/connect/${config.label}?connected=1`, publicOrigin(request)));
    const secret = secretFromJar(request.cookies);
    if (!secret) return NextResponse.redirect(id === "facebook"
      ? metaTarget("secure-session-missing","Secure browser session cookie was not returned after Meta login")
      : new URL(`/connect/${config.label}?error=secure-session-missing`, publicOrigin(request)));
    await setSharedState(`token:${id}`,payload);
    if (id === "facebook") {
      await setSharedState("token:facebook",payload);
    }
    response.cookies.set(cookieName(config.label), seal(payload, secret), COOKIE_OPTIONS);
    response.cookies.delete(`nunes_state_${id}`);
    response.cookies.delete(`nunes_pkce_${id}`);
    return response;
  } catch (e) {
    console.error("[OAUTH CALLBACK] unexpected failure", String(e?.message || e));
    return NextResponse.redirect(id === "facebook"
      ? metaTarget("callback-exception", e?.message || "Unexpected callback failure")
      : new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request)));
  }
}
