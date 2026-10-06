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

  async function refresh() {
    const r = await fetch("/api/integrations/status", { cache: "no-store" });
    const j = await r.json();
    setState(j.integrations?.[platform] || null);
  }

  useEffect(() => { refresh(); }, [platform]);

  const meta = META[platform] || META.LinkedIn;
  const error = qs.get("error");
  const connected = state?.connected;

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
            <strong>Developer app setup required</strong>
            <span>Add this platform's Client ID and Client Secret in Vercel Environment Variables, then redeploy.</span>
          </div>
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
              {state?.configured ? `Connect securely with ${platform}` : "Developer app setup required"}
            </a>
            <a className="secondaryBtn wideBtn" href={OFFICIAL[platform]} target="_blank" rel="noreferrer">
              Open official {platform} login
            </a>
            {!state?.configured && (
              <div className="noteBox">
                You can log into the correct account on the official website now. Automatic posting becomes available after this app has the platform OAuth Client ID and Client Secret configured.
              </div>
            )}
          </>
        )}

        <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>

        <div className="steps">
          <div><b>1</b><span>Create the provider developer app once.</span></div>
          <div><b>2</b><span>Add Client ID/Secret in Vercel.</span></div>
          <div><b>3</b><span>Add the callback URL shown in README.</span></div>
          <div><b>4</b><span>{platform === "Bluesky" ? "Configure the Bluesky App Password securely, then refresh." : `Click Connect securely with ${platform} and approve access on the provider website.`}</span></div>
        </div>
      </section>
    </main>
  );
}
