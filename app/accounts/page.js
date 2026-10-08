"use client";

import { useEffect, useMemo, useState } from "react";

const META={
  LinkedIn:{icon:"in",cls:"li",manage:"https://www.linkedin.com/"},
  Facebook:{icon:"f",cls:"fb",manage:"https://business.facebook.com/latest/home"},
  Instagram:{icon:"◎",cls:"ig",manage:"https://business.facebook.com/latest/home"},
  YouTube:{icon:"▶",cls:"yt",manage:"https://studio.youtube.com/"},
  WhatsApp:{icon:"WA",cls:"wa",manage:"https://business.facebook.com/wa/manage/home"}
};

function dateText(v){
  if(!v) return "Not synchronized";
  try{return new Date(v).toLocaleString()}catch{return v}
}

export default function AccountsHub(){
  const [data,setData]=useState(null);
  const [selected,setSelected]=useState("Facebook");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function refresh(){
    setLoading(true);
    setError("");
    try{
      const r=await fetch("/api/accounts/hub",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||"Account health unavailable");
      setData(j);
      const names=Object.keys(j.accounts||{});
      if(names.length && !j.accounts?.[selected]) setSelected(names[0]);
    }catch(e){setError(e.message||"Could not fetch account health.");}finally{setLoading(false)}
  }

  useEffect(()=>{refresh()},[]);
  const accounts=data?.accounts||{};
  const active=accounts[selected]||{};
  const connected=useMemo(()=>Object.values(accounts).filter(x=>x.connected).length,[accounts]);

  return <div className="appShell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
      <div className="sideGroupLabel">OVERVIEW</div>
      <nav className="sideNav">
        <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
        <a className="sideLink active" href="/accounts"><span>◎</span>Accounts Hub</a>
        <a className="sideLink" href="/#connections"><span>↗</span>Connections</a>
      </nav>
      <div className="sideGroupLabel">SOCIAL</div>
      <nav className="sideNav secondary">
        <a className="sideLink" href="/connect/Meta"><span>M</span>Meta Business</a>
        <a className="sideLink" href="/"><span>▤</span>Content</a>
        <a className="sideLink" href="/"><span>➤</span>Publishing</a>
      </nav>
      <div className="sidebarBottom">
        <a className="sideLink" href="/connect/Meta">⚙ Settings</a>
        <div className="userCard"><div className="avatar">NI</div><div><strong>Nunes Instruments</strong><span>Admin</span></div></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="workspaceTop">
        <div className="searchBox">⌕<input placeholder="Search accounts, posts, messages..."/></div>
        <div className="topActions">
          <a className="quickCreate" href="/">＋ Quick Create</a>
          <button className="iconBtn" onClick={refresh} title="Refresh">↻</button>
          <div className="miniAvatar">NI</div>
        </div>
      </header>

      <main className="contentArea">
        <div className="pageHeading">
          <div><span>ACCOUNT MANAGEMENT</span><h1>Accounts Hub</h1><p>Manage connected social accounts, content and provider access from one workspace.</p></div>
          <span className={connected?"pill ok":"pill"}>{connected}/5 CONNECTED</span>
        </div>

        <section className="accountHubCards">
          {Object.entries(accounts).map(([name,a])=>{
            const m=META[name]||{};
            return <button key={name} className={"accountHubCard "+(selected===name?"selected":"")} onClick={()=>setSelected(name)}>
              <div className={"accountHubIcon "+m.cls}>{m.icon}</div>
              <div><strong>{name}</strong><span>{a.name||a.phone||"Account"}</span></div>
              <em className={a.connected?"good":"pending"}>{a.connected?"Connected":"Not connected"}</em>
            </button>
          })}
        </section>

        {error&&<div className="warning" role="alert">{error}</div>}
        {loading && <div className="panel"><div className="empty">Loading account activity…</div></div>}

        {!loading && <section className="accountHubLayout">
          <article className="panel accountManagerPanel">
            <div className="panelHead">
              <div>
                <h2>{selected}</h2>
                <p>{active.name||active.phone||"Connected account management"}</p>
              </div>
              <span className={active.connected?"pill ok":"pill"}>{active.connected?"CONNECTED":"NOT CONNECTED"}</span>
            </div>

            <div className="accountIdentity">
              <div className={"accountHubIcon large "+(META[selected]?.cls||"")}>{META[selected]?.icon}</div>
              <div>
                <strong>{active.name||selected}</strong>
                {active.phone&&<span>{active.phone}</span>}
                {active.accountId&&<small>ID: {active.accountId}</small>}
                <small>Connection health: {active.connectionHealth||"unknown"}</small>
                {active.connectionError&&<small role="alert">{active.connectionError}</small>}
              </div>
              <a href={selected==="Facebook"||selected==="Instagram"?"/connect/Meta":selected==="LinkedIn"?"/connect/LinkedIn":selected==="YouTube"?"/connect/YouTube":"/whatsapp"} className="secondaryBtn">
                {active.connected?"Connection settings":"Connect account"}
              </a>
            </div>

            <div className="managementGrid">
              {(active.capabilities||[]).map(cap=><div className="managementTile" key={cap}>
                <strong>{cap}</strong>
                <span>{cap==="Content"?"Create, review and publish content":
                       cap==="Ads"?"Open ad tools for this business account":
                       cap==="Insights"?"Review provider performance and account data":
                       cap==="Messages"?"Access business messaging workflow":
                       cap==="Comments"?"Manage engagement and replies":
                       cap==="Templates"?"Manage WhatsApp business templates":
                       cap==="Permissions"?"Review account and business access":
                       "Manage account configuration"}</span>
              </div>)}
            </div>

            <div className="accountActions">
              <a className="primary" href="/">Create / Publish Content</a>
              <a className="secondaryBtn" href={META[selected]?.manage||"#"} target="_blank" rel="noreferrer">Open official account manager ↗</a>
              <button className="secondaryBtn" onClick={refresh}>Refresh account data</button>
            </div>
          </article>

          <article className="panel accountFeedPanel">
            <div className="panelHead">
              <div><h2>{selected==="WhatsApp"?"Recent activity":"Recent posts"}</h2><p>{selected==="WhatsApp"?"Messaging activity saved by NUNES":"Latest provider posts when available, otherwise NUNES publishing history"}</p></div>
              <span>{active.recent?.length||0} items</span>
            </div>

            <div className="accountFeed">
              {(active.recent||[]).length===0
                ? <div className="empty">{selected==="Instagram"&&!active.connected
                    ?"Connect the Instagram Professional account to load its posts here."
                    : selected==="WhatsApp"
                    ?"No WhatsApp activity has been stored by NUNES yet."
                    :"No recent posts available yet. New NUNES posts will appear here automatically."}</div>
                : (active.recent||[]).map((p,i)=><div className="accountPost" key={p.id||i}>
                    {p.mediaUrl&&<img src={p.mediaUrl} alt="" loading="lazy"/>}
                    <div>
                      <strong>{p.topic||p.source||selected}</strong>
                      <p>{p.text||"Published media"}</p>
                      <span>{dateText(p.createdAt||p.publishedAt)}</span>
                      {p.external?.status&&<em>{p.external.status}</em>}
                      {p.url&&<a href={p.url} target="_blank" rel="noreferrer">Open post ↗</a>}
                    </div>
                  </div>)
              }
            </div>
          </article>
        </section>}
      </main>
    </section>
  </div>
}