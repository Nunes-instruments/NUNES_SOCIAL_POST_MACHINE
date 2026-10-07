import crypto from "crypto";
import { getSharedState, setSharedState } from "../../../lib/shared-state";

async function history(){
  const h=await getSharedState("whatsapp:status:history");
  return Array.isArray(h)?h:[];
}

export async function GET(){
  try{
    return Response.json({ok:true,history:(await history()).slice(0,100)});
  }catch(e){
    console.error("[WHATSAPP STATUS] history load failed",String(e?.message||e));
    return Response.json({ok:false,error:"Unable to load WhatsApp status history."},{status:500});
  }
}

export async function POST(request){
  try{
    const body=await request.json();
    const action=String(body.action||"save");
    const selected=Array.isArray(body.numberIds)?body.numberIds.filter(Boolean):[];
    const entry={
      id:crypto.randomUUID(),
      text:String(body.text||"").slice(0,5000),
      mediaUrl:String(body.mediaUrl||"").slice(0,2000),
      numberIds:selected,
      scheduledFor:body.scheduledFor?String(body.scheduledFor):"",
      createdAt:new Date().toISOString(),
      status:action==="schedule"?"SCHEDULED_MANUAL":action==="publish"?"UNSUPPORTED":"DRAFT"
    };

    if(!entry.text && !entry.mediaUrl){
      return Response.json({ok:false,error:"Add status text or media first."},{status:400});
    }
    if(!selected.length){
      return Response.json({ok:false,error:"Select at least one WhatsApp number."},{status:400});
    }

    if(action==="publish"){
      entry.error="Direct WhatsApp Status publishing is not enabled by the current official Business API integration. NUNES will not report a fake success.";
    }

    const h=await history();
    await setSharedState("whatsapp:status:history",[entry,...h].slice(0,250));

    if(action==="publish"){
      return Response.json({ok:false,entry,error:entry.error},{status:409});
    }
    return Response.json({ok:true,entry});
  }catch(e){
    console.error("[WHATSAPP STATUS] operation failed",String(e?.message||e));
    return Response.json({ok:false,error:"WhatsApp status operation failed."},{status:500});
  }
}