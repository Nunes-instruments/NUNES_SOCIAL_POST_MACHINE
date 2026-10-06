import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { seal, cookieName, COOKIE_OPTIONS, readConfig, secretFromJar } from "../../../../lib/oauth-store";

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

  const saved=readConfig(request.cookies,id);
  const clientId=saved?.clientId || (config ? process.env[config.clientId] : null);
  const clientSecret=saved?.clientSecret || (config ? process.env[config.clientSecret] : null);
  if (!config || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`/connect/${platform}?error=app-not-configured`, publicOrigin(request)));
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expected = request.cookies.get(`nunes_state_${id}`)?.value;

  if (error || !code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=oauth-failed`, publicOrigin(request)));
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
      return NextResponse.redirect(new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request)));
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

    const response = NextResponse.redirect(new URL(`/connect/${config.label}?connected=1`, publicOrigin(request)));
    const secret = secretFromJar(request.cookies);
    if (!secret) return NextResponse.redirect(new URL(`/connect/${config.label}?error=secure-session-missing`, publicOrigin(request)));
    response.cookies.set(cookieName(config.label), seal(payload, secret), COOKIE_OPTIONS);
    response.cookies.delete(`nunes_state_${id}`);
    response.cookies.delete(`nunes_pkce_${id}`);
    return response;
  } catch {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=token-exchange`, publicOrigin(request)));
  }
}
