"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const OFFICIAL = {
  LinkedIn: "https://www.linkedin.com/login",
  Facebook: "https://www.facebook.com/login",
  Instagram: "https://www.instagram.com/accounts/login/",
  Threads: "https://www.threads.net/login",
  X: "https://x.com/i/flow/login",
  Pinterest: "https://www.pinterest.com/login/",
  TikTok: "https://www.tiktok.com/login",
  YouTube: "https://accounts.google.com/ServiceLogin?service=youtube",
  Bluesky: "https://bsky.app/"
};

const FIELDS = {
  LinkedIn:{accountLabel:"Author URN (optional now)",accountPlaceholder:"urn:li:organization:123456789"},
  Facebook:{accountLabel:"Facebook Page ID",accountPlaceholder:"123456789012345"},
  Instagram:{accountLabel:"Instagram User ID",accountPlaceholder:"17841400000000000"},
  Threads:{accountLabel:"Threads User ID (optional)",accountPlaceholder:"Account/User ID"},
  X:{accountLabel:"X User ID (optional)",accountPlaceholder:"User ID"},
  Pinterest:{accountLabel:"Pinterest Board ID",accountPlaceholder:"Board ID"},
  TikTok:{accountLabel:"TikTok User/Open ID (optional)",accountPlaceholder:"User/Open ID"},
  YouTube:{accountLabel:"YouTube Channel ID (optional)",accountPlaceholder:"UC..."}
};

const META = {
  LinkedIn: { color: "#0A66C2", icon: "in" },
  Facebook: { color: "#1877F2", icon: "f" },
  Instagram: { color: "#E1306C", icon: "◎" },
  Threads: { color: "#111111", icon: "@" },
  X: { color: "#111111", icon: "X" },
  Pinterest: { color: "#E60023", icon: "P" },
  TikTok: { color: "#111111", icon: "♪" },
  YouTube: { color: "#FF0000", icon: "▶" },
  Bluesky: { color: "#1185FE", icon: "☁" }
};

export default function ConnectPlatform() {
  const params = useParams();
  const qs = useSearchParams();
  const platform = decodeURIComponent(String(params.platform || ""));
  const [state, setState] = useState(null);
  const [secureReady,setSecureReady]=useState(true);
  const [clientId,setClientId]=useState("");
  const [clientSecret,setClientSecret]=useState("");
  const [accountId,setAccountId]=useState("");
  const [saveMsg,setSaveMsg]=useState("");

  async function refresh() {
    const r = await fetch("/api/integrations/status", { cache: "no-store" });
    const j = await r.json();
    setState(j.integrations?.[platform] || null);
    setSecureReady(j.secureStorageReady !== false);
  }

  useEffect(() => { refresh(); }, [platform]);

  const meta = META[platform] || META.LinkedIn;
  const error = qs.get("error");
  const connected = state?.connected;
  const field=FIELDS[platform];

  async function saveApiSetup(e){
    e.preventDefault();
    setSaveMsg("Saving securely...");
    const r=await fetch("/api/integrations/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:platform.toLowerCase(),clientId,clientSecret,accountId})});
    const j=await r.json().catch(()=>({}));
    if(j.ok){
      setClientSecret("");
      setSaveMsg("Saved. Opening secure authorization...");
      window.location.href=j.connectUrl || `/api/oauth/${platform.toLowerCase()}/start`;
      return;
    }else{
      setSaveMsg(j.error||"Unable to save API setup");
    }
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
          <a className="sideLink active" href="/#connections"><span>◎</span>Connections</a>
        </nav>
        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <a className="sideLink active" href="/#connections"><span>↗</span>Social Networks</a>
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
            <div><span>SOCIAL NETWORKS</span><h1>Connect {platform}</h1><p>Authorize and manage this network inside the NUNES Social Studio.</p></div>
            <span className={connected ? "pill ok" : "pill"}>{connected ? "CONNECTED" : "NOT CONNECTED"}</span>
          </div>

          <section className="connectDashboardGrid">
            <article className="connectCard dashboardConnectCard">
              <div className="brandBubble" style={{ background: meta.color }}>{meta.icon}</div>
              <h2>{platform} connection</h2>
              <p>Use the official provider authorization so NUNES can publish approved posts directly.</p>

              {error === "app-not-configured" && (
                <div className="warning"><strong>API setup required</strong><span>Paste the Client ID and Client Secret below, save them, then connect securely.</span></div>
              )}

                            {platform !== "Bluesky" && (
                <form className="apiSetupForm" onSubmit={saveApiSetup}>
                  <h3>API Setup</h3>
                  <label>Client ID / App ID<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Paste Client ID / App ID" required /></label>
                  <label>Client Secret / App Secret<input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Paste Client Secret / App Secret" required /></label>
                  {field && <label>{field.accountLabel}<input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder={field.accountPlaceholder} /></label>}
                  <button className="primary wideBtn" type="submit">Save & Connect Now</button>
                  {saveMsg && <div className="saveMsg">{saveMsg}</div>}
                </form>
              )}

              {platform === "Bluesky" ? (
                <div className="warning"><strong>Bluesky uses an App Password</strong><span>Use a Bluesky App Password, not your normal password.</span></div>
              ) : (
                <a className={state?.configured ? "loginBtn" : "loginBtn disabledLogin"} style={{ background: meta.color }} href={state?.configured ? `/api/oauth/${platform.toLowerCase()}/start` : "#"} onClick={e=>{if(!state?.configured)e.preventDefault()}}>
                  {state?.configured ? `Connect securely with ${platform}` : "Save API Setup first"}
                </a>
              )}

              <a className="secondaryBtn wideBtn" href={OFFICIAL[platform]} target="_blank" rel="noreferrer">Open official {platform} login</a>
              <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>
            </article>

            <aside className="setupHelpCard">
              <span className="eyebrow">SETUP CHECKLIST</span>
              <h3>Connect in four steps</h3>
              <div className="steps">
                <div><b>1</b><span>Create the provider developer app once.</span></div>
                <div><b>2</b><span>Paste Client ID/Secret in API Setup.</span></div>
                <div><b>3</b><span>Register this callback URL:<small>{typeof window!=="undefined" ? `${window.location.origin}/api/oauth/${platform.toLowerCase()}/callback` : ""}</small></span></div>
                <div><b>4</b><span>Click Connect securely and approve access.</span></div>
              </div>
            </aside>
          </section>
        </main>
      </section>
    </div>
  );
}
