import { ensureInstagramConnection } from "../../../../lib/meta-instagram";
import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { seal, cookieName, COOKIE_OPTIONS, readConfig, secretFromJar } from "../../../../lib/oauth-store";
import { getSharedState, setSharedState } from "../../../../lib/shared-state";

const GRAPH = "https://graph.facebook.com/v24.0";

function publicOrigin(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

async function exchangeLongLivedMetaToken(shortToken, clientId, clientSecret) {
  try {
    const u = new URL(`${GRAPH}/oauth/access_token`);
    u.searchParams.set("grant_type", "fb_exchange_token");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("client_secret", clientSecret);
    u.searchParams.set("fb_exchange_token", shortToken);
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.access_token) return j;
    console.warn("[META OAUTH] long-lived token exchange unavailable", j?.error?.message || `HTTP ${r.status}`);
  } catch (e) {
    console.warn("[META OAUTH] long-lived exchange exception", String(e?.message || e));
  }
  return null;
}

async function metaIdentityAndPermissions(accessToken) {
  let profile = null;
  let granted = [];
  try {
    const me = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
    if (me.ok) profile = await me.json();
  } catch {}
  try {
    const pr = await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
    const pj = await pr.json().catch(() => ({}));
    if (pr.ok && Array.isArray(pj.data)) {
      granted = pj.data.filter(x => x.status === "granted").map(x => x.permission);
    }
  } catch {}
  return { profile, granted };
}

async function discoverFacebookPage(accessToken) {
  try {
    const r = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, pages: Array.isArray(j.data) ? j.data : [], detail: j?.error?.message || "" };
  } catch (e) {
    return { ok: false, pages: [], detail: String(e?.message || e) };
  }
}

export async function GET(request, { params }) {
  const { platform } = await params;
  const id = String(platform || "").toLowerCase();
  const config = OAUTH[id];
  const url = new URL(request.url);

  const metaTarget = (code, detail = "") => {
    const q = new URLSearchParams({ error: code });
    if (detail) q.set("detail", String(detail).slice(0, 300));
    return new URL(`/connect/Meta?${q.toString()}`, publicOrigin(request));
  };

  const saved = (await getSharedState(`config:${id}`)) || readConfig(request.cookies, id);
  const clientId = saved?.clientId || (config ? process.env[config.clientId] : null);
  const clientSecret = saved?.clientSecret || (config ? process.env[config.clientSecret] : null);

  if (!config || !clientId || !clientSecret) {
    return NextResponse.redirect(
      id === "facebook"
        ? metaTarget("app-not-configured")
        : new URL(`/connect/${platform}?error=app-not-configured`, publicOrigin(request))
    );
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expected = request.cookies.get(`nunes_state_${id}`)?.value;

  if (error || !code || !state || !expected || state !== expected) {
    const detail =
      url.searchParams.get("error_description") ||
      (state !== expected ? "OAuth state mismatch or expired login session" : "");
    return NextResponse.redirect(
      id === "facebook"
        ? metaTarget("oauth-failed", detail)
        : new URL(`/connect/${config.label}?error=oauth-failed`, publicOrigin(request))
    );
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
    headers.Authorization = "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64");
  } else if (config.meta) {
    tokenUrl +=
      `?client_id=${encodeURIComponent(clientId)}` +
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
    headers.Authorization = "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64");
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
      const detail =
        data?.error?.message ||
        data?.error_description ||
        data?.error?.type ||
        text ||
        `HTTP ${tr.status}`;
      console.error("[META OAUTH] token exchange failed", { status: tr.status, detail: String(detail).slice(0, 500) });
      return NextResponse.redirect(
        id === "facebook"
          ? metaTarget("token-exchange", detail)
          : new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request))
      );
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

    let effectiveToken = data.access_token;
    let effectiveExpiresIn = Number(data.expires_in || 0) || null;
    let grantedScopes = String(data.scope || config.scope || "")
      .split(/[ ,]+/)
      .map(x => x.trim())
      .filter(Boolean);
    let metaProfile = null;

    if (id === "facebook") {
      const longLived = await exchangeLongLivedMetaToken(data.access_token, clientId, clientSecret);
      if (longLived?.access_token) {
        effectiveToken = longLived.access_token;
        effectiveExpiresIn = Number(longLived.expires_in || effectiveExpiresIn || 0) || null;
      }
      const identity = await metaIdentityAndPermissions(effectiveToken);
      metaProfile = identity.profile;
      if (identity.granted.length) grantedScopes = identity.granted;
    }

    const now = Date.now();
    const payload = {
      platform: config.label,
      access_token: effectiveToken,
      refresh_token: data.refresh_token || null,
      expires_in: effectiveExpiresIn,
      expires_at: effectiveExpiresIn ? now + effectiveExpiresIn * 1000 : null,
      scope: grantedScopes.join(" "),
      scopes: grantedScopes,
      meta_user_id: metaProfile?.id || null,
      meta_user_name: metaProfile?.name || null,
      author_urn,
      profile: profile ? { sub: profile.sub || null, name: profile.name || null } : null,
      token_type: data.token_type || "bearer",
      createdAt: now,
      updatedAt: now
    };

    // Persist the server token before discovery. This makes the callback durable
    // and lets all subsequent verification use the same server-side token.
    await setSharedState(`token:${id}`, payload);
    if (id === "facebook") await setSharedState("token:facebook", payload);

    if (id === "facebook") {
      const pageDiscovery = await discoverFacebookPage(effectiveToken);
      const configuredFb = (await getSharedState("config:facebook")) || {};
      const selectedPage =
        (configuredFb.accountId
          ? pageDiscovery.pages.find(p => String(p.id) === String(configuredFb.accountId))
          : null) ||
        pageDiscovery.pages.find(p => p.instagram_business_account?.id) ||
        pageDiscovery.pages[0] ||
        null;

      if (selectedPage?.id) {
        await setSharedState("config:facebook", {
          ...configuredFb,
          platform: "facebook",
          accountId: String(selectedPage.id),
          name: selectedPage.name || configuredFb.name || "",
          tasks: Array.isArray(selectedPage.tasks) ? selectedPage.tasks : [],
          metaUserId: metaProfile?.id || configuredFb.metaUserId || "",
          connectionStatus: "connected",
          validatedAt: now,
          updatedAt: now,
          savedAt: now
        });
      }

      const existingIg = (await getSharedState("config:instagram")) || {};
      const igRepair = await ensureInstagramConnection(
        { ...existingIg, secondaryId: selectedPage?.id || existingIg.secondaryId || "" },
        payload
      );
      if (!igRepair?.connected) {
        console.warn("[META OAUTH] Instagram auto-link incomplete", igRepair?.reason || "unknown", igRepair?.detail || "");
        await setSharedState("config:instagram", {
          ...existingIg,
          platform: "instagram",
          accountId: "",
          verified: false,
          connectionStatus: "needs-attention",
          validationError: igRepair?.reason || "not-linked",
          updatedAt: now,
          savedAt: existingIg.savedAt || now
        });
      }

      let businesses = [];
      try {
        const bizRes = await fetch(
          `${GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(effectiveToken)}`,
          { cache: "no-store" }
        );
        const bizJson = await bizRes.json().catch(() => ({}));
        businesses = Array.isArray(bizJson.data) ? bizJson.data : [];
      } catch {}

      for (const biz of businesses) {
        try {
          const wabaRes = await fetch(
            `${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(effectiveToken)}`,
            { cache: "no-store" }
          );
          const wabaJson = await wabaRes.json().catch(() => ({}));
          const waba = Array.isArray(wabaJson.data) ? wabaJson.data[0] : null;
          if (!waba?.id) continue;

          const phoneRes = await fetch(
            `${GRAPH}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(effectiveToken)}`,
            { cache: "no-store" }
          );
          const phoneJson = await phoneRes.json().catch(() => ({}));
          const phone = Array.isArray(phoneJson.data) ? phoneJson.data[0] : null;

          const existingWa = (await getSharedState("config:whatsapp")) || {};
          await setSharedState("config:whatsapp", {
            ...existingWa,
            platform: "whatsapp",
            accountId: phone?.id || "",
            secondaryId: String(waba.id),
            name: waba.name || existingWa.name || "",
            phone: phone?.display_phone_number || "",
            verifiedName: phone?.verified_name || "",
            connectionStatus: phone?.id ? "connected" : "needs-attention",
            validatedAt: now,
            updatedAt: now,
            savedAt: now
          });

          if (phone?.id) {
            await setSharedState("token:whatsapp", {
              ...payload,
              platform: "WhatsApp",
              waba_id: String(waba.id),
              phone_number_id: String(phone.id),
              validatedAt: now
            });
          }
          break;
        } catch {}
      }
    }

    const target =
      id === "facebook"
        ? new URL("/connect/Meta?connected=1", publicOrigin(request))
        : new URL(`/connect/${config.label}?connected=1`, publicOrigin(request));

    const secret = secretFromJar(request.cookies);
    if (!secret) {
      return NextResponse.redirect(
        id === "facebook"
          ? metaTarget("secure-session-missing", "Secure browser session cookie was not returned after Meta login")
          : new URL(`/connect/${config.label}?error=secure-session-missing`, publicOrigin(request))
      );
    }

    const response = NextResponse.redirect(target);
    response.cookies.set(cookieName(config.label), seal(payload, secret), COOKIE_OPTIONS);
    response.cookies.delete(`nunes_state_${id}`);
    response.cookies.delete(`nunes_pkce_${id}`);
    return response;
  } catch (e) {
    console.error("[OAUTH CALLBACK] unexpected failure", String(e?.message || e));
    return NextResponse.redirect(
      id === "facebook"
        ? metaTarget("callback-exception", e?.message || "Unexpected callback failure")
        : new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request))
    );
  }
}
