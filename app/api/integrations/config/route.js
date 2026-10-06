import { NextResponse } from "next/server";
import {
  BROWSER_KEY_COOKIE,
  KEY_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
  configCookieName,
  createBrowserSecret,
  readConfig,
  seal,
  secretFromJar
} from "../../../lib/oauth-store";

const ALLOWED = new Set(["linkedin","facebook","instagram","threads","x","pinterest","tiktok","youtube"]);

export async function GET(request){
  const url=new URL(request.url);
  const id=String(url.searchParams.get("platform")||"").toLowerCase();
  if(!ALLOWED.has(id)) return Response.json({ok:false,error:"Unsupported platform"},{status:400});
  const saved=readConfig(request.cookies,id);
  return Response.json({
    ok:true,
    configured:Boolean(saved?.clientId&&saved?.clientSecret),
    accountId:saved?.accountId||"",
    secondaryId:saved?.secondaryId||""
  });
}

export async function POST(request){
  try{
    const body=await request.json();
    const id=String(body.platform||"").toLowerCase();
    if(!ALLOWED.has(id)) return Response.json({ok:false,error:"Unsupported platform"},{status:400});

    const clientId=String(body.clientId||"").trim();
    const clientSecret=String(body.clientSecret||"").trim();
    const accountId=String(body.accountId||"").trim();
    const secondaryId=String(body.secondaryId||"").trim();

    if(!clientId||!clientSecret){
      return Response.json({ok:false,error:"Client ID and Client Secret are required"},{status:400});
    }

    let secret=secretFromJar(request.cookies);
    const response=NextResponse.json({ok:true,configured:true,connectUrl:`/api/oauth/${id}/start`});

    if(!secret){
      secret=createBrowserSecret();
      response.cookies.set(BROWSER_KEY_COOKIE,secret,KEY_COOKIE_OPTIONS);
    }

    const payload={platform:id,clientId,clientSecret,accountId,secondaryId,savedAt:Date.now()};
    response.cookies.set(configCookieName(id),seal(payload,secret),COOKIE_OPTIONS);
    return response;
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||"Unable to save configuration")},{status:500});
  }
}

export async function DELETE(request){
  const url=new URL(request.url);
  const id=String(url.searchParams.get("platform")||"").toLowerCase();
  const response=NextResponse.json({ok:true});
  response.cookies.delete(configCookieName(id));
  return response;
}
