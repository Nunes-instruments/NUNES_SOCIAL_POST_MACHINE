import { NextResponse } from "next/server";
import { OAUTH, envReady } from "../../../../lib/oauth-config";
import { seal, cookieName, COOKIE_OPTIONS } from "../../../../lib/oauth-store";

export async function GET(request, { params }) {
  const { platform } = await params;
  const id = String(platform || "").toLowerCase();
  const config = OAUTH[id];
  const url = new URL(request.url);

  if (!config || !envReady(id)) {
    return NextResponse.redirect(new URL(`/connect/${platform}?error=app-not-configured`, request.url));
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expected = request.cookies.get(`nunes_state_${id}`)?.value;

  if (error || !code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=oauth-failed`, request.url));
  }

  const redirectUri = `${url.origin}/api/oauth/${id}/callback`;
  const body = new URLSearchParams();
  let headers = { "Content-Type": "application/x-www-form-urlencoded" };
  let tokenUrl = config.token;

  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  if (config.tiktok) {
    body.set("client_key", process.env[config.clientId]);
    body.set("client_secret", process.env[config.clientSecret]);
  } else if (config.basic) {
    headers.Authorization = "Basic " + Buffer.from(
      process.env[config.clientId] + ":" + process.env[config.clientSecret]
    ).toString("base64");
  } else if (config.meta) {
    tokenUrl += `?client_id=${encodeURIComponent(process.env[config.clientId])}` +
      `&client_secret=${encodeURIComponent(process.env[config.clientSecret])}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`;
  } else {
    body.set("client_id", process.env[config.clientId]);
    body.set("client_secret", process.env[config.clientSecret]);
  }

  if (config.pkce) {
    const verifier = request.cookies.get(`nunes_pkce_${id}`)?.value;
    if (!verifier) {
      return NextResponse.redirect(new URL(`/connect/${config.label}?error=pkce-missing`, request.url));
    }
    body.set("code_verifier", verifier);
    headers.Authorization = "Basic " + Buffer.from(
      process.env[config.clientId] + ":" + process.env[config.clientSecret]
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
      return NextResponse.redirect(new URL(`/connect/${config.label}?error=token-exchange`, request.url));
    }

    const payload = {
      platform: config.label,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || null,
      scope: data.scope || config.scope,
      createdAt: Date.now()
    };

    const response = NextResponse.redirect(new URL(`/connect/${config.label}?connected=1`, request.url));
    response.cookies.set(cookieName(config.label), seal(payload), COOKIE_OPTIONS);
    response.cookies.delete(`nunes_state_${id}`);
    response.cookies.delete(`nunes_pkce_${id}`);
    return response;
  } catch {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=token-exchange`, request.url));
  }
}
