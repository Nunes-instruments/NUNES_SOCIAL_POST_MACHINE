import { getSharedState } from "../../lib/shared-state";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    const history=await getSharedState("history:posts");
    return Response.json({ok:true,posts:Array.isArray(history)?history.slice(0,250):[]},{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    console.error("[PUBLISHING HISTORY] read error",String(e?.message||e));
    return Response.json({ok:false,error:"Unable to load publishing history."},{status:500});
  }
}
