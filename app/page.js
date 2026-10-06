"use client";

import { useEffect, useMemo, useState } from "react";

const PLATFORMS = [
  ["LinkedIn","in","80–140 words","Professional, conversational"],
  ["Instagram","◎","45–90 words","Visual, energetic"],
  ["Facebook","f","60–120 words","Friendly, practical"],
  ["Threads","@","35–80 words","Conversational, concise"],
  ["X","X","20–45 words","Sharp, concise"],
  ["Bluesky","☁","25–60 words","Natural, community-led"],
  ["Pinterest","P","35–80 words","Searchable, benefit-led"],
  ["TikTok","♪","20–55 words","Short, energetic"],
  ["YouTube","▶","40–100 words","Clear, searchable"]
];

const ANGLES = [
  "AUTO — Choose Best Angle","Educational","Problem / Solution","Industry Insight",
  "Behind the Scenes","Product Spotlight","Buyer Question","How-To","Common Mistake",
  "Quick Tip","New Arrival","Customer Problem","Comparison","FAQ","Company Update"
];

function chooseAngle(topic) {
  const t = topic.toLowerCase();
  if (/how|guide|choose|select/.test(t)) return "How-To";
  if (/mistake|avoid|wrong/.test(t)) return "Common Mistake";
  if (/new|launch|arrival/.test(t)) return "New Arrival";
  if (/problem|issue|why/.test(t)) return "Problem / Solution";
  return "Educational";
}

function buildVariants(topic, brief, angle, cta) {
  const resolved = angle === ANGLES[0] ? chooseAngle(topic) : angle;
  const intro = resolved === "How-To"
    ? `A simple way to approach ${topic} is to start with the actual application before comparing models or prices.`
    : resolved === "Common Mistake"
    ? `A common mistake with ${topic} is deciding too early, before the real requirement is clear.`
    : resolved === "Problem / Solution"
    ? `If ${topic} is creating confusion or delay, simplify the requirement first and then compare the available options.`
    : `Here is a practical way to think about ${topic}.`;

  const body = brief || "Define the application, required result, working conditions, quantity and location first. That makes the recommendation clearer and avoids choosing something that does not fit the actual job.";
  const action = cta || "Send us your requirement, quantity and location and our team will help with the next step.";

  return {
    LinkedIn: `${intro}\n\n${body}\n\nGood selection is not only about a model number. It is about matching the instrument or solution to the real application and checking the relevant specification before purchase.\n\n${action}\n\n#NunesInstruments #Instrumentation #IndustrialSolutions`,
    Instagram: `${intro}\n\n${body}\n\nNeed help choosing? Send us your requirement.\n\n#NunesInstruments #Instrumentation #TestingEquipment #IndustrialTools #Laboratory #Engineering`,
    Facebook: `${intro}\n\n${body}\n\n${action} We will keep the recommendation practical and based on what you actually need.\n\n#NunesInstruments`,
    Threads: `${intro} ${body} If you have a similar requirement, send us the application details and we will help narrow it down.`,
    X: `${intro} ${body} Need help? Send the application + quantity. #NunesInstruments`,
    Bluesky: `${intro}\n\n${body}\n\nHave a similar requirement? Share the details and we will help you work through it.`,
    Pinterest: `${topic}: ${body}\n\nSave this for your next requirement. For selection support, share the application and quantity with Nunes Instruments.`,
    TikTok: `${intro}\n\n${body}\n\nFollow for more practical instrumentation tips. Message us if you need help choosing.`,
    YouTube: `${topic} — practical buyer guidance from Nunes Instruments.\n\n${body}\n\n${action} Subscribe for more instrumentation, testing and laboratory equipment guidance.`
  };
}

export default function Home() {
  const [tab, setTab] = useState("Create Post");
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [cta, setCta] = useState("");
  const [angle, setAngle] = useState(ANGLES[0]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [selected, setSelected] = useState(PLATFORMS.map(x => x[0]));
  const [drafts, setDrafts] = useState({});
  const [connections, setConnections] = useState({});
  const [results, setResults] = useState([]);

  async function refreshConnections() {
    try {
      const r = await fetch("/api/integrations/status", { cache: "no-store" });
      const j = await r.json();
      setConnections(j.integrations || {});
    } catch {}
  }

  useEffect(() => { refreshConnections(); }, []);

  const connectedCount = useMemo(
    () => PLATFORMS.filter(p => connections[p[0]]?.connected).length,
    [connections]
  );

  function generate() {
    if (!topic.trim()) return alert("Add a post topic first.");
    const all = buildVariants(topic.trim(), brief.trim(), angle, cta.trim());
    const out = {};
    selected.forEach(p => out[p] = all[p]);
    setDrafts(out);
    setTab("Preview");
  }

  async function postEverywhere() {
    const rr = [];
    for (const platform of selected) {
      if (!drafts[platform]) continue;
      try {
        const r = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, channel: platform, text: drafts[platform], mediaUrl, angle })
        });
        const j = await r.json();
        rr.push({
          platform,
          status: j.external?.status || (j.ok ? "ARCHIVED" : "FAILED"),
          error: j.external?.error || null
        });
      } catch {
        rr.push({ platform, status: "FAILED" });
      }
    }
    setResults(rr);
    setTab("Results");
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">NUNES INSTRUMENTS</span>
          <h1>Social Post Machine</h1>
          <p>One idea → platform-native posts → direct account publishing → result tracking</p>
        </div>
        <div className="badges">
          <span className="badge live">LIVE</span>
          <span className="badge">{connectedCount}/9 CONNECTED</span>
        </div>
      </header>

      <nav className="nav">
        {["Create Post","Preview","Results","Connections"].map(x => (
          <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>
        ))}
      </nav>

      {tab === "Create Post" && (
        <>
          <section className="hero">
            <div>
              <span>POST MACHINE</span>
              <h2>Create once. Adapt properly. Publish everywhere.</h2>
              <p>Use any announcement, tip, image, video, company update, buyer guide, offer, event or campaign idea.</p>
            </div>
            <button className="primary" onClick={generate}>Generate Posts</button>
          </section>

          <section className="grid two">
            <article className="panel">
              <h3>Post brief</h3>
              <label>Post topic / idea<input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Example: How to choose the right measuring instrument"/></label>
              <label>Key message / context<textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="Add facts, offer, application, event or message."/></label>
              <label>Content angle<select value={angle} onChange={e => setAngle(e.target.value)}>{ANGLES.map(x => <option key={x}>{x}</option>)}</select></label>
              <label>CTA<input value={cta} onChange={e => setCta(e.target.value)} placeholder="Example: Send us your application and quantity"/></label>
              <label>Media URL (optional)<input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="Public image/video URL"/></label>
            </article>

            <article className="panel">
              <div className="panelHead"><h3>Publish to</h3><span>{selected.length}/9 selected</span></div>
              <div className="platformGrid">
                {PLATFORMS.map(([name, icon]) => (
                  <button
                    key={name}
                    className={`platformCard ${selected.includes(name) ? "selected" : ""}`}
                    onClick={() => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name])}
                  >
                    <span className="platformIcon">{icon}</span>
                    <strong>{name}</strong>
                    <i className={connections[name]?.connected ? "conn on" : "conn"}>
                      {connections[name]?.connected ? "Connected" : "Not connected"}
                    </i>
                  </button>
                ))}
              </div>
            </article>
          </section>
        </>
      )}

      {tab === "Preview" && (
        <>
          <section className="hero">
            <div><span>PREVIEW</span><h2>Review every platform version.</h2><p>Edit any version before publishing.</p></div>
            <button className="primary" onClick={postEverywhere}>Post Everywhere</button>
          </section>
          <section className="grid two">
            {selected.map(name => {
              const p = PLATFORMS.find(x => x[0] === name);
              return (
                <article className="panel" key={name}>
                  <div className="panelHead"><h3>{name}</h3><span>{p?.[2]}</span></div>
                  <small>{p?.[3]}</small>
                  <textarea
                    className="postEditor"
                    value={drafts[name] || ""}
                    onChange={e => setDrafts(d => ({ ...d, [name]: e.target.value }))}
                  />
                </article>
              );
            })}
          </section>
        </>
      )}

      {tab === "Connections" && (
        <section className="accounts">
          <div className="panelHead">
            <div><h2>Add a social account</h2><p>Direct OAuth/API connection. n8n is not required.</p></div>
            <button onClick={refreshConnections}>Refresh</button>
          </div>
          <div className="important">
            <strong>Important</strong>
            <span>Use the provider's official login/authorization. Do not enter social-media passwords into this app.</span>
          </div>
          <div className="loginList">
            {PLATFORMS.map(([name, icon]) => (
              <div className="loginRow" key={name}>
                <a className={`socialLogin ${name.toLowerCase()}`} href={`/connect/${encodeURIComponent(name)}`}>
                  <span>{icon}</span>Login with {name}
                </a>
                <span className={connections[name]?.connected ? "pill ok" : "pill"}>
                  {connections[name]?.mode || "not-connected"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "Results" && (
        <section className="panel">
          <div className="panelHead"><h2>Posting results</h2><span>{results.length} platforms</span></div>
          {results.length ? results.map(r => (
            <div className="resultRow" key={r.platform}>
              <strong>{r.platform}</strong>
              <span className={`pill ${r.status === "POSTED" ? "ok" : ""}`}>{r.status}</span>
              {r.error && <small>{r.error}</small>}
            </div>
          )) : <div className="empty">No posting run yet.</div>}
        </section>
      )}
    </main>
  );
}
