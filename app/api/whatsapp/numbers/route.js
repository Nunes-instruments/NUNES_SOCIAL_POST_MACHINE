import crypto from "crypto";
import { getSharedState, setSharedState } from "../../../lib/shared-state";

function sanitizeNumber(n){
  return {
    id:String(n.id||crypto.randomUUID()),
    label:String(n.label||"WhatsApp Number").slice(0,80),
    displayPhone:String(n.displayPhone||"").slice(0,40),
    phoneNumberId:String(n.phoneNumberId||"").slice(0,120),
    wabaId:String(n.wabaId||"").slice(0,120),
    enabled:n.enabled!==false,
    accessToken:n.accessToken?String(n.accessToken):"",
    createdAt:n.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}

async function loadNumbers(){
  const [stored,legacyCfg,legacyToken]=await Promise.all([
    getSharedState("whatsapp:numbers"),
    getSharedState("config:whatsapp"),
    getSharedState("token:whatsapp")
  ]);
  let numbers=Array.isArray(stored)?stored:[];
  if(!numbers.length && legacyCfg?.accountId){
    numbers=[sanitizeNumber({
      label:legacyCfg.verifiedName||legacyCfg.name||"NUNES MAIN",
      displayPhone:legacyCfg.phone||"",
      phoneNumberId:legacyCfg.accountId,
      wabaId:legacyCfg.secondaryId||"",
      accessToken:legacyToken?.access_token||""
    })];
    await setSharedState("whatsapp:numbers",numbers);
  }
  return numbers;
}

function publicNumber(n,sharedToken){
  return {
    id:n.id,
    label:n.label,
    displayPhone:n.displayPhone,
    phoneNumberId:n.phoneNumberId,
    wabaId:n.wabaId,
    enabled:n.enabled!==false,
    connected:Boolean(n.phoneNumberId && (n.accessToken||sharedToken?.access_token)),
    createdAt:n.createdAt,
    updatedAt:n.updatedAt
  };
}

export async function GET(){
  const [numbers,sharedToken]=await Promise.all([loadNumbers(),getSharedState("token:whatsapp")]);
  return Response.json({ok:true,numbers:numbers.map(n=>publicNumber(n,sharedToken))});
}

export async function POST(request){
  try{
    const body=await request.json();
    const numbers=await loadNumbers();
    const action=String(body.action||"add");

    if(action==="remove"){
      const next=numbers.filter(n=>n.id!==String(body.id||""));
      await setSharedState("whatsapp:numbers",next);
      return Response.json({ok:true});
    }

    if(action==="toggle"){
      const next=numbers.map(n=>n.id===String(body.id||"")?{...n,enabled:body.enabled!==false,updatedAt:new Date().toISOString()}:n);
      await setSharedState("whatsapp:numbers",next);
      return Response.json({ok:true});
    }

    const entry=sanitizeNumber({
      id:body.id||undefined,
      label:body.label,
      displayPhone:body.displayPhone,
      phoneNumberId:body.phoneNumberId,
      wabaId:body.wabaId,
      accessToken:body.accessToken,
      enabled:true
    });

    if(!entry.label||!entry.phoneNumberId){
      return Response.json({ok:false,error:"Business label and WhatsApp Phone Number ID are required."},{status:400});
    }

    const existingIndex=numbers.findIndex(n=>n.id===entry.id || (entry.phoneNumberId && n.phoneNumberId===entry.phoneNumberId));
    if(existingIndex>=0){
      const previous=numbers[existingIndex];
      numbers[existingIndex]={...previous,...entry,accessToken:entry.accessToken||previous.accessToken||""};
    }else{
      numbers.push(entry);
    }

    await setSharedState("whatsapp:numbers",numbers);
    return Response.json({ok:true,number:publicNumber(existingIndex>=0?numbers[existingIndex]:entry,await getSharedState("token:whatsapp"))});
  }catch(e){
    console.error("[WHATSAPP NUMBERS] save failed",String(e?.message||e));
    return Response.json({ok:false,error:"Unable to save WhatsApp number."},{status:500});
  }
}