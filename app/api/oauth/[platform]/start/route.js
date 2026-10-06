import crypto from "crypto";
import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { readConfig } from "../../../../lib/oauth-store";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

export async function GET(request, { params }) {
  const { platform } = await params;
  const id = String(platform || "").toLowerCase();
  const config = OAUTH[id];

  if (!config) {
    return NextResponse.redirect(new URL(`/connect/${platform}?error=unsupported`, request.url));
  }

  const saved=readConfig(request.cookies,id);
  const clientId=saved?.clientId || process.env[config.clientId];
  if (!clientId) {
    return NextResponse.redirect(new URL(`/connect/${config.label}?error=app-not-configured`, request.url));
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/oauth/${id}/callback`;
  const state = b64url(crypto.randomBytes(24));
  const url = new URL(config.auth);

  url.searchParams.set(config.clientKey, clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);

  if (config.google) {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  }

  if (config.pkce) {
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(url);
    response.cookies.set(`nunes_pkce_${id}`, verifier, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
    });
    response.cookies.set(`nunes_state_${id}`, state, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
    });
    return response;
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(`nunes_state_${id}`, state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
  });
  return response;
}
