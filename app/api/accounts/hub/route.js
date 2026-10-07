import { getSharedState } from "../../../lib/shared-state";

async function getFacebookLive(token,cfg){
  if(!token?.access_token || !cfg?.accountId) return [];
  try{
    let pageToken=token.access_token;
    const pages=await fetch("https://graph.facebook.com/v24.0/me/accounts?fields=id,access_token&access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const pj=await pages.json().catch(()=>({}));
    const page=(pj.data||[]).find(x=>String(x.id)===String(cfg.accountId));
    if(page?.access_token) pageToken=page.access_token;
    const r=await fetch(`https://graph.facebook.com/v24.0/${cfg.accountId}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=12&access_token=${encodeURIComponent(pageToken)}`,{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    return (j.data||[]).map(x=>({
      id:x.id,
      text:x.message||"",
      createdAt:x.created_time||"",
      url:x.permalink_url||"",
      mediaUrl:x.full_picture||"",
      source:"Facebook"
    }));
  }catch{return []}
}

async function getInstagramLive(token,cfg){
  if(!token?.access_token || !cfg?.accountId) return [];
  try{
    const r=await fetch(`https://graph.facebook.com/v24.0/${cfg.accountId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url&limit=12&access_token=${encodeURIComponent(token.access_token)}`,{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    return (j.data||[]).map(x=>({
      id:x.id,
      text:x.caption||"",
      createdAt:x.timestamp||"",
      url:x.permalink||"",
      mediaUrl:x.thumbnail_url||x.media_url||"",
      mediaType:x.media_type||"",
      source:"Instagram"
    }));
  }catch{return []}
}

export async function GET(){
  const [history,fbCfg,igCfg,waCfg,liCfg,fbTok,igTok,waTok,liTok]=await Promise.all([
    getSharedState("history:posts"),
    getSharedState("config:facebook"),
    getSharedState("config:instagram"),
    getSharedState("config:whatsapp"),
    getSharedState("config:linkedin"),
    getSharedState("token:facebook"),
    getSharedState("token:instagram"),
    getSharedState("token:whatsapp"),
    getSharedState("token:linkedin")
  ]);

  const posts=Array.isArray(history)?history:[];
  const [facebookLive,instagramLive]=await Promise.all([
    getFacebookLive(fbTok,fbCfg),
    getInstagramLive(igTok,igCfg)
  ]);

  const byChannel=(name)=>posts.filter(x=>String(x.channel||"").toLowerCase()===name.toLowerCase()).slice(0,20);

  return Response.json({
    ok:true,
    accounts:{
      LinkedIn:{
        connected:Boolean(liTok?.access_token),
        configured:Boolean(liCfg?.clientId&&liCfg?.clientSecret),
        name:liTok?.profile?.name||"Nunes Instrumentation",
        accountId:liCfg?.accountId||liTok?.author_urn||"",
        recent:byChannel("LinkedIn"),
        capabilities:["Content","Publishing","Settings","Permissions"]
      },
      Facebook:{
        connected:Boolean(fbTok?.access_token),
        configured:Boolean(fbCfg?.clientId&&fbCfg?.clientSecret),
        name:fbCfg?.name||"Nunes Instrumentation",
        accountId:fbCfg?.accountId||"",
        recent:facebookLive.length?facebookLive:byChannel("Facebook"),
        capabilities:["Content","Ads","Insights","Messages","Comments","Settings","Permissions"]
      },
      Instagram:{
        connected:Boolean(igTok?.access_token&&igCfg?.accountId),
        configured:Boolean(igCfg?.clientId&&igCfg?.clientSecret),
        name:igCfg?.name||"Instagram Professional",
        accountId:igCfg?.accountId||"",
        recent:instagramLive.length?instagramLive:byChannel("Instagram"),
        capabilities:["Content","Ads","Insights","Messages","Comments","Settings","Permissions"]
      },
      WhatsApp:{
        connected:Boolean(waTok?.access_token&&waCfg?.accountId),
        configured:Boolean(waCfg?.clientId&&waCfg?.clientSecret),
        name:waCfg?.verifiedName||"WhatsApp Business",
        phone:waCfg?.phone||"",
        accountId:waCfg?.accountId||"",
        wabaId:waCfg?.secondaryId||"",
        recent:byChannel("WhatsApp"),
        capabilities:["Messages","Templates","Settings","Permissions"]
      }
    }
  });
}