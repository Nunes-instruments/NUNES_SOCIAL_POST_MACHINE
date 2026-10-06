"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
          <div className="warning">
            <strong>Bluesky uses an App Password</strong>
            <span>Add BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in Vercel. Do not use your normal password.</span>
          </div>
        ) : (
          <a className="loginBtn" style={{ background: meta.color }} href={`/api/oauth/${platform.toLowerCase()}/start`}>
            Login with {platform}
          </a>
        )}

        <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>

        <div className="steps">
          <div><b>1</b><span>Create the provider developer app once.</span></div>
          <div><b>2</b><span>Add Client ID/Secret in Vercel.</span></div>
          <div><b>3</b><span>Add the callback URL shown in README.</span></div>
          <div><b>4</b><span>Click Login with {platform} and approve access.</span></div>
        </div>
      </section>
    </main>
  );
}
