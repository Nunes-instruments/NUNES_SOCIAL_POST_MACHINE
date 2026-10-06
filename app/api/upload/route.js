export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!process.env.SOCIAL_UPLOAD_API_URL || !process.env.SOCIAL_STATE_SHARED_SECRET) {
      return Response.json({ok:false,error:"Upload service is not configured"},{status:503});
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ok:false,error:"No file supplied"},{status:400});
    }

    if (file.size > 50 * 1024 * 1024) {
      return Response.json({ok:false,error:"File exceeds 50 MB limit"},{status:413});
    }

    const out = new FormData();
    out.set("file", file, file.name);

    const r = await fetch(process.env.SOCIAL_UPLOAD_API_URL, {
      method:"POST",
      headers:{"x-nunes-secret":process.env.SOCIAL_STATE_SHARED_SECRET},
      body:out,
      cache:"no-store"
    });

    const text = await r.text();
    let data={};
    try { data=JSON.parse(text); } catch {}
    if(!r.ok || !data.ok){
      return Response.json({ok:false,error:data.error||"Upload failed"},{status:r.status||500});
    }
    return Response.json(data);
  } catch (e) {
    return Response.json({ok:false,error:String(e?.message||"Upload failed")},{status:500});
  }
}