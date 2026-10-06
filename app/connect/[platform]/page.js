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
  const [secureReady,setSecureReady]=useState(false);
  const [clientId,setClientId]=useState("");
  const [clientSecret,setClientSecret]=useState("");
  const [accountId,setAccountId]=useState("");
  const [saveMsg,setSaveMsg]=useState("");

  async function refresh() {
    const r = await fetch("/api/integrations/status", { cache: "no-store" });
    const j = await r.json();
    setState(j.integrations?.[platform] || null);
    setSecureReady(Boolean(j.secureStorageReady));
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
      setSaveMsg("Saved. You can connect this account now.");
      await refresh();
    }else{
      setSaveMsg(j.error||"Unable to save API setup");
    }
  }

  return (
    <main className="connectPage">
      <div className="connectTop">
        <a href="/">← Back to Post Machine</a>
        <span className={connected ? "pill ok" : "pill"}>{connected ? "CONNECTED" : "NOT CONNECTED"}</span>
      </div>

      <section className="connectCard">
        <div className="brandBubble" style={{ background: meta.color }}>{meta.icon}</div>
        <h1>Connect {platform}</h1>
        <p>Authorize your {platform} account so NUNES can publish approved posts directly.</p>

        {error === "app-not-configured" && (
          <div className="warning">
            <strong>API setup required</strong>
            <span>Paste the Client ID and Client Secret below, save them, then connect securely.</span>
          </div>
        )}

        {platform !== "Bluesky" && !secureReady && (
          <div className="warning">
            <strong>One-time security key required</strong>
            <span>Add OAUTH_SESSION_SECRET once in Vercel Environment Variables. After that, all social API credentials can be entered here in the app.</span>
          </div>
        )}

        {platform !== "Bluesky" && (
          <form className="apiSetupForm" onSubmit={saveApiSetup}>
            <h3>API Setup</h3>
            <label>Client ID / App ID
              <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Paste Client ID / App ID" required />
            </label>
            <label>Client Secret / App Secret
              <input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Paste Client Secret / App Secret" required />
            </label>
            {field && <label>{field.accountLabel}
              <input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder={field.accountPlaceholder} />
            </label>}
            <button className="primary wideBtn" type="submit" disabled={!secureReady}>Save API Setup</button>
            {saveMsg && <div className="saveMsg">{saveMsg}</div>}
          </form>
        )}

        {platform === "Bluesky" ? (
          <>
            <div className="warning">
              <strong>Bluesky uses an App Password for automated posting</strong>
              <span>Use a Bluesky App Password, not your normal account password. Add it securely in Vercel Environment Variables.</span>
            </div>
            <a className="secondaryBtn wideBtn" href={OFFICIAL[platform]} target="_blank" rel="noreferrer">Open official Bluesky login</a>
          </>
        ) : (
          <>
            <a
              className={state?.configured ? "loginBtn" : "loginBtn disabledLogin"}
              style={{ background: meta.color }}
              href={state?.configured ? `/api/oauth/${platform.toLowerCase()}/start` : "#"}
              onClick={e => { if (!state?.configured) e.preventDefault(); }}
            >
              {state?.configured ? `Connect securely with ${platform}` : "Save API Setup first"}
            </a>
            <a className="secondaryBtn wideBtn" href={OFFICIAL[platform]} target="_blank" rel="noreferrer">
              Open official {platform} login
            </a>
            {!state?.configured && (
              <div className="noteBox">
                You can log into the correct account on the official website now. Then paste the platform Client ID and Client Secret in API Setup above and click Save.
              </div>
            )}
          </>
        )}

        <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>

        <div className="steps">
          <div><b>1</b><span>Create the provider developer app once.</span></div>
          <div><b>2</b><span>Paste Client ID/Secret in the API Setup form on this page.</span></div>
          <div><b>3</b><span>Add the callback URL shown in README.</span></div>
          <div><b>4</b><span>{platform === "Bluesky" ? "Configure the Bluesky App Password securely, then refresh." : `Click Connect securely with ${platform} and approve access on the provider website.`}</span></div>
        </div>
      </section>
    </main>
  );
}
