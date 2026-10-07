import { ensureInstagramConnection } from "../../../lib/meta-instagram";
import { getSharedState, setSharedState } from "../../../lib/shared-state";

export async function GET(){
  let [fb,ig,wa,fbToken,igToken,waToken]=await Promise.all([
    getSharedState("config:facebook"),
    getSharedState("config:instagram"),
    getSharedState("config:whatsapp"),
    getSharedState("token:facebook"),
    getSharedState("token:instagram"),
    getSharedState("token:whatsapp")
  ]);

  let instagramHealth=null;
  if(ig?.accountId && fbToken?.access_token && !igToken?.access_token){
    instagramHealth=await ensureInstagramConnection(ig,fbToken);
    if(instagramHealth.connected){
      [ig,igToken]=await Promise.all([
        getSharedState("config:instagram"),
        getSharedState("token:instagram")
      ]);
    }
  }

  return Response.json({
    ok:true,
    metaConfigured:Boolean(fb?.clientId&&fb?.clientSecret),
    facebook:{connected:Boolean(fbToken?.access_token),pageId:fb?.accountId||"",name:fb?.name||""},
    instagram:{
      connected:Boolean(igToken?.access_token&&ig?.accountId),
      userId:ig?.accountId||"",
      name:ig?.name||igToken?.username||"",
      accountType:ig?.accountType||igToken?.account_type||"",
      health:instagramHealth
    },
    whatsapp:{connected:Boolean(waToken?.access_token),phoneNumberId:wa?.accountId||"",wabaId:wa?.secondaryId||"",phone:wa?.phone||""}
  });
}

export async function POST(request){
  try{
    const body=await request.json();
    const clean = (v) => String(v||"").trim().replace(/^["']|["']$/g,"");
    const clientId=clean(body.clientId);
    const clientSecret=clean(body.clientSecret);
    const facebookPageId=String(body.facebookPageId||"").trim();
    const instagramUserId=String(body.instagramUserId||"").trim();
    const wabaId=String(body.wabaId||"").trim();
    const phoneNumberId=String(body.phoneNumberId||"").trim();
    const whatsappToken=String(body.whatsappToken||"").trim();
    const configId=String(body.configId||"").trim();

    if(!clientId||!clientSecret){
      return Response.json({ok:false,error:"Meta App ID and App Secret are required"},{status:400});
    }

    // Validate App ID + App Secret before saving or opening OAuth.
    try{
      const verifyUrl = new URL("https://graph.facebook.com/oauth/access_token");
      verifyUrl.searchParams.set("client_id",clientId);
      verifyUrl.searchParams.set("client_secret",clientSecret);
      verifyUrl.searchParams.set("grant_type","client_credentials");
      const vr=await fetch(verifyUrl,{cache:"no-store"});
      const vtext=await vr.text();
      let vjson={};
      try{vjson=JSON.parse(vtext)}catch{}
      if(!vr.ok || !vjson.access_token){
        const detail=vjson?.error?.message || vjson?.error_description || "Meta rejected this App ID/App Secret pair.";
        return Response.json({
          ok:false,
          error:`Meta App Secret validation failed: ${detail} Use App Settings → Basic → App Secret (not Client Token).`
        },{status:400});
      }
    }catch(e){
      return Response.json({ok:false,error:"Could not validate Meta credentials. Please retry."},{status:502});
    }

    await setSharedState("config:facebook",{platform:"facebook",clientId,clientSecret,accountId:facebookPageId,secondaryId:"",configId,savedAt:Date.now()});
    await setSharedState("config:instagram",{platform:"instagram",clientId,clientSecret,accountId:instagramUserId,secondaryId:facebookPageId,configId,savedAt:Date.now()});
    await setSharedState("config:whatsapp",{platform:"whatsapp",clientId,clientSecret,accountId:phoneNumberId,secondaryId:wabaId,savedAt:Date.now()});

    if(instagramUserId){
      const fbToken=await getSharedState("token:facebook");
      if(fbToken?.access_token){
        const igConfig=await getSharedState("config:instagram");
        await ensureInstagramConnection(igConfig,fbToken);
      }
    }

    if(whatsappToken){
      await setSharedState("token:whatsapp",{platform:"WhatsApp",access_token:whatsappToken,scope:"whatsapp_business_management whatsapp_business_messaging",createdAt:Date.now()});
    }

    return Response.json({ok:true,connectUrl:"/api/oauth/facebook/start"});
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||"Unable to save Meta setup")},{status:500});
  }
}