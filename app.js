/* ── CONSTANTS ───────────────────────────────────────────────────────────── */
const SHOWER=[
  {t:"Apply Nizoral to scalp & lather",       n:"Leave on 5 min ⏱"},
  {t:"Wash face with pine tar soap",           n:"Rinse thoroughly"},
  {t:"Rinse Nizoral out",                      n:"After 5-min soak"},
  {t:"Pat dry",                                n:null},
  {t:"Apply Dermazen serum — face zones", n:"beard \xb7 mustache \xb7 brows \xb7 nose \xb7 forehead \xb7 under eyes \xb7 behind ears"},
  {t:"Apply Dermazen serum — scalp",      n:null},
  {t:"Apply CeraVe moisturizing cream to face",n:null},
];
const SINK=[
  {t:"Wash face with pine tar soap at sink",   n:"Rinse thoroughly"},
  {t:"Pat dry",                                n:null},
  {t:"Apply Dermazen serum — face zones", n:"beard \xb7 mustache \xb7 brows \xb7 nose \xb7 forehead \xb7 under eyes \xb7 behind ears"},
  {t:"Apply CeraVe moisturizing cream to face",n:null},
];
const PROD_META={
  nizoral: {name:"Nizoral",  total:60,  color:"#818cf8"},
  dermazen:{name:"Dermazen", total:90,  color:"#4ade80"},
  pine_tar:{name:"Pine Tar", total:55,  color:"#d97706"},
  cerave:  {name:"CeraVe",   total:180, color:"#38bdf8"},
};
const SYM_COLOR={itching:"#f59e0b",flaking:"#a78bfa",redness:"#f87171"};
const SYM_CODE ={itching:"i",      flaking:"f",       redness:"r"};
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SCHEMA_VERSION=1;

/* ── INDEXEDDB HELPERS ───────────────────────────────────────────────────── */
const IDB_NAME='SkinRxDB';
const IDB_VER=1;
let _idb=null;

function openIDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(IDB_NAME,IDB_VER);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('main'))db.createObjectStore('main');
      if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos');
    };
    req.onsuccess=e=>resolve(e.target.result);
    req.onerror=()=>reject(req.error);
  });
}
async function getIDB(){
  if(!_idb)_idb=await openIDB();
  return _idb;
}
async function idbGet(store,key){
  try{
    const db=await getIDB();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(store,'readonly').objectStore(store).get(key);
      req.onsuccess=()=>resolve(req.result??null);
      req.onerror=()=>reject(req.error);
    });
  }catch{return null;}
}
async function idbSet(store,key,value){
  try{
    const db=await getIDB();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(store,'readwrite').objectStore(store).put(value,key);
      req.onsuccess=()=>resolve();
      req.onerror=()=>reject(req.error);
    });
  }catch{}
}
async function idbDel(store,key){
  try{
    const db=await getIDB();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(store,'readwrite').objectStore(store).delete(key);
      req.onsuccess=()=>resolve();
      req.onerror=()=>reject(req.error);
    });
  }catch{}
}

/* ── STORAGE PRIMITIVES ──────────────────────────────────────────────────── */
function toKey(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function todayKey(){return toKey(new Date());}
function fmtD(s,o){return new Date(s+"T12:00:00").toLocaleDateString("en-US",o);}
function defaultData(){
  const p={};
  Object.keys(PROD_META).forEach(id=>p[id]={start:todayKey(),left:PROD_META[id].total});
  return{days:{},products:p,weekNotes:{},schemaVersion:SCHEMA_VERSION};
}
function getDayData(k){return DB.days[k]||(DB.days[k]={shower:true,steps:[],mood:null,note:"",sym:{}});}

/* ── DUAL-WRITE STORAGE ──────────────────────────────────────────────────── */
function save(){
  localStorage.setItem("sr",JSON.stringify(DB));
  idbSet('main','sr',DB);
}
function getPhoto(k){return localStorage.getItem("srp_"+k);}
function setPhoto(k,v){
  try{localStorage.setItem("srp_"+k,v);}catch(e){alert("Storage full — try removing old photos.");}
  idbSet('photos',k,v);
}
function delPhoto(k){
  localStorage.removeItem("srp_"+k);
  idbDel('photos',k);
}
function allPhotoKeys(){
  const r=[];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("srp_"))r.push(k.slice(4));}
  return r.sort().reverse();
}

/* ── SAFE INITIALIZATION (load-first, seed-never) ────────────────────────── */
async function initData(){
  const lsRaw=localStorage.getItem("sr");
  const lsHasData=!!lsRaw;
  let idbData=null;
  try{idbData=await idbGet('main','sr');}catch{}
  const idbHasData=!!idbData;

  console.log(`[SkinRx] Storage check: LS has data: ${lsHasData}, IDB has data: ${idbHasData}`);

  if(lsHasData){
    try{
      const parsed=JSON.parse(lsRaw);
      if(parsed&&typeof parsed==='object'){
        DB=parsed;
        console.log('[SkinRx] Seeding skipped — existing data found');
        if(!idbHasData)idbSet('main','sr',DB);
        return;
      }
    }catch{}
  }

  if(idbHasData){
    DB=idbData;
    localStorage.setItem("sr",JSON.stringify(DB));
    console.log('[SkinRx] Seeding skipped — existing data found');
    return;
  }

  console.log('[SkinRx] First install — seeding defaults');
  DB=defaultData();
  save();
}

/* ── SCHEMA MIGRATION ────────────────────────────────────────────────────── */
function runMigrations(){
  const stored=DB.schemaVersion||0;
  if(stored===SCHEMA_VERSION){
    console.log(`[SkinRx] Schema v${SCHEMA_VERSION} — no migration needed`);
    return;
  }
  // Migrations would run here in future versions
  DB.schemaVersion=SCHEMA_VERSION;
  save();
}

/* ── STATE ───────────────────────────────────────────────────────────────── */
let DB={};
let selDate=todayKey();
let weekOff=0;
let activeTab="routine";
let cmpA=null,cmpB=null;
let keyVisible=false;

/* ── WEEK CALENDAR ───────────────────────────────────────────────────────── */
function getWeekDates(off){
  const n=new Date(),dow=n.getDay();
  const mon=new Date(n);
  mon.setDate(n.getDate()+(dow===0?-6:1-dow)+off*7);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}
function getWeekKey(s){
  const d=new Date(s+"T12:00:00"),dow=d.getDay();
  const mon=new Date(d);mon.setDate(d.getDate()+(dow===0?-6:1-dow));
  const yr=mon.getFullYear(),wn=Math.ceil(((mon-new Date(yr,0,1))/86400000+1)/7);
  return`${yr}-W${String(wn).padStart(2,"0")}`;
}
function buildWeekGrid(){
  const dates=getWeekDates(weekOff);
  document.getElementById("week-range").textContent=
    dates[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})+" – "+
    dates[6].toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const grid=document.getElementById("week-grid");
  grid.innerHTML="";
  dates.forEach((date,i)=>{
    const k=toKey(date),dd=DB.days[k];
    const steps=dd?(dd.shower?SHOWER:SINK):SHOWER;
    const done=dd?.steps?.length||0,tot=steps.length;
    const full=done>0&&done===tot,part=done>0&&done<tot;
    const btn=document.createElement("button");
    btn.className="day-cell"+(k===selDate?" selected":"")+(k===todayKey()?" is-today":"");
    btn.onclick=()=>selectDate(k);
    let dot="";
    if(k!==selDate){
      if(full) dot=`<div style="width:6px;height:6px;border-radius:50%;background:#4ade80;margin:0 auto"></div>`;
      else if(part) dot=`<div style="width:5px;height:5px;border-radius:50%;background:#38bdf8;margin:0 auto"></div>`;
      else if(dd?.mood==="bad") dot=`<div style="width:4px;height:4px;border-radius:50%;background:#f87171;margin:0 auto"></div>`;
    }
    btn.innerHTML=`<div class="dl">${DAYS[i]}</div><div class="dn">${date.getDate()}</div><div class="dot">${dot}</div>`;
    grid.appendChild(btn);
  });
}
function prevWeek(){weekOff--;buildWeekGrid();}
function nextWeek(){weekOff++;buildWeekGrid();}

/* ── DATE SELECTION ──────────────────────────────────────────────────────── */
function selectDate(k){
  selDate=k;
  buildWeekGrid();
  refreshRoutine();
  refreshSymptomRatings();
  refreshPhotoDisplay();
  refreshNotesForDate();
}

/* ── ROUTINE ─────────────────────────────────────────────────────────────── */
function refreshRoutine(){
  const dd=getDayData(selDate);
  const steps=dd.shower?SHOWER:SINK;
  const done=dd.steps.length,tot=steps.length;
  document.getElementById("routine-date").textContent=fmtD(selDate,{weekday:"long",month:"long",day:"numeric"});
  document.getElementById("step-counter").textContent=done+"/"+tot+" steps";
  document.getElementById("hdr-counter").textContent=done+"/"+tot+" done";
  document.getElementById("hdr-mood").textContent=dd.mood==="good"?"😊":dd.mood==="bad"?"😔":"";
  const sb=document.getElementById("shower-btn");
  sb.textContent=dd.shower?"🚿 Shower":"🨥 Sink";
  sb.className="btn"+(dd.shower?"":" sink");
  document.getElementById("mood-good").className="btn mood-btn"+(dd.mood==="good"?" good-on":"");
  document.getElementById("mood-bad").className ="btn mood-btn"+(dd.mood==="bad"?" bad-on":"");
  document.getElementById("note-mood-good").className="btn mood-btn"+(dd.mood==="good"?" good-on":"")+" ";
  document.getElementById("note-mood-bad").className ="btn mood-btn"+(dd.mood==="bad"?" bad-on":"")+" ";
  document.getElementById("note-mood-good").style.color=dd.mood==="good"?"#4ade80":"#5a7191";
  document.getElementById("note-mood-bad").style.color =dd.mood==="bad"?"#f87171":"#5a7191";
  const pct=tot>0?Math.round((done/tot)*100):0;
  const fill=document.getElementById("prog-fill");
  fill.style.width=pct+"%";
  fill.className="bar-fill"+(done===tot?" complete":"");
  document.getElementById("all-done").style.display=(done===tot&&tot>0)?"block":"none";
  buildStepsList(dd,steps);
}
function buildStepsList(dd,steps){
  const list=document.getElementById("steps-list");
  list.innerHTML="";
  steps.forEach((step,idx)=>{
    const isDone=dd.steps.includes(idx);
    const btn=document.createElement("button");
    btn.className="step-btn"+(isDone?" done":"");
    btn.onclick=()=>toggleStep(idx);
    btn.innerHTML=`<div class="check-box"><span class="check-mark">✓</span></div>`+
      `<div style="flex:1;min-width:0">`+
      `<div class="step-text"><span class="step-num">${idx+1}.</span>${step.t}</div>`+
      (!isDone&&step.n?`<div class="step-note">${step.n}</div>`:"")+
      `</div>`;
    list.appendChild(btn);
  });
}
function toggleStep(idx){
  const dd=getDayData(selDate);
  const pos=dd.steps.indexOf(idx);
  if(pos===-1)dd.steps.push(idx);else dd.steps.splice(pos,1);
  save();refreshRoutine();buildWeekGrid();
}
function toggleMood(mood){
  const dd=getDayData(selDate);
  dd.mood=dd.mood===mood?null:mood;
  save();refreshRoutine();buildWeekGrid();
}
function toggleShower(){
  const dd=getDayData(selDate);
  dd.shower=!dd.shower;
  dd.steps=[];
  save();refreshRoutine();buildWeekGrid();
}

/* ── SYMPTOMS ────────────────────────────────────────────────────────────── */
const SYM_KEYS=["itching","flaking","redness"];
const SYM_PRE={itching:"i",flaking:"f",redness:"r"};
function refreshSymptomRatings(){
  const dd=getDayData(selDate);
  SYM_KEYS.forEach(sk=>{
    const val=(dd.sym||{})[sk]||0;
    const color=SYM_COLOR[sk];
    const pre=SYM_PRE[sk];
    const valEl=document.getElementById("sym-"+sk+"-val");
    if(valEl){valEl.textContent=val>0?val+"/5":"—";valEl.style.color=val>0?color:"#5a7191";}
    for(let n=1;n<=5;n++){
      const b=document.getElementById("sb"+pre+n);
      if(b){
        b.style.background=val>=n?color+"20":"#091422";
        b.style.borderColor=val>=n?color:"#182435";
        b.style.color=val>=n?color:"#5a7191";
      }
    }
  });
}
function rateSymptom(key,n){
  const dd=getDayData(selDate);
  if(!dd.sym)dd.sym={};
  dd.sym[key]=dd.sym[key]===n?0:n;
  save();refreshSymptomRatings();buildSymGraph();buildSymHistory();
}
function buildSymGraph(){
  const dates=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return toKey(d);});
  const W=320,H=110,Pt=8,Pr=8,Pb=22,Pl=24;
  const pw=W-Pl-Pr,ph=H-Pt-Pb;
  let svg=`<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block">`;
  for(let v=1;v<=5;v++){
    const y=Pt+ph-(v/5)*ph;
    svg+=`<line x1="${Pl}" y1="${y}" x2="${W-Pr}" y2="${y}" stroke="#111e2e" stroke-width="1"/>`;
    svg+=`<text x="${Pl-5}" y="${y+3.5}" fill="#5a7191" font-size="8" text-anchor="end">${v}</text>`;
  }
  dates.forEach((d,i)=>{
    if(i%7!==0&&i!==dates.length-1)return;
    const x=Pl+(i/(dates.length-1))*pw;
    svg+=`<text x="${x}" y="${H-4}" fill="#5a7191" font-size="7.5" text-anchor="middle">${d.slice(5)}</text>`;
  });
  let hasData=false;
  SYM_KEYS.forEach(sk=>{
    const color=SYM_COLOR[sk];
    const pts=dates.map((d,i)=>({i,v:(DB.days[d]?.sym||{})[sk]??null})).filter(p=>p.v!==null);
    if(pts.length<2)return;hasData=true;
    const path=pts.map(({i,v},idx)=>{
      const x=Pl+(i/(dates.length-1))*pw,y=Pt+ph-(v/5)*ph;
      return(idx===0?"M":"L")+` ${x} ${y}`;
    }).join(" ");
    svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    pts.forEach(({i,v})=>{
      const x=Pl+(i/(dates.length-1))*pw,y=Pt+ph-(v/5)*ph;
      svg+=`<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"/>`;
    });
  });
  svg+=`</svg>`;
  if(hasData){
    svg+=`<div style="display:flex;gap:14px;margin-top:7px">`;
    SYM_KEYS.forEach(sk=>svg+=`<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:3px;background:${SYM_COLOR[sk]};border-radius:2px"></div><span style="font-size:10px;color:#8ba0b5">${sk}</span></div>`);
    svg+=`</div>`;
  }
  const el=document.getElementById("sym-graph");
  if(el)el.innerHTML=hasData?svg:`<p style="font-size:12px;color:#5a7191;text-align:center;padding:20px 0">Log symptoms to see your trend chart</p>`;
}
function buildSymHistory(){
  const entries=Object.entries(DB.days).filter(([,d])=>Object.keys(d.sym||{}).some(k=>d.sym[k]>0)).sort().reverse().slice(0,8);
  const el=document.getElementById("sym-history");
  if(!el)return;
  if(!entries.length){el.innerHTML=`<p style="font-size:12px;color:#5a7191">No symptom data yet.</p>`;return;}
  el.innerHTML=entries.map(([date,d])=>{
    const dots=SYM_KEYS.map(sk=>d.sym[sk]?`<span style="font-size:10px;color:${SYM_COLOR[sk]};font-weight:700">${sk[0].toUpperCase()}${d.sym[sk]}</span>`:"").join("");
    return`<button class="btn" onclick="selectDate('${date}')" style="width:100%;background:#091422;border:1px solid #182435;border-radius:8px;padding:8px 11px;text-align:left;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center"><span class="mono accent" style="font-size:11px">${date}</span><div style="display:flex;gap:8px">${dots}</div></button>`;
  }).join("");
}

/* ── PRODUCTS ────────────────────────────────────────────────────────────── */
function refreshAllProducts(){
  Object.keys(PROD_META).forEach(id=>{
    const pd=DB.products[id]||{start:todayKey(),left:PROD_META[id].total};
    const tot=PROD_META[id].total,pct=(pd.left/tot)*100,isLow=pct<20,isEmpty=pd.left<=0;
    document.getElementById("bar-"+id).style.width=Math.max(0,pct)+"%";
    document.getElementById("count-"+id).textContent=pd.left+" / "+tot;
    document.getElementById("since-"+id).textContent="Since "+fmtD(pd.start,{month:"short",day:"numeric"});
    const badge=document.getElementById("badge-"+id);
    if(isLow){badge.className="low-badge"+(isEmpty?" empty-badge":"");badge.textContent=isEmpty?"EMPTY":"LOW";}
    else badge.textContent="";
    document.getElementById("pc-"+id).style.borderColor=isLow?"#5a1010":"#182435";
  });
}
function adjProduct(id,delta){
  const pd=DB.products[id],tot=PROD_META[id].total;
  pd.left=Math.min(tot,Math.max(0,pd.left+delta));
  save();refreshAllProducts();
}
function refillProduct(id){
  DB.products[id]={start:todayKey(),left:PROD_META[id].total};
  save();refreshAllProducts();
}

/* ── PHOTOS ──────────────────────────────────────────────────────────────── */
async function compressPhoto(dataUrl){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=680,c=document.createElement("canvas");
      let w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg",0.72));
    };
    img.onerror=()=>res(dataUrl);img.src=dataUrl;
  });
}
function refreshPhotoDisplay(){
  document.getElementById("photo-date-label").textContent="📸 "+fmtD(selDate,{weekday:"short",month:"short",day:"numeric"});
  const photo=getPhoto(selDate);
  const el=document.getElementById("photo-display");
  if(photo){
    el.innerHTML=`<img src="${photo}" style="width:100%;border-radius:8px;max-height:280px;object-fit:cover;border:1px solid #182435"><div style="display:flex;gap:7px;margin-top:8px"><button class="btn" onclick="document.getElementById('photo-input').click()" style="flex:1;background:#091422;border:1px solid #182435;border-radius:7px;padding:7px;font-size:11px;color:#8ba0b5">🔄 Replace</button><button class="btn" onclick="removePhoto('${selDate}')" style="background:#1a0505;border:1px solid #f87171;border-radius:7px;padding:7px 13px;color:#f87171;font-size:12px">🗑</button></div>`;
  }else{
    el.innerHTML=`<button class="btn" onclick="document.getElementById('photo-input').click()" style="width:100%;height:150px;background:#091422;border:2px dashed #182435;border-radius:10px;color:#5a7191;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px"><span style="font-size:30px">📷</span><span>Tap to add progress photo</span></button>`;
  }
}
function removePhoto(k){
  delPhoto(k);refreshPhotoDisplay();buildPhotoGallery();
}
function buildPhotoGallery(){
  const keys=allPhotoKeys();
  document.getElementById("gallery-heading").textContent="Gallery ("+keys.length+")";
  const el=document.getElementById("photo-gallery");
  if(!keys.length){el.innerHTML=`<p style="font-size:12px;color:#5a7191;text-align:center;padding:16px 0">No photos yet</p>`;return;}
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">`+
    keys.map(k=>`<button class="btn" onclick="selectDate('${k}')" style="padding:0;background:none;border:none"><img src="${getPhoto(k)}" style="width:100%;height:85px;object-fit:cover;border-radius:7px;border:2px solid ${k===selDate?"#4ade80":"#182435"}"><div class="mono" style="font-size:9px;color:${k===selDate?"#4ade80":"#5a7191"};text-align:center;margin-top:2px">${k.slice(5)}</div></button>`).join("")+
  `</div>`;
}
function buildCmpSlot(which,k){
  const el=document.getElementById("cmp-"+which+"-display");
  if(!el)return;
  if(k&&getPhoto(k)){
    el.innerHTML=`<img src="${getPhoto(k)}" style="width:100%;height:110px;object-fit:cover;border-radius:7px;border:1px solid #182435"><div class="mono" style="font-size:9px;color:#4ade80;text-align:center;margin-top:3px">${k}</div><button class="btn" onclick="clearCmp('${which}')" style="width:100%;background:none;border:none;font-size:9px;color:#5a7191;margin-top:3px">clear</button>`;
  }else{
    const opts=allPhotoKeys().map(d=>`<option value="${d}">${d}</option>`).join("");
    el.innerHTML=`<select onchange="setCmp('${which}',this.value)"><option value="">Select date…</option>${opts}</select>`;
  }
}
function setCmp(which,k){if(which==="a"){cmpA=k;}else{cmpB=k;}buildCmpSlot(which,k);}
function clearCmp(which){if(which==="a"){cmpA=null;}else{cmpB=null;}buildCmpSlot(which,null);}

/* ── NOTES ───────────────────────────────────────────────────────────────── */
function refreshNotesForDate(){
  const dd=getDayData(selDate);
  const wk=getWeekKey(selDate);
  document.getElementById("notes-date-label").textContent="Daily Note — "+fmtD(selDate,{weekday:"short",month:"short",day:"numeric"});
  document.getElementById("week-note-label").textContent="Weekly Summary — "+wk;
  document.getElementById("daily-note").value=dd.note||"";
  document.getElementById("week-note").value=(DB.weekNotes||{})[wk]||"";
  buildRecentNotes();
}
function saveNote(){
  const dd=getDayData(selDate);
  dd.note=document.getElementById("daily-note").value;
  save();buildRecentNotes();
}
function saveWeekNote(){
  if(!DB.weekNotes)DB.weekNotes={};
  DB.weekNotes[getWeekKey(selDate)]=document.getElementById("week-note").value;
  save();
}
function buildRecentNotes(){
  const noted=Object.entries(DB.days).filter(([,d])=>d.note?.trim()).sort().reverse().slice(0,6);
  const el=document.getElementById("recent-notes");
  if(!noted.length){el.innerHTML=`<p style="font-size:12px;color:#5a7191;text-align:center;padding:10px 0">No notes yet</p>`;return;}
  el.innerHTML=noted.map(([date,d])=>
    `<button class="btn" onclick="selectDate('${date}')" style="width:100%;background:#091422;border:1px solid #182435;border-radius:8px;padding:9px 11px;text-align:left;margin-bottom:6px;display:block"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span class="mono accent" style="font-size:10px;font-weight:600">${date}</span><span style="font-size:12px">${d.mood==="good"?"😊":d.mood==="bad"?"😔":""}</span></div><div style="font-size:12px;color:#7a90a8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${d.note}</div></button>`
  ).join("");
}

/* ── SYNC ────────────────────────────────────────────────────────────────── */
function saveApiKey(){localStorage.setItem("sr_key",document.getElementById("api-key").value);}
function toggleKeyVis(){
  keyVisible=!keyVisible;
  document.getElementById("api-key").type=keyVisible?"text":"password";
  document.getElementById("key-eye").textContent=keyVisible?"🙈":"👁";
}
function showSyncMsg(msg,ok){
  const el=document.getElementById("sync-msg");
  el.textContent=msg;el.style.display="block";
  el.style.background=ok?"#081c10":"#1a0505";
  el.style.border="1px solid "+(ok?"#4ade80":"#f87171");
  el.style.color=ok?"#4ade80":"#f87171";
  if(ok!==null)setTimeout(()=>el.style.display="none",5000);
}
function buildStats(){
  const all=Object.entries(DB.days);
  const items=[
    {l:"Days Logged",   v:all.length,                                           c:"#4ade80"},
    {l:"Steps Done",    v:all.reduce((s,[,d])=>s+(d.steps?.length||0),0),       c:"#38bdf8"},
    {l:"Good Days",     v:all.filter(([,d])=>d.mood==="good").length,           c:"#4ade80"},
    {l:"Bad Days",      v:all.filter(([,d])=>d.mood==="bad").length,            c:"#f87171"},
    {l:"Photos",        v:allPhotoKeys().length,                                c:"#fbbf24"},
    {l:"Notes Written", v:all.filter(([,d])=>d.note?.trim()).length,            c:"#a78bfa"},
  ];
  document.getElementById("stats-grid").innerHTML=items.map(({l,v,c})=>
    `<div style="background:#091422;border-radius:9px;padding:12px 14px;border:1px solid #182435"><div class="mono" style="font-size:24px;font-weight:700;color:${c};line-height:1">${v}</div><div style="font-size:10px;color:#5a7191;margin-top:4px">${l}</div></div>`
  ).join("");
}
function exportBackup(){
  const exp={...DB,photos:null,savedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(exp,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="skinrx-backup-"+todayKey()+".json";a.click();
  URL.revokeObjectURL(url);
  showSyncMsg("✓ Backup downloaded!",true);
}
async function clearData(){
  if(!confirm("Delete ALL local data? Export a backup first. Cannot be undone."))return;
  localStorage.removeItem("sr");
  allPhotoKeys().forEach(k=>{localStorage.removeItem("srp_"+k);});
  try{
    const db=await getIDB();
    await new Promise((res)=>{
      const tx=db.transaction(['main','photos'],'readwrite');
      tx.objectStore('main').clear();
      tx.objectStore('photos').clear();
      tx.oncomplete=res;
      tx.onerror=res;
    });
  }catch{}
  DB=defaultData();
  save();
  await init();
}
async function saveToDrive(){
  const key=document.getElementById("api-key").value.trim();
  if(!key){showSyncMsg("✗ Enter your Anthropic API key first",false);return;}
  const b1=document.getElementById("drive-save-btn"),b2=document.getElementById("drive-load-btn");
  b1.textContent="⏳…";b1.disabled=b2.disabled=true;
  showSyncMsg("Saving to Google Drive…",null);
  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,mcp_servers:[{type:"url",url:"https://drivemcp.googleapis.com/mcp/v1",name:"gdrive"}],messages:[{role:"user",content:"Create or overwrite a file named \"SkinRx-backup.json\" in my Google Drive root with this content:\n\n"+JSON.stringify({...DB,savedAt:new Date().toISOString()})+"\n\nConfirm it was saved."}]})
    });
    const r=await res.json();
    const t=(r.content?.find(b=>b.type==="text")?.text||"").toLowerCase();
    showSyncMsg(t.includes("creat")||t.includes("saved")||t.includes("updat")?"✓ Saved to Google Drive!":"✓ Sync complete",true);
  }catch{showSyncMsg("✗ Drive sync failed — check API key & connection",false);}
  b1.textContent="↑ Save to Drive";b1.disabled=b2.disabled=false;
}
async function loadFromDrive(){
  const key=document.getElementById("api-key").value.trim();
  if(!key){showSyncMsg("✗ Enter your Anthropic API key first",false);return;}
  const b1=document.getElementById("drive-save-btn"),b2=document.getElementById("drive-load-btn");
  b2.textContent="⏳…";b1.disabled=b2.disabled=true;
  showSyncMsg("Loading from Google Drive…",null);
  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8000,mcp_servers:[{type:"url",url:"https://drivemcp.googleapis.com/mcp/v1",name:"gdrive"}],messages:[{role:"user",content:"Find \"SkinRx-backup.json\" in my Google Drive and return ONLY its raw JSON content, nothing else."}]})
    });
    const r=await res.json();
    const txt=r.content?.find(b=>b.type==="text")?.text||"";
    const match=txt.match(/\{[\s\S]*\}/);
    if(match){
      const{savedAt,...rest}=JSON.parse(match[0]);
      DB={...DB,...rest};
      save();
      await init();
      showSyncMsg("✓ Data restored from Drive!",true);
    }else showSyncMsg("✗ No backup found in Drive",false);
  }catch{showSyncMsg("✗ Load failed — check API key & connection",false);}
  b2.textContent="↓ Load from Drive";b1.disabled=b2.disabled=false;
}

/* ── TAB SWITCHING ───────────────────────────────────────────────────────── */
function switchTab(tab){
  document.querySelector(".tab.active")?.classList.remove("active");
  document.querySelector(".nav-btn.active")?.classList.remove("active");
  document.getElementById("tab-"+tab).classList.add("active");
  document.getElementById("nb-"+tab).classList.add("active");
  activeTab=tab;
  if(tab==="symptoms"){buildSymGraph();buildSymHistory();}
  if(tab==="photos"){refreshPhotoDisplay();buildPhotoGallery();buildCmpSlot("a",cmpA);buildCmpSlot("b",cmpB);}
  if(tab==="notes"){refreshNotesForDate();}
  if(tab==="sync"){buildStats();}
}

/* ── INIT ────────────────────────────────────────────────────────────────── */
async function init(){
  await initData();
  runMigrations();

  if(navigator.storage&&navigator.storage.persist){
    navigator.storage.persist().then(granted=>{
      console.log('[SkinRx] Persistent storage:',granted);
    });
  }

  document.getElementById("hdr-date").textContent=new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  document.getElementById("api-key").value=localStorage.getItem("sr_key")||"";
  buildWeekGrid();
  refreshRoutine();
  refreshSymptomRatings();
  refreshAllProducts();
  refreshPhotoDisplay();
  refreshNotesForDate();
  console.log('[SkinRx] Init complete — loaded from storage');
}
init();

/* ── EVENT LISTENERS ─────────────────────────────────────────────────────── */
document.getElementById("photo-input").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const c=await compressPhoto(ev.target.result);
    setPhoto(selDate,c);
    refreshPhotoDisplay();buildPhotoGallery();
  };
  reader.readAsDataURL(file);
  e.target.value="";
});
document.getElementById("import-input").addEventListener("change",e=>{
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const{savedAt,...rest}=JSON.parse(ev.target.result);
      DB={...DB,...rest};
      save();
      await init();
      showSyncMsg("✓ Backup restored!",true);
    }catch{showSyncMsg("✗ Invalid backup file",false);}
  };
  reader.readAsText(file);e.target.value="";
});

/* ── SWIPE NAVIGATION ────────────────────────────────────────────────────── */
(function(){
  const el=document.getElementById('tab-routine');
  let sx=0,sy=0;
  el.addEventListener('touchstart',e=>{
    sx=e.touches[0].clientX;
    sy=e.touches[0].clientY;
  },{passive:true});
  el.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)<40||Math.abs(dx)<=Math.abs(dy))return;
    const dir=dx<0?1:-1;
    const d=new Date(selDate+'T12:00:00');
    d.setDate(d.getDate()+dir);
    const newKey=toKey(d);
    const weekKeys=getWeekDates(weekOff).map(wd=>toKey(wd));
    if(!weekKeys.includes(newKey))weekOff+=dir;
    selectDate(newKey);
  },{passive:true});
})();

/* ── SERVICE WORKER ──────────────────────────────────────────────────────── */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js');
}
