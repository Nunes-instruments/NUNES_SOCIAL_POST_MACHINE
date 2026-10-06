import { cookies } from "next/headers";
import { OAUTH, envReady } from "../../../lib/oauth-config";
import { cookieName, unseal, readConfig, secretFromJar } from "../../../lib/oauth-store";
import { getSharedState, setSharedState, sharedStateReady } from "../../../lib/shared-state";

export async function GET() {
  const jar = await cookies();
  const integrations = {};

  for (const [id, cfg] of Object.entries(OAUTH)) {
    const browserToken = unseal(jar.get(cookieName(cfg.label))?.value, secretFromJar(jar));
    const browserConfig = readConfig(jar,id);

    let token = await getSharedState(`token:${id}`);
    let saved = await getSharedState(`config:${id}`);

    if (!token && browserToken?.access_token) {
      token = browserToken;
      await setSharedState(`token:${id}`,browserToken);
    }
    if (!saved && browserConfig?.clientId && browserConfig?.clientSecret) {
      saved = browserConfig;
      await setSharedState(`config:${id}`,browserConfig);
    }

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

  return Response.json({ ok: true, n8nRequired: false, secureStorageReady: true, secureStorageMode: sharedStateReady() ? "shared-server-encrypted" : "browser-encrypted", integrations });
}
