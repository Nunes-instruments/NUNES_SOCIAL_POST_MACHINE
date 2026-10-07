"use client";

import { useEffect, useState } from "react";

export default function MetaConnectPage(){
  const [state,setState]=useState(null);
  const [clientId,setClientId]=useState("");
  const [clientSecret,setClientSecret]=useState("");
  const [configId,setConfigId]=useState("");
  const [facebookPageId,setFacebookPageId]=useState("");
  const [instagramUserId,setInstagramUserId]=useState("");
  const [wabaId,setWabaId]=useState("");
  const [phoneNumberId,setPhoneNumberId]=useState("");
  const [whatsappToken,setWhatsappToken]=useState("");
  const [msg,setMsg]=useState("");
  const [oauthCompleted,setOauthCompleted]=useState(false);

  async function refresh(){
    const r=await fetch("/api/meta/setup",{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    setState(j);
    if(j.facebook?.pageId) setFacebookPageId(j.facebook.pageId);
    if(j.instagram?.userId) setInstagramUserId(j.instagram.userId);
    if(j.whatsapp?.wabaId) setWabaId(j.whatsapp.wabaId);
    if(j.whatsapp?.phoneNumberId) setPhoneNumberId(j.whatsapp.phoneNumberId);
  }

  useEffect(()=>{
    refresh();
    if(typeof window!=="undefined") setOauthCompleted(new URLSearchParams(window.location.search).get("connected")==="1");
  },[]);

  async function saveAndConnect(e){
    e.preventDefault();
    setMsg("Saving Meta setup...");
    const r=await fetch("/api/meta/setup",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId,clientSecret,configId,facebookPageId,instagramUserId,wabaId,phoneNumberId,whatsappToken
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){
      setMsg(j.error||"Unable to save Meta setup");
      return;
    }
    setClientSecret("");
    setWhatsappToken("");
    setMsg("Saved. Opening Meta authorization...");
    window.location.href=j.connectUrl;
  }

  const fb=Boolean(state?.facebook?.connected);
  const ig=Boolean(state?.instagram?.connected);
  const wa=Boolean(state?.whatsapp?.connected);
  const connectedCount=[fb,ig,wa].filter(Boolean).length;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
          <a className="sideLink active" href="/"><span>◎</span>Connections</a>
        </nav>
        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <a className="sideLink active" href="/connect/Meta"><span>M</span>Meta Business</a>
          <a className="sideLink" href="/"><span>▤</span>Content</a>
          <a className="sideLink" href="/"><span>➤</span>Publishing</a>
        </nav>
        <div className="sidebarBottom">
          <a className="sideLink" href="/">⚙ Settings</a>
          <div className="userCard"><div className="avatar">NI</div><div><strong>Nunes Instruments</strong><span>Admin</span></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspaceTop">
          <div className="searchBox">⌕<input placeholder="Search anything..." /></div>
          <div className="topActions"><a className="quickCreate" href="/">＋ Quick Create</a><div className="miniAvatar">NI</div></div>
        </header>

        <main className="contentArea">
          <div className="pageHeading">
            <div><span>META BUSINESS</span><h1>Connect Facebook, Instagram & WhatsApp</h1><p>One Meta setup, one authorization flow, shared encrypted connection storage.</p></div>
            <span className={connectedCount===3?"pill ok":"pill"}>{connectedCount}/3 CONNECTED</span>
          </div>

          {oauthCompleted && <div className="important"><strong>Meta authorization completed</strong><span>NUNES has refreshed Facebook, Instagram and WhatsApp assets that Meta allowed this app to access.</span></div>}

          <section className="metaStatusGrid">
            <div className={fb?"metaServiceCard connected":"metaServiceCard"}>
              <div className="metaServiceIcon fb">f</div>
              <div><strong>Facebook</strong><span>{fb?"Connected":state?.facebook?.pageId?"Configured":"Not connected"}</span>{state?.facebook?.name&&<small>{state.facebook.name}</small>}</div>
              <b>{fb?"✓":"—"}</b>
            </div>
            <div className={ig?"metaServiceCard connected":"metaServiceCard"}>
              <div className="metaServiceIcon ig">◎</div>
              <div><strong>Instagram</strong><span>{ig?"Connected":state?.instagram?.userId?"Configured":"Not connected"}</span>{state?.instagram?.name&&<small>@{state.instagram.name}</small>}</div>
              <b>{ig?"✓":"—"}</b>
            </div>
            <div className={wa?"metaServiceCard connected":"metaServiceCard"}>
              <div className="metaServiceIcon wa">WA</div>
              <div><strong>WhatsApp</strong><span>{wa?"Connected":state?.whatsapp?.phoneNumberId?"Configured":"Not connected"}</span>{state?.whatsapp?.phone&&<small>{state.whatsapp.phone}</small>}</div>
              <b>{wa?"✓":"—"}</b>
            </div>
          </section>

          <section className="connectDashboardGrid">
            <article className="connectCard dashboardConnectCard">
              <div className="brandBubble metaBubble">M</div>
              <h2>Meta API Setup</h2>
              <p>Enter the Meta App ID and App Secret once. NUNES will reuse them for Facebook and Instagram and attempt WhatsApp Business discovery during the same authorization.</p>

              <form className="apiSetupForm metaSetupForm" onSubmit={saveAndConnect}>
                <label>Meta App ID
                  <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Paste Meta App ID" required/>
                </label>
                <label>Meta App Secret
                  <input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Paste Meta App Secret" required/>
                </label>
                <label>Facebook Login for Business Configuration ID
                  <input value={configId} onChange={e=>setConfigId(e.target.value)} placeholder="Paste Configuration ID from Facebook Login for Business → Configurations" required/>
                </label>

                <div className="metaOptionalTitle">Optional IDs — leave blank for auto-detection</div>
                <label>Facebook Page ID
                  <input value={facebookPageId} onChange={e=>setFacebookPageId(e.target.value)} placeholder="Auto-detect after authorization"/>
                </label>
                <label>Instagram User ID
                  <input value={instagramUserId} onChange={e=>setInstagramUserId(e.target.value)} placeholder="Auto-detect linked Professional account"/>
                </label>
                <label>WhatsApp Business Account ID (WABA)
                  <input value={wabaId} onChange={e=>setWabaId(e.target.value)} placeholder="Auto-detect if WhatsApp Business access is granted"/>
                </label>
                <label>WhatsApp Phone Number ID
                  <input value={phoneNumberId} onChange={e=>setPhoneNumberId(e.target.value)} placeholder="Auto-detect from WABA"/>
                </label>

                <details className="advancedMeta">
                  <summary>Advanced WhatsApp fallback</summary>
                  <label>WhatsApp System User / Permanent Access Token
                    <input type="password" value={whatsappToken} onChange={e=>setWhatsappToken(e.target.value)} placeholder="Optional — use only if automatic WhatsApp authorization is unavailable"/>
                  </label>
                </details>

                <button className="primary wideBtn" type="submit">Save & Connect Meta</button>
                {msg&&<div className="saveMsg">{msg}</div>}
              </form>

              {state?.metaConfigured && <a className="loginBtn metaLogin" href="/api/oauth/facebook/start">Reconnect Meta securely</a>}
              <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>
            </article>

            <aside className="setupHelpCard">
              <span className="eyebrow">MANUAL META SETUP</span>
              <h3>Do these once in Meta Developers</h3>
              <div className="steps">
                <div><b>1</b><span>Create/select one Meta Business app.</span></div>
                <div><b>2</b><span>Add Facebook Login / Facebook Login for Business, Instagram API, and WhatsApp products.</span></div>
                <div><b>3</b><span>Register callback URL:<small>{typeof window!=="undefined"?window.location.origin+"/api/oauth/facebook/callback":""}</small></span></div>
                <div><b>4</b><span>Enable the required permissions, then return here and click Save & Connect Meta.</span></div>
              </div>

              <div className="metaPerms">
                <strong>Add these permissions inside the Meta Business Login configuration</strong>
                <span>pages_show_list</span>
                <span>pages_read_engagement</span>
                <span>pages_manage_posts</span>
                <span>instagram_basic</span>
                <span>instagram_content_publish</span>
                <span>business_management</span>
                <span>whatsapp_business_management</span>
                <span>whatsapp_business_messaging</span>
              </div>
            </aside>
          </section>
        </main>
      </section>
    </div>
  );
}
