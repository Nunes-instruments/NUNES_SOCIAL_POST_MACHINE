import { getSharedState, setSharedState } from "./shared-state";

export async function ensureInstagramConnection(igConfig, fbToken){
  const userToken=fbToken?.access_token;
  const configuredIgId=String(igConfig?.accountId||"").trim();
  const configuredPageId=String(igConfig?.secondaryId||"").trim();

  if(!userToken) return {connected:false,reason:"meta-token-missing"};

  try{
    const pagesUrl=new URL("https://graph.facebook.com/v24.0/me/accounts");
    pagesUrl.searchParams.set("fields","id,name,access_token,instagram_business_account");
    pagesUrl.searchParams.set("access_token",userToken);
    const pagesRes=await fetch(pagesUrl,{cache:"no-store"});
    const pagesJson=await pagesRes.json().catch(e=>({parseError:String(e?.message||e)}));
    const pages=Array.isArray(pagesJson.data)?pagesJson.data:[];

    if(!pagesRes.ok){
      const detail=pagesJson?.error?.message||`HTTP ${pagesRes.status}`;
      console.warn("[INSTAGRAM CONNECT] page discovery failed",detail);
      return {connected:false,reason:"page-discovery-failed",detail};
    }

    let page=null;
    if(configuredPageId) page=pages.find(p=>String(p.id)===configuredPageId)||null;
    if(!page && configuredIgId) page=pages.find(p=>String(p.instagram_business_account?.id||"")===configuredIgId)||null;
    if(!page) page=pages.find(p=>p.instagram_business_account?.id)||pages[0]||null;

    if(!page?.id){
      return {connected:false,reason:"facebook-page-not-found",detail:"No accessible Facebook Page was returned by Meta."};
    }

    const pageToken=page.access_token||userToken;

    // Always ask the Page directly for its linked Instagram Graph account.
    // Do not trust a manually-entered Business Manager asset ID as the Graph user ID.
    let pageLinkedIgId="";
    const pageUrl=new URL(`https://graph.facebook.com/v24.0/${encodeURIComponent(page.id)}`);
    pageUrl.searchParams.set("fields","instagram_business_account");
    pageUrl.searchParams.set("access_token",pageToken);
    const pageRes=await fetch(pageUrl,{cache:"no-store"});
    const pageJson=await pageRes.json().catch(e=>({parseError:String(e?.message||e)}));
    if(pageRes.ok){
      pageLinkedIgId=String(pageJson?.instagram_business_account?.id||"").trim();
    }else{
      console.warn("[INSTAGRAM CONNECT] Page Instagram link lookup failed",pageJson?.error?.message||`HTTP ${pageRes.status}`);
    }

    const resolvedIgId=String(
      pageLinkedIgId ||
      page.instagram_business_account?.id ||
      configuredIgId ||
      ""
    ).trim();

    if(!resolvedIgId){
      return {
        connected:false,
        reason:"instagram-not-linked-to-page",
        pageId:String(page.id),
        pageName:page.name||"",
        detail:"Meta did not return an Instagram professional account linked to this Facebook Page."
      };
    }

    const igUrl=new URL(`https://graph.facebook.com/v24.0/${encodeURIComponent(resolvedIgId)}`);
    igUrl.searchParams.set("fields","id,username,account_type,profile_picture_url");
    igUrl.searchParams.set("access_token",pageToken);
    const igRes=await fetch(igUrl,{cache:"no-store"});
    const igJson=await igRes.json().catch(e=>({parseError:String(e?.message||e)}));

    if(!igRes.ok || !igJson?.id){
      const detail=igJson?.error?.message||`HTTP ${igRes.status}`;
      console.warn("[INSTAGRAM CONNECT] account validation failed",detail);
      return {
        connected:false,
        reason:"instagram-validation-failed",
        pageId:String(page.id),
        instagramUserId:resolvedIgId,
        detail
      };
    }

    const existing=igConfig||{};
    const tokenPayload={
      ...fbToken,
      platform:"Instagram",
      access_token:pageToken,
      instagram_user_id:String(igJson.id),
      username:igJson.username||"",
      account_type:igJson.account_type||"",
      linkedFrom:"facebook-page-token",
      facebook_page_id:String(page.id),
      validatedAt:Date.now()
    };

    await Promise.all([
      setSharedState("token:instagram",tokenPayload),
      setSharedState("config:instagram",{
        ...existing,
        platform:"instagram",
        accountId:String(igJson.id),
        secondaryId:String(page.id),
        name:igJson.username||existing.name||"",
        accountType:igJson.account_type||existing.accountType||"",
        profilePictureUrl:igJson.profile_picture_url||existing.profilePictureUrl||"",
        validatedAt:Date.now(),
        savedAt:Date.now()
      })
    ]);

    return {
      connected:true,
      userId:String(igJson.id),
      name:igJson.username||"",
      accountType:igJson.account_type||"",
      pageId:String(page.id),
      pageName:page.name||"",
      tokenSource:"facebook-page-token"
    };
  }catch(e){
    const detail=String(e?.message||e);
    console.error("[INSTAGRAM CONNECT] recovery exception",detail);
    return {connected:false,reason:"instagram-validation-exception",detail};
  }
}

export async function repairInstagramFromStoredMeta(){
  const [igConfig,fbToken]=await Promise.all([
    getSharedState("config:instagram"),
    getSharedState("token:facebook")
  ]);
  return ensureInstagramConnection(igConfig||{},fbToken||null);
}
