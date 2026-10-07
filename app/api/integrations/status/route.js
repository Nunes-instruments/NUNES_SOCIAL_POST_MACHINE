import { cookies } from "next/headers";
import { OAUTH, envReady, ENABLED_SOCIAL_PROVIDER_IDS } from "../../../lib/oauth-config";
import { cookieName, unseal, readConfig, secretFromJar } from "../../../lib/oauth-store";
import { getSharedState, setSharedState, sharedStateReady } from "../../../lib/shared-state";

async function ensureInstagramFromMeta(fbToken, igConfig){
  const igId=String(igConfig?.accountId||"").trim();
  if(!fbToken?.access_token || !igId) return null;
  try{
    const u=new URL(`https://graph.facebook.com/v24.0/${encodeURIComponent(igId)}`);
    u.searchParams.set("fields","id,username,account_type");
    u.searchParams.set("access_token",fbToken.access_token);
    const r=await fetch(u,{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j?.id){
      console.warn("[INSTAGRAM HEALTH] validation failed",j?.error?.message||`HTTP ${r.status}`);
      return null;
    }
    const token={
      ...fbToken,
      platform:"Instagram",
      access_token:fbToken.access_token,
      instagram_user_id:String(j.id),
      username:j.username||"",
      account_type:j.account_type||"",
      linkedFrom:"facebook-meta-token",
      validatedAt:Date.now()
    };
    await Promise.all([
      setSharedState("token:instagram",token),
      setSharedState("config:instagram",{
        ...igConfig,
        platform:"instagram",
        accountId:String(j.id),
        name:j.username||igConfig?.name||"",
        accountType:j.account_type||igConfig?.accountType||"",
        validatedAt:Date.now(),
        savedAt:Date.now()
      })
    ]);
    return token;
  }catch(e){
    console.warn("[INSTAGRAM HEALTH] validation exception",String(e?.message||e));
    return null;
  }
}

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
  } catch (e) { console.warn("[FACEBOOK HEALTH] permissions check failed", String(e?.message||e)); }

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
  } catch (e) { console.warn("[FACEBOOK HEALTH] page access check failed", String(e?.message||e)); }

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
    if (!ENABLED_SOCIAL_PROVIDER_IDS.includes(id)) continue;
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

    if(id==="instagram" && !token?.access_token && saved?.accountId){
      const fbToken=await getSharedState("token:facebook");
      token=await ensureInstagramFromMeta(fbToken,saved) || token;
    }

    const configured = envReady(id) || Boolean(saved?.clientId && saved?.clientSecret);
    if(id==="facebook"){
      const health=await validateFacebookPublishing(token,saved);
      integrations[cfg.label] = {
        signedIn: Boolean(token?.access_token),
        sharedSaved: Boolean(token?.access_token),
        publishingReady: health.connected,
        connected: Boolean(token?.access_token),
        configured,
        mode: health.connected ? "connected" : token?.access_token ? "signed-in-action-required" : configured ? "ready-to-login" : "app-setup-required",
        publishingHealth: health.health,
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

  const [waToken,waConfig,waNumbersRaw] = await Promise.all([
    getSharedState("token:whatsapp"),
    getSharedState("config:whatsapp"),
    getSharedState("whatsapp:numbers")
  ]);
  const waNumbers = Array.isArray(waNumbersRaw) ? waNumbersRaw : [];
  const legacyConnected = Boolean(waToken?.access_token && waConfig?.accountId);
  const numbersConnected = waNumbers.filter(n=>n?.enabled!==false && n?.phoneNumberId && (n?.accessToken || waToken?.access_token)).length || (legacyConnected ? 1 : 0);
  integrations.WhatsApp = {
    connected: numbersConnected > 0,
    configured: Boolean(waConfig?.clientId && waConfig?.clientSecret),
    mode: numbersConnected > 0 ? "connected" : waConfig?.clientId && waConfig?.clientSecret ? "ready-to-login" : "not-connected",
    phoneNumberId: waConfig?.accountId || "",
    wabaId: waConfig?.secondaryId || "",
    phone: waConfig?.phone || "",
    numbersConnected,
    numberCount: numbersConnected,
    numbersConfigured: waNumbers.length || (waConfig?.accountId ? 1 : 0)
  };

  return Response.json({ ok: true, n8nRequired: false, secureStorageReady: true, secureStorageMode: sharedStateReady() ? "shared-server-encrypted" : "browser-encrypted", integrations });
}
