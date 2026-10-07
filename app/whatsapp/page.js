"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function maskPhone(v){
  const s=String(v||"").trim();
  if(!s) return "Phone number hidden";
  const digits=s.replace(/\D/g,"");
  if(digits.length<5) return s;
  return s.replace(digits, digits.slice(0,2)+" ••••• "+digits.slice(-5));
}

export default function WhatsAppHub(){
  const qs=useSearchParams();
  const [numbers,setNumbers]=useState([]);
  const [history,setHistory]=useState([]);
  const [selected,setSelected]=useState([]);
  const [showAdd,setShowAdd]=useState(false);
  const [label,setLabel]=useState("");
  const [displayPhone,setDisplayPhone]=useState("");
  const [phoneNumberId,setPhoneNumberId]=useState("");
  const [wabaId,setWabaId]=useState("");
  const [accessToken,setAccessToken]=useState("");
  const [text,setText]=useState("");
  const [mediaUrl,setMediaUrl]=useState("");
  const [scheduledFor,setScheduledFor]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  async function refresh(){
    setNotice("");
    try{
      const [nr,hr]=await Promise.all([
        fetch("/api/whatsapp/numbers",{cache:"no-store"}),
        fetch("/api/whatsapp/status",{cache:"no-store"})
      ]);
      const [nj,hj]=await Promise.all([nr.json(),hr.json()]);
      if(!nr.ok||!nj.ok) throw new Error(nj.error||"Unable to load WhatsApp numbers.");
      if(!hr.ok||!hj.ok) throw new Error(hj.error||"Unable to load WhatsApp history.");
      setNumbers(nj.numbers||[]);
      setHistory(hj.history||[]);
      setSelected(prev=>prev.filter(id=>(nj.numbers||[]).some(n=>n.id===id)));
    }catch(e){
      setNotice(e.message||"Unable to load WhatsApp Hub.");
    }
  }

  useEffect(()=>{
    refresh();
    if(qs.get("add")==="1") setShowAdd(true);
  },[]);

  const connectedCount=useMemo(()=>numbers.filter(n=>n.connected&&n.enabled!==false).length,[numbers]);

  async function addNumber(e){
    e.preventDefault();
    setBusy(true);setNotice("Validating and saving WhatsApp number...");
    try{
      const r=await fetch("/api/whatsapp/numbers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"add",label,displayPhone,phoneNumberId,wabaId,accessToken
      })});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||"Unable to save WhatsApp number.");
      setLabel("");setDisplayPhone("");setPhoneNumberId("");setWabaId("");setAccessToken("");
      setShowAdd(false);setNotice("WhatsApp number saved in shared encrypted storage.");
      await refresh();
    }catch(e){setNotice(e.message||"Unable to save WhatsApp number.");}
    finally{setBusy(false);}
  }

  async function removeNumber(id){
    if(!confirm("Remove this WhatsApp number from NUNES Social Studio?")) return;
    setBusy(true);
    try{
      const r=await fetch("/api/whatsapp/numbers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"remove",id})});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||"Unable to remove number.");
      await refresh();
    }catch(e){setNotice(e.message||"Unable to remove number.");}
    finally{setBusy(false);}
  }

  async function saveStatus(action){
    setBusy(true);setNotice("");
    try{
      const r=await fetch("/api/whatsapp/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action,text,mediaUrl,numberIds:selected,scheduledFor
      })});
      const j=await r.json();
      if(!r.ok){
        setNotice(j.error||"WhatsApp status action could not be completed.");
        if(j.entry) setHistory(prev=>[j.entry,...prev]);
        return;
      }
      setHistory(prev=>[j.entry,...prev]);
      setNotice(action==="schedule"
        ?"Schedule saved as a manual-publish reminder. WhatsApp Business Platform does not currently provide direct Status publishing."
        :"Status draft saved.");
    }catch(e){setNotice(e.message||"WhatsApp status action failed.");}
    finally{setBusy(false);}
  }

  function toggleAll(){
    const ids=numbers.filter(n=>n.connected&&n.enabled!==false).map(n=>n.id);
    setSelected(selected.length===ids.length?[]:ids);
  }

  return <div className="appShell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
      <div className="sideGroupLabel">OVERVIEW</div>
      <nav className="sideNav">
        <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
        <a className="sideLink" href="/"><span>◎</span>Social Accounts</a>
      </nav>
      <div className="sideGroupLabel">WHATSAPP</div>
      <nav className="sideNav secondary">
        <a className="sideLink active" href="/whatsapp"><span>WA</span>WhatsApp Hub</a>
      </nav>
      <div className="sidebarBottom"><a className="sideLink" href="/">← Back to Command Center</a></div>
    </aside>

    <section className="workspace">
      <header className="workspaceTop">
        <div><strong>WhatsApp Hub</strong></div>
        <div className="topActions"><button className="quickCreate" onClick={()=>setShowAdd(true)}>＋ Add WhatsApp Number</button><div className="miniAvatar">NI</div></div>
      </header>

      <main className="contentArea">
        <div className="pageHeading">
          <div><span>WHATSAPP BUSINESS</span><h1>WhatsApp Hub</h1><p>Manage NUNES WhatsApp Business numbers separately from social publishing accounts.</p></div>
          <span className={connectedCount?"pill ok":"pill"}>{connectedCount} Numbers Connected</span>
        </div>

        {notice&&<div className="warning"><strong>Status</strong><span>{notice}</span></div>}

        <section className="waNumberGrid">
          {numbers.length?numbers.map((n,index)=><article className="waNumberCard" key={n.id}>
            <div className="waNumberTop">
              <div className="whatsappBadge">WA</div>
              <div><strong>{n.label||`NUNES WHATSAPP ${index+1}`}</strong><span>{maskPhone(n.displayPhone)}</span></div>
              <span className={n.connected?"pill ok":"pill"}>{n.connected?"CONNECTED":"ACTION REQUIRED"}</span>
            </div>
            <div className="waMeta"><span>Phone Number ID</span><strong>{n.phoneNumberId||"—"}</strong></div>
            <div className="waMeta"><span>WABA ID</span><strong>{n.wabaId||"—"}</strong></div>
            <div className="waCardActions">
              <button onClick={()=>setSelected(s=>s.includes(n.id)?s.filter(x=>x!==n.id):[...s,n.id])}>{selected.includes(n.id)?"Selected ✓":"Select for Status"}</button>
              <button className="dangerLite" onClick={()=>removeNumber(n.id)} disabled={busy}>Remove</button>
            </div>
          </article>):<div className="panel empty">No WhatsApp Business numbers are connected yet. Add the first number to begin.</div>}
        </section>

        {showAdd&&<section className="panel waAddPanel">
          <div className="panelHead"><div><h2>Add WhatsApp Number</h2><p>Provider credentials are stored only in shared encrypted server storage.</p></div><button onClick={()=>setShowAdd(false)}>Close</button></div>
          <form className="grid two" onSubmit={addNumber}>
            <label>Business label<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="NUNES SALES" required/></label>
            <label>Display phone<input value={displayPhone} onChange={e=>setDisplayPhone(e.target.value)} placeholder="+91 ..."/></label>
            <label>WhatsApp Phone Number ID<input value={phoneNumberId} onChange={e=>setPhoneNumberId(e.target.value)} required/></label>
            <label>WhatsApp Business Account ID<input value={wabaId} onChange={e=>setWabaId(e.target.value)}/></label>
            <label className="waFull">System User / Permanent Access Token<input type="password" value={accessToken} onChange={e=>setAccessToken(e.target.value)} placeholder="Stored encrypted; never shown again"/></label>
            <div className="waFull"><button className="primary" disabled={busy}>{busy?"Saving...":"Validate & Add Number"}</button></div>
          </form>
        </section>}

        <section className="waComposerLayout">
          <article className="panel">
            <div className="panelHead"><div><h2>Create Status</h2><p>Build a WhatsApp Status draft for selected business numbers.</p></div><button onClick={toggleAll}>Select All</button></div>
            <div className="waSelectedNumbers">
              {numbers.map(n=><label key={n.id} className={n.connected?"":"disabledChoice"}><input type="checkbox" checked={selected.includes(n.id)} disabled={!n.connected} onChange={()=>setSelected(s=>s.includes(n.id)?s.filter(x=>x!==n.id):[...s,n.id])}/>{n.label}</label>)}
            </div>
            <label>Status text<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write the WhatsApp Status content..."/></label>
            <label>Media URL<input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="Optional public image/video URL"/></label>
            <label>Schedule reminder<input type="datetime-local" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}/></label>
            <div className="waComposerActions">
              <button onClick={()=>saveStatus("save")} disabled={busy}>Save Draft</button>
              <button onClick={()=>saveStatus("schedule")} disabled={busy||!scheduledFor}>Schedule</button>
              <button className="primary" onClick={()=>saveStatus("publish")} disabled={busy}>Publish Status</button>
            </div>
            <div className="important">
              <strong>Direct Status publishing limitation</strong>
              <span>Meta's official WhatsApp Business Platform supports business messaging, but it does not expose an API for publishing WhatsApp Status updates. NUNES therefore saves drafts/schedule reminders and will never report a fake Status publish success.</span>
            </div>
          </article>

          <article className="panel waPreview">
            <div className="panelHead"><div><h2>Preview</h2><p>{selected.length} number(s) selected</p></div></div>
            <div className="waPreviewPhone">
              <div className="waPreviewHeader">NUNES WhatsApp Status</div>
              {mediaUrl?<img src={mediaUrl} alt="Status preview"/>:<div className="waPreviewMedia">Media preview</div>}
              <div className="waPreviewText">{text||"Your status preview will appear here."}</div>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panelHead"><div><h2>History</h2><p>Saved drafts, manual schedules and attempted direct publishes.</p></div><span>{history.length} items</span></div>
          <div className="waHistory">
            {history.length?history.map(h=><div className="waHistoryRow" key={h.id}>
              <div><strong>{h.status||"DRAFT"}</strong><p>{h.text||"Media status"}</p><span>{new Date(h.createdAt).toLocaleString()}</span></div>
              <div><span>{h.numberIds?.length||0} number(s)</span>{h.scheduledFor&&<small>Scheduled: {new Date(h.scheduledFor).toLocaleString()}</small>}</div>
            </div>):<div className="empty">No WhatsApp status drafts yet.</div>}
          </div>
        </section>
      </main>
    </section>
  </div>;
}
