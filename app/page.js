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

const ANGLES = ["AUTO — Choose Best Angle","Educational","Problem / Solution","Industry Insight","Behind the Scenes","Product Spotlight","Buyer Question","How-To","Common Mistake","Quick Tip","New Arrival","Customer Problem","Comparison","FAQ","Company Update"];

function chooseAngle(topic){
  const t=topic.toLowerCase();
  if(/how|guide|choose|select/.test(t)) return "How-To";
  if(/mistake|avoid|wrong/.test(t)) return "Common Mistake";
  if(/new|launch|arrival/.test(t)) return "New Arrival";
  if(/problem|issue|why/.test(t)) return "Problem / Solution";
  return "Educational";
}

function buildVariants(topic,brief,angle,cta){
  const resolved=angle===ANGLES[0]?chooseAngle(topic):angle;
  const intro=resolved==="How-To"
    ? `A simple way to approach ${topic} is to start with the actual application before comparing models or prices.`
    : resolved==="Common Mistake"
    ? `A common mistake with ${topic} is deciding too early, before the real requirement is clear.`
    : resolved==="Problem / Solution"
    ? `If ${topic} is creating confusion or delay, simplify the requirement first and then compare the available options.`
    : `Here is a practical way to think about ${topic}.`;
  const body=brief||"Define the application, required result, working conditions, quantity and location first. That makes the recommendation clearer and avoids choosing something that does not fit the actual job.";
  const action=cta||"Send us your requirement, quantity and location and our team will help with the next step.";
  return {
    LinkedIn:`${intro}\n\n${body}\n\nGood selection is not only about a model number. It is about matching the instrument or solution to the real application and checking the relevant specification before purchase.\n\n${action}\n\n#NunesInstruments #Instrumentation #IndustrialSolutions`,
    Instagram:`${intro}\n\n${body}\n\nNeed help choosing? Send us your requirement.\n\n#NunesInstruments #Instrumentation #TestingEquipment #IndustrialTools #Laboratory #Engineering`,
    Facebook:`${intro}\n\n${body}\n\n${action} We will keep the recommendation practical and based on what you actually need.\n\n#NunesInstruments`,
    Threads:`${intro} ${body} If you have a similar requirement, send us the application details and we will help narrow it down.`,
    X:`${intro} ${body} Need help? Send the application + quantity. #NunesInstruments`,
    Bluesky:`${intro}\n\n${body}\n\nHave a similar requirement? Share the details and we will help you work through it.`,
    Pinterest:`${topic}: ${body}\n\nSave this for your next requirement. For selection support, share the application and quantity with Nunes Instruments.`,
    TikTok:`${intro}\n\n${body}\n\nFollow for more practical instrumentation tips. Message us if you need help choosing.`,
    YouTube:`${topic} — practical buyer guidance from Nunes Instruments.\n\n${body}\n\n${action} Subscribe for more instrumentation, testing and laboratory equipment guidance.`
  };
}

export default function Home(){
  const [tab,setTab]=useState("Dashboard");
  const [topic,setTopic]=useState("");
  const [brief,setBrief]=useState("");
  const [cta,setCta]=useState("");
  const [angle,setAngle]=useState(ANGLES[0]);
  const [mediaUrl,setMediaUrl]=useState("");
  const [selected,setSelected]=useState(PLATFORMS.map(x=>x[0]));
  const [drafts,setDrafts]=useState({});
  const [connections,setConnections]=useState({});
  const [results,setResults]=useState([]);
  const [search,setSearch]=useState("");
  const [timeframe,setTimeframe]=useState("7 Days");

  async function refreshConnections(){
    try{
      const r=await fetch("/api/integrations/status",{cache:"no-store"});
      const j=await r.json();
      setConnections(j.integrations||{});
    }catch{}
  }
  useEffect(()=>{refreshConnections()},[]);

  const connectedCount=useMemo(()=>PLATFORMS.filter(p=>connections[p[0]]?.connected).length,[connections]);
  const readyCount=useMemo(()=>PLATFORMS.filter(p=>connections[p[0]]?.configured).length,[connections]);
  const successfulPosts=results.filter(r=>r.status==="POSTED").length;

  function runSearch(){
    const q=search.trim().toLowerCase();
    if(!q) return;
    const platform=PLATFORMS.find(([name])=>name.toLowerCase().includes(q));
    if(platform){
      window.location.href=`/connect/${encodeURIComponent(platform[0])}`;
      return;
    }
    if(q.includes("connect")||q.includes("network")) return setTab("Connections");
    if(q.includes("result")||q.includes("history")) return setTab("Results");
    if(q.includes("preview")||q.includes("publish")) return setTab("Preview");
    if(q.includes("create")||q.includes("post")||q.includes("content")) return setTab("Create Post");
    setTab("Dashboard");
  }

  function generate(){
    if(!topic.trim()) return alert("Add a post topic first.");
    const all=buildVariants(topic.trim(),brief.trim(),angle,cta.trim());
    const out={}; selected.forEach(p=>out[p]=all[p]); setDrafts(out); setTab("Preview");
  }

  async function postEverywhere(){
    const rr=[];
    for(const platform of selected){
      if(!drafts[platform]) continue;
      try{
        const r=await fetch("/api/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,channel:platform,text:drafts[platform],mediaUrl,angle})});
        const j=await r.json();
        rr.push({platform,status:j.external?.status||(j.ok?"ARCHIVED":"FAILED"),error:j.external?.error||null});
      }catch{rr.push({platform,status:"FAILED"})}
    }
    setResults(rr); setTab("Results");
  }

  const nav=[
    ["Dashboard","⌂"],["Create Post","＋"],["Connections","◎"],["Preview","▣"],["Results","✓"]
  ];

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          {nav.map(([name,icon])=><button key={name} onClick={()=>setTab(name)} className={tab===name?"active":""}><span>{icon}</span>{name}</button>)}
        </nav>

        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <button onClick={()=>setTab("Connections")}><span>↗</span>Social Networks</button>
          <button onClick={()=>setTab("Create Post")}><span>▤</span>Content</button>
          <button onClick={()=>setTab("Preview")}><span>➤</span>Publishing</button>
          <button onClick={()=>setTab("Dashboard")}><span>⌁</span>Analytics</button>
        </nav>

        <div className="sidebarBottom">
          <button onClick={()=>setTab("Connections")}>⚙ Settings</button>
          <div className="userCard"><div className="avatar">NI</div><div><strong>Nunes Instruments</strong><span>Admin</span></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspaceTop">
          <div className="searchBox">⌕<input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runSearch()}} placeholder="Search anything..."/></div>
          <div className="topActions">
            <button className="quickCreate" onClick={()=>setTab("Create Post")}>＋ Quick Create</button>
            <button className="iconBtn" title="Publishing results" onClick={()=>setTab("Results")}>✓</button>
            <button className="iconBtn" title="Social connections" onClick={()=>setTab("Connections")}>◎</button>
            <div className="miniAvatar">NI</div>
          </div>
        </header>

        <main className="contentArea">
          {tab==="Dashboard" && (
            <>
              <div className="welcomeRow">
                <div><h1>Good morning 👋</h1><p>Here’s what’s happening across your social publishing workspace today.</p></div>
                <div className="filters"><button onClick={()=>setTab("Connections")}>Account: Nunes Instruments</button><button onClick={()=>setTimeframe(v=>v==="7 Days"?"30 Days":v==="30 Days"?"90 Days":"7 Days")}>Timeframe: {timeframe}</button></div>
              </div>

              <section className="metricGrid">
                <div className="metricCard"><span>CONNECTED NETWORKS</span><strong>{connectedCount}/9</strong><small>{readyCount} configured</small></div>
                <div className="metricCard"><span>POSTS READY</span><strong>{Object.keys(drafts).length}</strong><small>{selected.length} selected</small></div>
                <div className="metricCard"><span>POSTED THIS RUN</span><strong>{successfulPosts}</strong><small>{results.length||0} checked</small></div>
                <div className="metricCard"><span>STATUS</span><strong>Live</strong><small>Direct OAuth/API</small></div>
              </section>

              <section className="networkCards">
                {["Instagram","TikTok","YouTube","LinkedIn"].map(name=>{
                  const p=PLATFORMS.find(x=>x[0]===name);
                  return <button key={name} className="networkCard" onClick={()=>{window.location.href=`/connect/${encodeURIComponent(name)}`}}>
                    <div className="networkHead"><span className="miniPlatform">{p?.[1]}</span><strong>{name}</strong><em className={connections[name]?.connected?"good":"mutedDot"}>{connections[name]?.connected?"Connected":"Setup"}</em></div>
                    <div className="networkValue">{connections[name]?.connected?"Ready":"—"}</div>
                    <svg viewBox="0 0 120 32" aria-hidden="true"><polyline points="0,26 15,23 28,25 42,17 58,19 72,12 88,14 103,8 120,5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                  </button>
                })}
              </section>

              <section className="analyticsPanel">
                <div className="panelTitle"><div><h2>Audience Growth</h2><p>Follower progress across connected channels</p></div><div className="segment"><button className="active" onClick={()=>setTab("Connections")}>All Networks</button><button className={timeframe==="7 Days"?"active":""} onClick={()=>setTimeframe("7 Days")}>7 Days</button><button className={timeframe==="30 Days"?"active":""} onClick={()=>setTimeframe("30 Days")}>30 Days</button></div></div>
                <div className="analyticsStats"><div><span>Total Networks</span><strong>{connectedCount}</strong></div><div><span>Configured</span><strong>{readyCount}</strong></div><div><span>Selected</span><strong>{selected.length}</strong></div><div><span>Success Rate</span><strong>{results.length?Math.round(successfulPosts/results.length*100):0}%</strong></div></div>
                <div className="chartWrap"><svg viewBox="0 0 900 240" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16a9df" stopOpacity=".22"/><stop offset="100%" stopColor="#16a9df" stopOpacity="0"/></linearGradient></defs><path d="M0 205 L90 185 L170 198 L255 160 L350 142 L435 165 L520 112 L610 120 L700 90 L795 72 L900 30 L900 240 L0 240 Z" fill="url(#fill)"/><polyline points="0,205 90,185 170,198 255,160 350,142 435,165 520,112 610,120 700,90 795,72 900,30" fill="none" stroke="#16a9df" strokeWidth="4"/></svg></div>
              </section>

              <section className="engagementPanel">
                <div className="panelTitle"><div><h2>Publishing Overview</h2><p>Current workflow health and account readiness</p></div><button className="moreBtn" onClick={()=>setTab("Results")}>•••</button></div>
                <div className="overviewStats"><div><span>Connected</span><strong>{connectedCount}</strong></div><div><span>Configured</span><strong>{readyCount}</strong></div><div><span>Drafts</span><strong>{Object.keys(drafts).length}</strong></div><div><span>Selected</span><strong>{selected.length}</strong></div><div><span>Results</span><strong>{results.length}</strong></div></div>
                <div className="distribution"><span style={{width:`${Math.max(10,connectedCount/9*100)}%`}}>Connected</span><span style={{width:`${Math.max(10,(9-connectedCount)/9*100)}%`}}>Pending</span></div>
              </section>
            </>
          )}

          {tab==="Create Post" && (
            <>
              <div className="pageHeading"><div><span>CONTENT</span><h1>Create a new post</h1><p>Build one idea and adapt it for every selected network.</p></div><button className="primary" onClick={generate}>Generate Posts</button></div>
              <section className="grid two">
                <article className="panel"><h3>Post brief</h3>
                  <label>Post topic / idea<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Example: How to choose the right measuring instrument"/></label>
                  <label>Key message / context<textarea value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Add facts, offer, application, event or message."/></label>
                  <label>Content angle<select value={angle} onChange={e=>setAngle(e.target.value)}>{ANGLES.map(x=><option key={x}>{x}</option>)}</select></label>
                  <label>CTA<input value={cta} onChange={e=>setCta(e.target.value)} placeholder="Example: Send us your application and quantity"/></label>
                  <label>Media URL (optional)<input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="Public image/video URL"/></label>
                </article>
                <article className="panel"><div className="panelHead"><h3>Publish to</h3><span>{selected.length}/9 selected</span></div>
                  <div className="platformGrid">{PLATFORMS.map(([name,icon])=><button key={name} className={`platformCard ${selected.includes(name)?"selected":""}`} onClick={()=>setSelected(s=>s.includes(name)?s.filter(x=>x!==name):[...s,name])}><span className="platformIcon">{icon}</span><strong>{name}</strong><i className={connections[name]?.connected?"conn on":"conn"}>{connections[name]?.connected?"Connected":"Not connected"}</i></button>)}</div>
                </article>
              </section>
            </>
          )}

          {tab==="Preview" && (
            <>
              <div className="pageHeading"><div><span>PUBLISHING</span><h1>Preview & edit</h1><p>Review each platform version before publishing.</p></div><button className="primary" onClick={postEverywhere}>Post Everywhere</button></div>
              <section className="grid two">{selected.map(name=>{const p=PLATFORMS.find(x=>x[0]===name);return <article className="panel" key={name}><div className="panelHead"><h3>{name}</h3><span>{p?.[2]}</span></div><small>{p?.[3]}</small><textarea className="postEditor" value={drafts[name]||""} onChange={e=>setDrafts(d=>({...d,[name]:e.target.value}))}/></article>})}</section>
            </>
          )}

          {tab==="Connections" && (
            <>
              <div className="pageHeading"><div><span>SOCIAL NETWORKS</span><h1>Connect your accounts</h1><p>Direct OAuth/API connection. n8n is not required.</p></div><button onClick={refreshConnections}>Refresh</button></div>
              <section className="accounts modernAccounts">
                <div className="important"><strong>Secure connection</strong><span>Use each provider's official authorization flow. API credentials can be saved from the platform setup page.</span></div>
                <div className="loginList">{PLATFORMS.map(([name,icon])=><div className="loginRow" key={name}><a className={`socialLogin ${name.toLowerCase()}`} href={`/connect/${encodeURIComponent(name)}`}><span>{icon}</span>{connections[name]?.connected?"Manage":"Connect"} {name}</a><span className={connections[name]?.connected?"pill ok":"pill"}>{connections[name]?.mode||"not-connected"}</span></div>)}</div>
              </section>
            </>
          )}

          {tab==="Results" && (
            <>
              <div className="pageHeading"><div><span>RESULTS</span><h1>Publishing results</h1><p>Exact status returned for every selected network.</p></div></div>
              <section className="panel">{results.length?results.map(r=><div className="resultRow" key={r.platform}><strong>{r.platform}</strong><span className={`pill ${r.status==="POSTED"?"ok":""}`}>{r.status}</span>{r.error&&<small>{r.error}</small>}</div>):<div className="empty">No posting run yet.</div>}</section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}
