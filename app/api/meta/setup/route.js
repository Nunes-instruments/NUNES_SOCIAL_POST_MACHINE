import { getSharedState, setSharedState } from "../../../lib/shared-state";

export async function GET(){
  const [fb,ig,wa,fbToken,igToken,waToken]=await Promise.all([
    getSharedState("config:facebook"),
    getSharedState("config:instagram"),
    getSharedState("config:whatsapp"),
    getSharedState("token:facebook"),
    getSharedState("token:instagram"),
    getSharedState("token:whatsapp")
  ]);
  return Response.json({
    ok:true,
    metaConfigured:Boolean(fb?.clientId&&fb?.clientSecret),
    facebook:{connected:Boolean(fbToken?.access_token),pageId:fb?.accountId||"",name:fb?.name||""},
    instagram:{connected:Boolean(igToken?.access_token),userId:ig?.accountId||"",name:ig?.name||""},
    whatsapp:{connected:Boolean(waToken?.access_token),phoneNumberId:wa?.accountId||"",wabaId:wa?.secondaryId||"",phone:wa?.phone||""}
  });
}

export async function POST(request){
  try{
    const body=await request.json();
    const clientId=String(body.clientId||"").trim();
    const clientSecret=String(body.clientSecret||"").trim();
    const facebookPageId=String(body.facebookPageId||"").trim();
    const instagramUserId=String(body.instagramUserId||"").trim();
    const wabaId=String(body.wabaId||"").trim();
    const phoneNumberId=String(body.phoneNumberId||"").trim();
    const whatsappToken=String(body.whatsappToken||"").trim();

    if(!clientId||!clientSecret){
      return Response.json({ok:false,error:"Meta App ID and App Secret are required"},{status:400});
    }

    await setSharedState("config:facebook",{platform:"facebook",clientId,clientSecret,accountId:facebookPageId,secondaryId:"",savedAt:Date.now()});
    await setSharedState("config:instagram",{platform:"instagram",clientId,clientSecret,accountId:instagramUserId,secondaryId:facebookPageId,savedAt:Date.now()});
    await setSharedState("config:whatsapp",{platform:"whatsapp",clientId,clientSecret,accountId:phoneNumberId,secondaryId:wabaId,savedAt:Date.now()});

    if(whatsappToken){
      await setSharedState("token:whatsapp",{platform:"WhatsApp",access_token:whatsappToken,scope:"whatsapp_business_management whatsapp_business_messaging",createdAt:Date.now()});
    }

    return Response.json({ok:true,connectUrl:"/api/oauth/facebook/start"});
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||"Unable to save Meta setup")},{status:500});
  }
}