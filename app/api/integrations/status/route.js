import { cookies } from "next/headers";
import { OAUTH, envReady } from "../../../lib/oauth-config";
import { cookieName, unseal, readConfig, secretFromJar } from "../../../lib/oauth-store";
import { getSharedState, setSharedState, sharedStateReady } from "../../../lib/shared-state";

async function validateFacebookPublishing(token, saved) {
  if (!token?.access_token) return { connected:false, health:"not-connected", missingPermissions:[], pageAccessible:false, canCreate:false };

  const required=["pages_read_engagement","pages_manage_posts"];
  let granted=[];
  let pageAccessible=false;
  let canCreate=false;
  let pageName=saved?.name||"";
  let tasks=[];

  try {
    const pr=await fetch("https://graph.facebook.com/v24.0/me/permissions?access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const pj=await pr.json().catch(()=>({}));
    if(pr.ok && Array.isArray(pj.data)) {
      granted=pj.data.filter(x=>x.status==="granted").map(x=>x.permission);
    }
  } catch {}

  try {
    const ar=await fetch("https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,tasks&access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const aj=await ar.json().catch(()=>({}));
    const pages=Array.isArray(aj.data)?aj.data:[];
    const page=(saved?.accountId ? pages.find(x=>String(x.id)===String(saved.accountId)) : pages[0]) || null;
    if(page){
      pageAccessible=true;
      pageName=page.name||pageName;
      tasks=Array.isArray(page.tasks)?page.tasks:[];
      canCreate=!tasks.length || tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
    }
  } catch {}

  const missingPermissions=required.filter(x=>!granted.includes(x));
  const connected=pageAccessible && canCreate && missingPermissions.length===0;
  return {
    connected,
    health: connected ? "connected" : !pageAccessible ? "page-access-required" : missingPermissions.length ? "limited-permissions" : "insufficient-page-role",
    missingPermissions,
    pageAccessible,
    canCreate,
    pageName,
    tasks
  };
}

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
    if(id==="facebook"){
      const health=await validateFacebookPublishing(token,saved);
      integrations[cfg.label] = {
        connected: health.connected,
        configured,
        mode: health.connected ? "connected" : token?.access_token ? health.health : configured ? "ready-to-login" : "app-setup-required",
        health,
        actionRequired: health.connected ? "" :
          health.health==="limited-permissions" ? "Reconnect Meta and grant Page publishing permissions." :
          health.health==="page-access-required" ? "Reconnect Meta and select/authorize the Nunes Instrumentation Page." :
          health.health==="insufficient-page-role" ? "Your Facebook user needs Page content/admin access." : ""
      };
    } else {
      integrations[cfg.label] = {
        connected: Boolean(token?.access_token),
        configured,
        mode: token?.access_token ? "connected" : configured ? "ready-to-login" : "app-setup-required"
      };
    }
  }

  const waToken = await getSharedState("token:whatsapp");
  const waConfig = await getSharedState("config:whatsapp");
  integrations.WhatsApp = {
    connected: Boolean(waToken?.access_token && waConfig?.accountId),
    configured: Boolean(waConfig?.clientId && waConfig?.clientSecret),
    mode: waToken?.access_token && waConfig?.accountId
      ? "connected"
      : waConfig?.clientId && waConfig?.clientSecret
        ? "ready-to-login"
        : "app-setup-required",
    phoneNumberId: waConfig?.accountId || "",
    wabaId: waConfig?.secondaryId || "",
    phone: waConfig?.phone || ""
  };

  integrations.Bluesky = {
    connected: Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD),
    configured: true,
    mode: process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD
      ? "connected"
      : "manual-login-available"
  };

  return Response.json({ ok: true, n8nRequired: false, secureStorageReady: true, secureStorageMode: sharedStateReady() ? "shared-server-encrypted" : "browser-encrypted", integrations });
}
