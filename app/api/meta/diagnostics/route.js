import { getSharedState } from "../../../lib/shared-state";

export async function GET(){
  const [fbCfg,igCfg,waCfg,fbTok,igTok,waTok]=await Promise.all([
    getSharedState("config:facebook"),
    getSharedState("config:instagram"),
    getSharedState("config:whatsapp"),
    getSharedState("token:facebook"),
    getSharedState("token:instagram"),
    getSharedState("token:whatsapp")
  ]);
  return Response.json({
    ok:true,
    facebook:{
      configured:Boolean(fbCfg?.clientId&&fbCfg?.clientSecret),
      configIdPresent:Boolean(fbCfg?.configId),
      pageIdPresent:Boolean(fbCfg?.accountId),
      tokenPresent:Boolean(fbTok?.access_token),
      pageName:fbCfg?.name||""
    },
    instagram:{
      configured:Boolean(igCfg?.clientId&&igCfg?.clientSecret),
      userIdPresent:Boolean(igCfg?.accountId),
      tokenPresent:Boolean(igTok?.access_token),
      username:igCfg?.name||""
    },
    whatsapp:{
      configured:Boolean(waCfg?.clientId&&waCfg?.clientSecret),
      wabaIdPresent:Boolean(waCfg?.secondaryId),
      phoneNumberIdPresent:Boolean(waCfg?.accountId),
      tokenPresent:Boolean(waTok?.access_token),
      phone:waCfg?.phone||""
    }
  });
}