import { cookies } from "next/headers";
import { OAUTH, envReady } from "../../../lib/oauth-config";
import { cookieName, unseal, readConfig } from "../../../lib/oauth-store";

export async function GET() {
  const jar = await cookies();
  const integrations = {};

  for (const [id, cfg] of Object.entries(OAUTH)) {
    const token = unseal(jar.get(cookieName(cfg.label))?.value);
    const saved = readConfig(jar,id);
    const configured = envReady(id) || Boolean(saved?.clientId && saved?.clientSecret);
    integrations[cfg.label] = {
      connected: Boolean(token?.access_token),
      configured,
      mode: token?.access_token ? "connected" : configured ? "ready-to-login" : "app-setup-required"
    };
  }

  integrations.Bluesky = {
    connected: Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD),
    configured: true,
    mode: process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD
      ? "connected"
      : "manual-login-available"
  };

  return Response.json({ ok: true, n8nRequired: false, secureStorageReady: Boolean(process.env.OAUTH_SESSION_SECRET), integrations });
}
