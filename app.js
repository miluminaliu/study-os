(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORE='pagePace.v7.';
const SUBJECTS=['物理','生化','生物','化學','英文'];
const SKILLS=['Vocabulary','Detail','Paraphrase','Mechanism','Method','Inference','Purpose','Organization','Evidence boundary','Main idea'];
const TIMER_MODES={focus:{label:'FOCUS',work:50,break:10},quick:{label:'QUICK',work:25,break:5},deep:{label:'DEEP',work:75,break:15},lecture:{label:'LECTURE',work:null,break:null}};
const readJSON=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}};
const saveJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const legacySettings=readJSON('studySettings',{});
const settings={
  webAppUrl:readJSON(STORE+'settings',{}).webAppUrl||legacySettings.webAppUrl||legacySettings.webAppURL||localStorage.getItem('studyWebAppUrl')||'',
  token:readJSON(STORE+'settings',{}).token||legacySettings.token||localStorage.getItem('studySyncToken')||'',
  newWordCount:+(readJSON(STORE+'settings',{}).newWordCount??15),
  weekStart:+(readJSON(STORE+'settings',{}).weekStart??1)
};
let state={
  activities:readJSON(STORE+'activities',readJSON('studyActivities',[])),
  quickLog:readJSON(STORE+'quickLog',[]),
  manualProgress:readJSON(STORE+'manualProgress',[]),
  questionLog:readJSON(STORE+'questionLog',[]),
  readingProgress:readJSON(STORE+'readingProgress',{}),
  vocabProgress:readJSON(STORE+'vocabProgress',{}),
  skippedPlans:readJSON(STORE+'skippedPlans',{}),
  readingLibrary:[],vocab:[],readingVocab:[],activeSubject:'物理',englishPanel:'reading'
};
let timerState=readJSON(STORE+'timer',null),tickHandle=null,vocabSession=null;
const pad=n=>String(n).padStart(2,'0');
const localISO=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseLocal=v=>{if(!v)return null;if(v instanceof Date)return v;const s=String(v).trim();const m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);if(m)return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));const d=new Date(s);return isNaN(d)?null:d};
const fmtMin=n=>{n=Math.round(+n||0);if(n<60)return `${n}m`;const h=Math.floor(n/60),m=n%60;return m?`${h}h ${m}m`:`${h}h`};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s??'').toLowerCase().replace(/[\s_｜|：:【】\-–—]+/g,'');
const uniqBy=(arr,key)=>{const m=new Map;arr.forEach(x=>m.set(key(x),x));return [...m.values()]};
const toast=(msg)=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2600)};
const uid=(p='pp')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
function persist(){saveJSON(STORE+'activities',state.activities);saveJSON(STORE+'quickLog',state.quickLog);saveJSON(STORE+'manualProgress',state.manualProgress);saveJSON(STORE+'questionLog',state.questionLog);saveJSON(STORE+'readingProgress',state.readingProgress);saveJSON(STORE+'vocabProgress',state.vocabProgress);saveJSON(STORE+'skippedPlans',state.skippedPlans)}
function saveSettingsLocal(){saveJSON(STORE+'settings',settings)}

async function loadStatic(){
  const [r,v]=await Promise.all([fetch('./data/reading-library.json').then(x=>x.json()),fetch('./data/vocab-core.json').then(x=>x.json())]);
  state.readingLibrary=r;state.vocab=v;buildReadingVocabPool();renderAll();
}


function buildReadingVocabPool(){
  const m=new Map();
  state.readingLibrary.forEach(r=>(r.highYieldVocab||[]).forEach(x=>{
    const k=norm(x.word);if(!k)return;
    const id='read:'+k,src=`Vol.${pad(r.volume)} Day ${pad(r.day)}`;
    if(!m.has(k))m.set(k,{id,word:x.word,ipa:'',definition:x.gloss||'',source:src,readingSources:[src]});
    else {const q=m.get(k);if(!q.readingSources.includes(src))q.readingSources.push(src);q.source=q.readingSources.join(' · ')}
  }));
  state.readingVocab=[...m.values()];
}
function vocabPool(){return [...state.vocab,...state.readingVocab]}
function addReadingWords(id){
  const r=state.readingLibrary.find(x=>x.id===id);if(!r)return;
  let added=0;
  (r.highYieldVocab||[]).forEach(x=>{
    const core=state.vocab.find(v=>norm(v.word)===norm(x.word));
    const v=core||state.readingVocab.find(v=>norm(v.word)===norm(x.word));if(!v)return;
    const old=state.vocabProgress[v.id];
    if(!old){state.vocabProgress[v.id]={word_id:String(v.id),word:v.word,state:'new',stage:0,due:localISO(),last_reviewed:'',correct:0,reviews:0,source:`Vol.${pad(r.volume)} Day ${pad(r.day)}`,mastered:false,updated_at:new Date().toISOString()};added++}
  });
  persist();renderAll();toast(`${added||0} 個新字已加入 Today’s Words`);
  const items=(r.highYieldVocab||[]).map(x=>{const core=state.vocab.find(v=>norm(v.word)===norm(x.word)),v=core||state.readingVocab.find(v=>norm(v.word)===norm(x.word));return v&&state.vocabProgress[v.id]}).filter(Boolean);
  if(items.length)postCloud('vocab_upsert',items);
}

function allLogs(){
  const activityDone=(state.activities||[]).filter(a=>String(a.type).toUpperCase()==='DONE');
  const mirrored=new Set(activityDone.map(a=>String(a.notes||'').match(/web_event_id=([^\n]+)/)?.[1]).filter(Boolean));
  const quick=(state.quickLog||[]).filter(q=>!mirrored.has(String(q.event_id||''))).map(q=>({...q,type:'DONE'}));
  return uniqBy([...activityDone,...quick],x=>String(x.event_id||x.id||[x.date,x.subject,x.activity,x.topic,x.minutes,x.start_time].join('|')));
}
function plans(){return (state.activities||[]).filter(a=>String(a.type).toUpperCase()==='PLAN')}
function logMinutes(x){return +x.minutes||+x.actual_minutes||0}
function isPlanDone(p){
  const ds=allLogs().filter(d=>d.date===p.date);
  const planTitle=String(p.plan_title||'');
  return ds.some(d=>{
    if(planTitle&&String(d.plan_title||'')===planTitle)return true;
    if(String(d.notes||'').includes(`plan_event_id=${p.event_id}`))return true;
    return norm(d.subject)===norm(p.subject)&&norm(d.activity)===norm(p.activity)&&norm(d.topic)===norm(p.topic);
  });
}
function planIsPast(p){const end=parseLocal(p.end_time)||parseLocal(`${p.date} 23:59`);return end&&end<new Date()}
function unloggedPlans(days=7){
  const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-days+1);
  return plans().filter(p=>{const d=parseLocal(p.date);return d&&d>=cutoff&&planIsPast(p)&&!isPlanDone(p)&&!state.skippedPlans[p.event_id]});
}
function todaysPlans(){return plans().filter(a=>a.date===localISO())}
function todaysLogs(){return allLogs().filter(a=>a.date===localISO())}
function weekAnchor(d=new Date()){
  const x=new Date(d);x.setHours(0,0,0,0);const wd=x.getDay(),delta=settings.weekStart===1?((wd+6)%7):wd;x.setDate(x.getDate()-delta);return x;
}
function dateAdd(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function inRange(date,start,end){const d=parseLocal(date);return d&&d>=start&&d<end}

function setNav(v){
  $$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));$$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));
  $('#pageTitle').textContent=v;location.hash=v==='today'?'':v;window.scrollTo({top:0,behavior:'smooth'});
  if(v==='week')renderWeek(); if(v==='study')renderStudy(); if(v==='review')renderReview(); if(v==='archive')renderArchive();
}

function renderAll(){renderDate();renderToday();renderWeek();renderStudy();renderReview();renderArchive();renderTimer();}
function renderDate(){
  const d=new Date();$('#todayDate').textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})+' · '+d.toLocaleDateString('zh-TW',{year:'numeric'});
}
function renderToday(){
  const ps=todaysPlans(),ds=todaysLogs(),doneP=ps.filter(isPlanDone),pending=ps.filter(p=>!isPlanDone(p));
  const next=pending.filter(p=>!state.skippedPlans[p.event_id]).sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||'')))[0];
  const nextBox=$('#nextAction');
  if(next){nextBox.innerHTML=`<h2>${esc(next.topic||next.activity||'下一項')}</h2><div class="next-meta"><span>${esc(next.subject||'')}</span><span>· ${esc(next.activity||'')}</span><span>· ${fmtMin(next.minutes)}</span>${next.start_time?`<span>· ${esc(timeOnly(next.start_time))}</span>`:''}</div><div class="next-actions"><button class="ink-button" data-start-plan="${esc(next.event_id)}">start focus</button><button class="line-button" data-skip-plan="${esc(next.event_id)}">not today</button></div>`}
  else nextBox.innerHTML=`<h2>${ds.length?'今日主要紀錄完成':'今天還沒有安排'}</h2><div class="next-meta"><span>${ds.length?'nice pace — keep it light.':'可以從一個 25 分鐘 quick focus 開始。'}</span></div><div class="next-actions"><button class="ink-button" data-free-focus>start quick focus</button></div>`;
  const tline=$('#todayTimeline');
  if(!ps.length&&!ds.length)tline.innerHTML='<div class="empty-note">blank page — 今天的第一筆紀錄會出現在這裡。</div>';
  else {
    const rows=[...ps.map(x=>({...x,_kind:'plan'})),...ds.filter(d=>!ps.some(p=>isPlanDone(p)&&norm(p.topic)===norm(d.topic))).map(x=>({...x,_kind:'done'}))].sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||'')));
    tline.innerHTML=rows.map(x=>{const done=x._kind==='done'||isPlanDone(x);return `<div class="timeline-item ${done?'done':''}"><div class="timeline-time">${esc(timeOnly(x.start_time)||'—')}</div><i class="timeline-dot"></i><div class="timeline-main"><strong>${esc(x.topic||x.activity||'study')}</strong><small>${esc(x.subject||'')} · ${esc(x.activity||'')} · ${fmtMin(x.minutes)}</small></div>${x._kind==='plan'&&!done?`<button class="tiny-action" data-start-plan="${esc(x.event_id)}">focus</button>`:''}</div>`}).join('');
  }
  const pmin=ps.reduce((s,x)=>s+logMinutes(x),0),dmin=ds.reduce((s,x)=>s+logMinutes(x),0),focus=ds.filter(x=>String(x.source||'').includes('Page & Pace')).reduce((s,x)=>s+logMinutes(x),0);
  $('#todayPlanMin').textContent=fmtMin(pmin);$('#todayDoneMin').textContent=fmtMin(dmin);$('#todayFocusMin').textContent=fmtMin(focus);$('#todayLogCount').textContent=ds.length;
  $('#planSummary').innerHTML=`PLAN ${fmtMin(pmin)}<br>DONE ${fmtMin(dmin)} · ${doneP.length}/${ps.length||0}`;
  renderTodayWords();renderUnlogged();
  $$('[data-start-plan]').forEach(b=>b.onclick=()=>startPlanFocus(b.dataset.startPlan));$$('[data-skip-plan]').forEach(b=>b.onclick=()=>skipPlan(b.dataset.skipPlan));
  $$('[data-free-focus]').forEach(b=>b.onclick=()=>openFocus('quick'));
}
function timeOnly(v){const d=parseLocal(v);return d?`${pad(d.getHours())}:${pad(d.getMinutes())}`:''}

function renderTodayWords(){
  const due=getDueVocab(), unseen=getUnseenVocab(settings.newWordCount), box=$('#todayWords');
  const peek=(due[0]||unseen[0]);
  box.innerHTML=`<div class="words-overview"><div><small>new</small><strong>${unseen.length}</strong></div><div><small>review</small><strong>${due.length}</strong></div></div>${peek?`<div class="word-peek">${esc(peek.word)}<span>${esc(shortDef(peek.definition))}</span></div>`:''}<button class="ink-button" id="startVocabToday">start ${due.length+unseen.length?Math.min(due.length+unseen.length,99):0} cards</button>`;
  $('#startVocabToday').onclick=()=>startVocabSession();
}
function renderUnlogged(){
  const list=unloggedPlans(1),box=$('#unloggedList');
  if(!list.length){box.innerHTML='<div class="empty-note">今天沒有待確認的漏記。</div>';return}
  box.innerHTML=list.map(p=>`<div class="unlogged-row"><div><strong>${esc(p.topic||p.activity)}</strong><small>${esc(p.subject)} · ${fmtMin(p.minutes)} · ${esc(timeOnly(p.start_time))}</small></div><div class="unlogged-actions"><button data-log-plan="${esc(p.event_id)}">有讀 → 補登</button><button data-skip-plan="${esc(p.event_id)}">沒讀</button></div></div>`).join('');
  $$('[data-log-plan]').forEach(b=>b.onclick=()=>quickLogFromPlan(b.dataset.logPlan));$$('[data-skip-plan]').forEach(b=>b.onclick=()=>skipPlan(b.dataset.skipPlan));
}
function skipPlan(id){state.skippedPlans[id]={date:localISO(),at:new Date().toISOString()};persist();renderToday();renderReview();toast('已標記為今天未完成')}
function quickLogFromPlan(id){const p=plans().find(x=>String(x.event_id)===String(id));if(!p)return;$('#logSubject').value=p.subject||'其他';$('#logActivity').value=p.activity||'複習';$('#logTopic').value=p.topic||'';$('#logMinutes').value=p.minutes||30;$('#logDialog').dataset.planId=id;$('#logDialog').showModal()}

function renderWeek(){
  const start=weekAnchor(),end=dateAdd(start,7);$('#weekRange').textContent=`${start.getMonth()+1}.${start.getDate()} — ${dateAdd(end,-1).getMonth()+1}.${dateAdd(end,-1).getDate()}`;
  const daynames=settings.weekStart===1?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const wg=$('#weekGrid');wg.innerHTML='';
  for(let i=0;i<7;i++){
    const d=dateAdd(start,i),iso=localISO(d),ps=plans().filter(x=>x.date===iso),ds=allLogs().filter(x=>x.date===iso),dm=ds.reduce((s,x)=>s+logMinutes(x),0),pm=ps.reduce((s,x)=>s+logMinutes(x),0);
    const el=document.createElement('div');el.className='day-page'+(iso===localISO()?' today':'');el.innerHTML=`<div class="dayname">${daynames[i]}</div><h3>${d.getDate()}</h3><div class="dayhours">${fmtMin(dm)} <small>/ ${fmtMin(pm)}</small></div>${[...ps.slice(0,3),...ds.filter(x=>!ps.some(p=>norm(p.topic)===norm(x.topic))).slice(0,2)].slice(0,4).map(x=>`<div class="day-mini"><b>${esc(x.subject||'')}</b>${esc((x.topic||x.activity||'').slice(0,34))}</div>`).join('')}`;wg.appendChild(el)
  }
  const wb=$('#weekSubjectBars');const weekPlans=plans().filter(x=>inRange(x.date,start,end)),weekDone=allLogs().filter(x=>inRange(x.date,start,end));
  wb.innerHTML=SUBJECTS.map(s=>{const pm=weekPlans.filter(x=>x.subject===s).reduce((a,x)=>a+logMinutes(x),0),dm=weekDone.filter(x=>x.subject===s).reduce((a,x)=>a+logMinutes(x),0),max=Math.max(pm,dm,1),pct=Math.min(100,dm/max*100);return `<div class="subject-bar-row"><b>${s}</b><div class="subject-bar-track"><i style="width:${pct}%"></i></div><small>${fmtMin(dm)} / ${fmtMin(pm)}</small></div>`}).join('');
  const wk=localISO(start);$('#weekNote').value=localStorage.getItem(STORE+'weeknote.'+wk)||'';$('#weekNote').oninput=e=>localStorage.setItem(STORE+'weeknote.'+wk,e.target.value)
}

function renderStudy(){
  const tabs=$('#subjectTabs');tabs.innerHTML=SUBJECTS.map(s=>`<button class="${state.activeSubject===s?'active':''}" data-subject="${s}">${s}</button>`).join('');
  $$('[data-subject]').forEach(b=>b.onclick=()=>{state.activeSubject=b.dataset.subject;renderStudy()});
  const sheet=$('#studySheet'); if(state.activeSubject==='英文'){renderEnglish(sheet);return}
  const s=state.activeSubject, logs=allLogs().filter(x=>x.subject===s).sort((a,b)=>String(b.date).localeCompare(String(a.date))), mp=state.manualProgress.filter(x=>x.subject===s);
  const totalMin=logs.reduce((a,x)=>a+logMinutes(x),0),monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1),monthMin=logs.filter(x=>parseLocal(x.date)>=monthStart).reduce((a,x)=>a+logMinutes(x),0);
  const topics=uniqBy(logs,x=>norm(x.topic||x.activity)).slice(0,10);
  sheet.innerHTML=`<div class="study-hero"><div><span class="card-kicker">SUBJECT FILE</span><h2>${s}</h2><p class="microcopy">最近的學習紀錄與補登狀態會自動從同步資料整理。</p></div><div><small>this month</small><strong>${fmtMin(monthMin)}</strong></div></div><div class="analytics-grid" style="margin-top:16px"><div class="metric-paper"><strong>${fmtMin(totalMin)}</strong><small>累積記錄時間</small></div><div class="metric-paper"><strong>${mp.length}</strong><small>ManualProgress 條目</small></div><div class="metric-paper"><strong>${topics.length}</strong><small>近期不同主題</small></div></div><div class="recent-topics">${topics.length?topics.map(x=>`<div class="topic-slip"><small>${esc(x.date)} · ${esc(x.activity||'study')}</small><strong>${esc(x.topic||x.activity||'')}</strong></div>`).join(''):'<div class="empty-note">同步後，最近主題會出現在這裡。</div>'}</div>`;
}
function renderEnglish(sheet){
  sheet.innerHTML=`<div class="study-hero"><div><span class="card-kicker">ENGLISH HUB</span><h2>Reading × Vocabulary</h2><p class="microcopy">題本追蹤、3331 單字庫、錯題技能分析都放在同一頁。</p></div><div><small>reading bank</small><strong>${state.readingLibrary.length}</strong></div></div><div class="english-nav"><button data-eng="reading" class="${state.englishPanel==='reading'?'active':''}">Reading</button><button data-eng="vocab" class="${state.englishPanel==='vocab'?'active':''}">Vocabulary</button><button data-eng="progress" class="${state.englishPanel==='progress'?'active':''}">Progress</button></div><div id="englishPanel"></div>`;
  $$('[data-eng]').forEach(b=>b.onclick=()=>{state.englishPanel=b.dataset.eng;renderStudy()});
  const panel=$('#englishPanel');if(state.englishPanel==='reading')renderReadingLibrary(panel);else if(state.englishPanel==='vocab')renderVocabBank(panel);else renderEnglishProgress(panel);
}
function renderReadingLibrary(panel){
  let html='';const volumes=[...new Set(state.readingLibrary.map(r=>r.volume))].sort((a,b)=>a-b);
  volumes.forEach(vol=>{
    const volumeRows=state.readingLibrary.filter(r=>r.volume===vol).sort((a,b)=>a.day-b.day);
    html+=`<div class="volume-label"><span>Volume ${pad(vol)}</span><small>${volumeRows.length} readings · ${volumeRows.reduce((s,r)=>s+(+r.questions||0),0)} questions</small></div><div class="reading-library">`;
    volumeRows.forEach(r=>{
      const p=state.readingProgress[r.id]||{},done=p.status==='done'||(+p.correct>=0&&p.updated_at),q=+r.questions||7,vocabN=(r.highYieldVocab||[]).length;
      const meta=[r.category,r.wordCount?`${r.wordCount} words`:'',`${q}Q`,r.suggestedTime||'',r.source].filter(Boolean).map(esc).join(' · ');
      const vocabAction=vocabN?`<small><button class="tiny-action" data-add-reading-vocab="${r.id}">+ ${vocabN} high-yield words</button></small>`:'';
      html+=`<div class="reading-row"><div class="number">${pad(r.day)}</div><div><strong>${esc(r.title)}</strong><small>${meta}</small>${vocabAction}</div><div class="reading-status">${done?`<button class="reading-result" data-reading="${r.id}"><b>${p.correct ?? '—'}/${q}</b><span>${p.minutes?fmtMin(p.minutes):'done'} · edit</span></button>`:`<button class="tiny-action" data-reading="${r.id}">log result</button>`}</div></div>`
    });
    html+='</div>'
  });
  panel.innerHTML=html;$$('[data-reading]').forEach(b=>b.onclick=()=>openReading(b.dataset.reading));$$('[data-add-reading-vocab]').forEach(b=>b.onclick=()=>addReadingWords(b.dataset.addReadingVocab));
}
function renderVocabBank(panel){
  const due=getDueVocab().length,learned=Object.values(state.vocabProgress).filter(x=>x.reviews>0).length,pool=vocabPool();
  panel.innerHTML=`<div class="vocab-toolbar"><input id="vocabSearch" placeholder="search 3331 words…"><button class="ink-button" id="vocabStudyDue">review ${due}</button><button class="line-button" id="vocabStudyToday">today's set</button></div><div class="analytics-grid" style="margin-bottom:14px"><div class="metric-paper"><strong>${state.vocab.length||3331}</strong><small>Core Bank · + Reading Bank</small></div><div class="metric-paper"><strong>${learned}</strong><small>started</small></div><div class="metric-paper"><strong>${due}</strong><small>due today</small></div></div><div class="vocab-list" id="vocabList"></div>`;
  const draw=()=>{const q=norm($('#vocabSearch').value),arr=(q?pool.filter(x=>norm(x.word).includes(q)):pool).slice(0,80);$('#vocabList').innerHTML=arr.map(v=>{const p=state.vocabProgress[v.id]||{};return `<div class="vocab-item"><strong>${esc(v.word)}</strong><small>${esc(v.ipa||'')}</small><small>${esc(shortDef(v.definition))}</small><small>${p.reviews?`stage ${p.stage||0} · next ${p.due||'—'}`:'new'}</small></div>`}).join('')};draw();$('#vocabSearch').oninput=draw;$('#vocabStudyDue').onclick=()=>startVocabSession('due');$('#vocabStudyToday').onclick=()=>startVocabSession();
}
function renderEnglishProgress(panel){
  const rp=Object.values(state.readingProgress),done=rp.filter(x=>x.updated_at),answered=done.reduce((a,x)=>a+(+x.total||7),0),correct=done.reduce((a,x)=>a+(+x.correct||0),0),acc=answered?Math.round(correct/answered*100):0;
  const skills={};done.forEach(x=>(x.error_types||[]).forEach(s=>skills[s]=(skills[s]||0)+1));const top=Object.entries(skills).sort((a,b)=>b[1]-a[1]);
  panel.innerHTML=`<div class="analytics-grid"><div class="metric-paper"><strong>${done.length}</strong><small>readings logged / ${state.readingLibrary.length}</small></div><div class="metric-paper"><strong>${acc}%</strong><small>question accuracy</small></div><div class="metric-paper"><strong>${Object.values(state.vocabProgress).filter(x=>x.reviews>0).length}</strong><small>vocab started</small></div></div><div class="paper-card" style="box-shadow:none;margin-top:14px"><span class="card-kicker">SKILL ERRORS</span><div class="subject-bars">${top.length?top.map(([s,n])=>`<div class="subject-bar-row"><b>${esc(s)}</b><div class="subject-bar-track"><i style="width:${Math.min(100,n/(top[0][1]||1)*100)}%"></i></div><small>${n}</small></div>`).join(''):'<div class="empty-note">開始記錄閱讀成績後，錯題類型會累積在這裡。</div>'}</div></div>`;
}

function renderReview(){
  const due=getDueVocab(),un=unloggedPlans(7),qs=state.questionLog.filter(q=>(+q.wrong||0)>0&&!truthy(q.reviewed));
  $('#reviewVocabCount').textContent=due.length;$('#reviewUnloggedCount').textContent=un.length;$('#reviewQuestionCount').textContent=qs.length;
  $('#reviewVocabPreview').innerHTML=due.length?due.slice(0,10).map(v=>`<div class="review-item"><strong>${esc(v.word)}</strong><small>${esc(shortDef(v.definition))}</small></div>`).join('')+`<button class="ink-button" id="reviewStartVocab" style="margin-top:14px">review due</button>`:'<div class="empty-note">單字目前沒有到期。</div>';
  if($('#reviewStartVocab'))$('#reviewStartVocab').onclick=()=>startVocabSession('due');
  $('#reviewUnlogged').innerHTML=un.length?un.slice(0,10).map(p=>`<div class="review-item"><strong>${esc(p.topic||p.activity)}</strong><small>${esc(p.date)} · ${esc(p.subject)} · ${fmtMin(p.minutes)}</small></div>`).join(''):'<div class="empty-note">近期沒有漏記。</div>';
  $('#reviewQuestions').innerHTML=qs.length?qs.slice(0,10).map(q=>`<div class="review-item"><strong>${esc(q.topic||q.source||'題目紀錄')}</strong><small>${esc(q.date||'')} · 錯 ${+q.wrong||0} 題 · ${esc(q.error_type||'')}</small></div>`).join(''):'<div class="empty-note">目前沒有待回看的錯題紀錄。</div>';
}
function truthy(v){return v===true||['true','1','yes','是','已訂正','完成'].includes(String(v).toLowerCase())}

function renderArchive(){
  const now=new Date(),ms=new Date(now.getFullYear(),now.getMonth(),1),me=new Date(now.getFullYear(),now.getMonth()+1,1),logs=allLogs().filter(x=>inRange(x.date,ms,me)),min=logs.reduce((a,x)=>a+logMinutes(x),0),days=new Set(logs.map(x=>x.date)).size,eng=logs.filter(x=>x.subject==='英文').reduce((a,x)=>a+logMinutes(x),0),focus=logs.filter(x=>String(x.source||'').includes('Page & Pace')).reduce((a,x)=>a+logMinutes(x),0);
  $('#monthStats').innerHTML=`<div><small>study time</small><strong>${fmtMin(min)}</strong></div><div><small>active days</small><strong>${days}</strong></div><div><small>English</small><strong>${fmtMin(eng)}</strong></div><div><small>Page & Pace focus</small><strong>${fmtMin(focus)}</strong></div>`;
  $('#webAppUrl').value=settings.webAppUrl||'';$('#syncToken').value=settings.token||'';$('#newWordCount').value=settings.newWordCount;$('#weekStart').value=String(settings.weekStart);
  const recent=allLogs().sort((a,b)=>String(b.date+b.start_time).localeCompare(String(a.date+a.start_time))).slice(0,16);$('#recentTrail').innerHTML=recent.length?recent.map(x=>`<div class="trail-item"><small>${esc(x.date)} · ${esc(x.subject||'')}</small><strong>${esc(x.topic||x.activity||'study')}</strong><small>${fmtMin(x.minutes)} · ${esc(x.activity||'')}</small></div>`).join(''):'<div class="empty-note">同步後會顯示最近紀錄。</div>';
}

function startPlanFocus(id){const p=plans().find(x=>String(x.event_id)===String(id));if(!p)return;startTimer({mode:'focus',subject:p.subject||'其他',activity:p.activity||'看課',topic:p.topic||'',planId:p.event_id})}
function openFocus(mode='focus'){const d=$('#focusDialog');$('#focusMode').value=mode;d.showModal()}
function startTimer(ctx){
  const mode=TIMER_MODES[ctx.mode]?ctx.mode:'focus';timerState={...ctx,mode,running:true,startedAt:Date.now(),elapsedBefore:0,durationSec:TIMER_MODES[mode].work?TIMER_MODES[mode].work*60:null};saveJSON(STORE+'timer',timerState);renderTimer();renderToday();toast(`${TIMER_MODES[mode].label.toLowerCase()} started`)
}
function timerElapsed(){if(!timerState)return 0;return Math.max(0,+timerState.elapsedBefore||0)+(timerState.running?Math.max(0,(Date.now()-(+timerState.startedAt||Date.now()))/1000):0)}
function pauseTimer(){if(!timerState||!timerState.running)return;timerState.elapsedBefore=timerElapsed();timerState.running=false;timerState.startedAt=null;saveJSON(STORE+'timer',timerState);renderTimer()}
function resumeTimer(){if(!timerState||timerState.running)return;timerState.running=true;timerState.startedAt=Date.now();saveJSON(STORE+'timer',timerState);renderTimer()}
function renderTimer(){
  clearInterval(tickHandle);const mode=timerState?TIMER_MODES[timerState.mode]:TIMER_MODES.focus;
  $$('#timerModes button').forEach(b=>b.classList.toggle('active',(timerState?.mode||'focus')===b.dataset.mode));
  const paint=()=>{
    let sec;if(!timerState){sec=mode.work*60}else{const elapsed=timerElapsed();sec=timerState.durationSec==null?elapsed:Math.max(0,timerState.durationSec-elapsed);if(timerState.durationSec!=null&&sec<=0&&timerState.running){pauseTimer();try{navigator.vibrate?.([120,60,120])}catch{}toast('focus complete — finish & log');return}}
    const label=formatClock(sec);$('#timerDisplay').textContent=label;$('#miniTimerClock').textContent=label;$('#timerContext').textContent=timerState?`${timerState.subject} · ${timerState.activity} · ${timerState.topic||'untitled'}`:'choose a task, then start.';
    $('#timerStart').textContent=timerState?(timerState.running?'running':'resume'):'start';$('#timerStart').disabled=!!timerState?.running;$('#timerPause').disabled=!timerState?.running;$('#timerFinish').disabled=!timerState;$('#miniTimer').hidden=!timerState;$('#miniTimerLabel').textContent=mode.label;
  };paint();if(timerState?.running)tickHandle=setInterval(paint,500)
}
function formatClock(sec){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${pad(h)}:${pad(m)}:${pad(s)}`:`${pad(m)}:${pad(s)}`}
async function finishTimer(){
  if(!timerState)return;const ctx={...timerState},elapsed=Math.max(60,timerElapsed()),minutes=Math.max(1,Math.round(elapsed/60));timerState=null;localStorage.removeItem(STORE+'timer');clearInterval(tickHandle);renderTimer();
  await addQuickLog({subject:ctx.subject,activity:ctx.activity,topic:ctx.topic,minutes,notes:ctx.planId?`plan_event_id=${ctx.planId}`:'',format:'Focus'});toast(`✓ ${fmtMin(minutes)} 已記錄`);renderAll()
}

async function addQuickLog({subject,activity,topic,minutes,notes='',format=''}){
  const end=new Date(),start=new Date(end.getTime()-(+minutes||1)*60000),item={event_id:uid('pp'),date:localISO(end),type:'DONE',subject:subject||'其他',activity:activity||'學習',topic:topic||'',minutes:+minutes||1,status:'完成',format:format||'',source:'Page & Pace',platform:'Web',domain:'',understanding:'',url:'',notes,updated_at:new Date().toISOString(),start_time:dateTimeLocal(start),end_time:dateTimeLocal(end),calendar_event_id:''};
  state.quickLog.unshift(item);persist();renderAll();await postCloud('quick_add',[item]);return item
}
function dateTimeLocal(d){return `${localISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`}

function getDueVocab(){const today=localISO();return vocabPool().filter(v=>{const p=state.vocabProgress[v.id];return p&&p.reviews>0&&p.due&&p.due<=today&&!p.mastered})}
function getUnseenVocab(n=settings.newWordCount){const limit=Math.max(0,+n||0),selected=vocabPool().filter(v=>{const p=state.vocabProgress[v.id];return p&&(+p.reviews||0)===0}),ordinary=state.vocab.filter(v=>!state.vocabProgress[v.id]);return uniqBy([...selected,...ordinary],x=>String(x.id)).slice(0,limit)}
function shortDef(s){return String(s||'').replace(/\s+/g,' ').replace(/,{2,}/g,',').slice(0,110)}
function startVocabSession(kind='today'){
  const q=kind==='due'?getDueVocab():[...getDueVocab(),...getUnseenVocab()];if(!q.length){toast('目前沒有待背單字');return}
  vocabSession={queue:uniqBy(q,x=>x.id),index:0,revealed:false,startedAt:Date.now(),reviewed:0};$('#vocabSessionTitle').textContent=kind==='due'?'due review':"today's words";$('#vocabDialog').showModal();renderFlashcard()
}
function renderFlashcard(){
  if(!vocabSession)return;const v=vocabSession.queue[vocabSession.index];if(!v){finishVocabSession();return}const pct=(vocabSession.index/vocabSession.queue.length)*100;$('#vocabProgressBar').style.width=pct+'%';
  $('#flashcard').innerHTML=`<div class="word">${esc(v.word)}</div><div class="ipa">${esc(v.ipa||'')}</div>${vocabSession.revealed?`<div class="meaning">${esc(v.definition||'')}</div><div class="source">${esc(v.source||'core bank')}</div><button class="line-button" id="speakWord">🔊 pronunciation</button>`:`<button class="ink-button" id="revealWord">show meaning</button>`}`;
  $('#flashActions').hidden=!vocabSession.revealed;if($('#revealWord'))$('#revealWord').onclick=()=>{vocabSession.revealed=true;renderFlashcard()};if($('#speakWord'))$('#speakWord').onclick=()=>speak(v.word)
}
function speak(word){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.82;speechSynthesis.speak(u)}catch{}}
async function gradeWord(grade){
  if(!vocabSession)return;const v=vocabSession.queue[vocabSession.index],old=state.vocabProgress[v.id]||{stage:0,reviews:0,correct:0};let stage=+old.stage||0,days=1,mastered=false;
  if(grade==='again'){stage=Math.max(0,stage-1);days=0; if((old._again||0)<1){vocabSession.queue.push(v);old._again=(old._again||0)+1}}
  if(grade==='hard'){stage=Math.max(1,stage);days=1}
  if(grade==='good'){stage=Math.min(5,stage+1);days=[1,3,7,14,30,60][stage]||30}
  if(grade==='easy'){stage=Math.min(5,stage+2);days=[1,3,7,14,30,60][stage]||60;mastered=stage>=5}
  const due=dateAdd(new Date(),days);const p={word_id:String(v.id),word:v.word,state:mastered?'mastered':'learning',stage,due:localISO(due),last_reviewed:new Date().toISOString(),correct:(+old.correct||0)+(grade==='good'||grade==='easy'?1:0),reviews:(+old.reviews||0)+1,source:'Core Bank',mastered,updated_at:new Date().toISOString()};state.vocabProgress[v.id]=p;persist();postCloud('vocab_upsert',[p]);vocabSession.index++;vocabSession.reviewed++;vocabSession.revealed=false;renderFlashcard();renderTodayWords()
}
async function finishVocabSession(){const s=vocabSession;vocabSession=null;$('#vocabDialog').close();if(s?.reviewed){const mins=Math.max(1,Math.round((Date.now()-s.startedAt)/60000));await addQuickLog({subject:'英文',activity:'單字',topic:`Vocabulary · ${s.reviewed} cards`,minutes:mins,format:'Vocabulary'});toast(`單字完成 · ${s.reviewed} cards · ${mins}m`)}renderAll()}

function openReading(id){const r=state.readingLibrary.find(x=>x.id===id);if(!r)return;const p=state.readingProgress[id]||{},q=+r.questions||7;$('#readingDialogTitle').textContent=`Vol.${pad(r.volume)} · Day ${pad(r.day)} · ${r.title}`;$('#readingId').value=id;$('#readingCorrect').max=q;$('#readingCorrect').value=Math.min(q,p.correct??0);$('#readingTotalLabel').textContent=`/ ${q}`;$('#readingMinutes').value=p.minutes??0;$('#readingNote').value=p.note||'';$('#skillChips').innerHTML=SKILLS.map(s=>`<label><input type="checkbox" value="${esc(s)}" ${(p.error_types||[]).includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join('');$('#readingDialog').showModal()}
async function saveReading(){const id=$('#readingId').value,r=state.readingLibrary.find(x=>x.id===id);if(!r)return;const q=+r.questions||7,err=$$('#skillChips input:checked').map(x=>x.value),correct=Math.max(0,Math.min(q,+$('#readingCorrect').value||0)),p={id,volume:r.volume,day:r.day,title:r.title,status:'done',correct,total:q,minutes:+$('#readingMinutes').value||0,error_types:err,note:$('#readingNote').value.trim(),updated_at:new Date().toISOString()};state.readingProgress[id]=p;persist();$('#readingDialog').close();postCloud('reading_upsert',[{...p,error_types:err.join('|')}]);if(p.minutes>0)await addQuickLog({subject:'英文',activity:'閱讀',topic:`Vol.${pad(r.volume)} Day ${pad(r.day)} · ${r.title}`,minutes:p.minutes,format:'Reading',notes:`score=${p.correct}/${q};skills=${err.join(',')}`});renderAll();toast('閱讀紀錄已儲存')}

function jsonp(params){return new Promise((resolve,reject)=>{if(!settings.webAppUrl)return reject(new Error('no url'));const cb='pp_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);const s=document.createElement('script'),tm=setTimeout(()=>{cleanup();reject(new Error('timeout'))},18000);const cleanup=()=>{clearTimeout(tm);delete window[cb];s.remove()};window[cb]=d=>{cleanup();resolve(d)};const u=new URL(settings.webAppUrl);Object.entries({...params,callback:cb,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));s.src=u.toString();s.onerror=()=>{cleanup();reject(new Error('network'))};document.head.appendChild(s)})}
async function syncCloud(show=true){
  if(!settings.webAppUrl||!settings.token){setSync(false,'local');if(show)toast('請先在 Archive 填入同步設定');return}
  setSync(false,'syncing…');try{const d=await jsonp({action:'sync',token:settings.token,refresh_calendar:'1'});if(!d?.ok)throw new Error(d?.error||'sync failed');state.activities=d.activityLog||state.activities;state.manualProgress=d.manualProgress||[];state.quickLog=d.quickLog||[];state.questionLog=d.questionLog||[];
    if(Array.isArray(d.readingProgress)){d.readingProgress.forEach(x=>{const e={...x,correct:+x.correct||0,total:+x.total||7,minutes:+x.minutes||0,error_types:String(x.error_types||'').split('|').filter(Boolean)};state.readingProgress[e.id]=e})}
    if(Array.isArray(d.vocabProgress)){d.vocabProgress.forEach(x=>{state.vocabProgress[+x.word_id||x.word_id]={...x,stage:+x.stage||0,reviews:+x.reviews||0,correct:+x.correct||0,mastered:truthy(x.mastered)}})}
    persist();setSync(true,'synced');renderAll();if(show)toast('Page & Pace 已同步')
  }catch(e){setSync(false,'local cache');if(show)toast(`同步失敗：${e.message||e}`)}
}
function setSync(ok,label){const box=$('.sync-state');box.classList.toggle('ok',ok);$('#syncLabel').textContent=label}
async function postCloud(action,items){
  if(!settings.webAppUrl||!settings.token)return false;try{const body=new URLSearchParams({payload:JSON.stringify({token:settings.token,action,items})});await fetch(settings.webAppUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body});setTimeout(()=>syncCloud(false),900);return true}catch{return false}
}

function bind(){
  $$('[data-nav]').forEach(b=>b.onclick=e=>{e.preventDefault();setNav(b.dataset.nav)});$('#syncBtn').onclick=()=>syncCloud(true);$('#themeBtn').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.setItem(STORE+'theme',t)};
  $('#quickFocusBtn').onclick=()=>openFocus('focus');$('#quickLogBtn').onclick=()=>{$('#logDialog').dataset.planId='';$('#logDialog').showModal()};$('#confirmFocus').onclick=()=>{const ctx={mode:$('#focusMode').value,subject:$('#focusSubject').value,activity:$('#focusActivity').value,topic:$('#focusTopic').value.trim()};$('#focusDialog').close();startTimer(ctx)};
  $$('#timerModes button').forEach(b=>b.onclick=()=>{if(timerState){toast('先完成或結束目前 session');return}const m=b.dataset.mode;openFocus(m)});$('#timerStart').onclick=()=>{if(!timerState)openFocus('focus');else if(!timerState.running)resumeTimer()};$('#timerPause').onclick=pauseTimer;$('#timerFinish').onclick=finishTimer;$('#miniTimerOpen').onclick=()=>{setNav('today');document.querySelector('#focusCard').scrollIntoView({behavior:'smooth',block:'center'})};
  $('#saveQuickLog').onclick=async()=>{const planId=$('#logDialog').dataset.planId||'';await addQuickLog({subject:$('#logSubject').value,activity:$('#logActivity').value,topic:$('#logTopic').value.trim(),minutes:+$('#logMinutes').value||1,notes:planId?`plan_event_id=${planId}`:''});$('#logDialog').close();renderAll();toast('完成紀錄已儲存')};
  $$('#flashActions button').forEach(b=>b.onclick=()=>gradeWord(b.dataset.grade));$('#saveReading').onclick=saveReading;
  $('#saveSettings').onclick=async()=>{settings.webAppUrl=$('#webAppUrl').value.trim();settings.token=$('#syncToken').value.trim();settings.newWordCount=Math.max(0,+$('#newWordCount').value||0);settings.weekStart=+$('#weekStart').value||0;saveSettingsLocal();renderAll();await syncCloud(true)};
  $('#exportBackup').onclick=exportBackup;$('#importBackup').onchange=importBackup;
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(['today','week','study','review','archive'].includes(h))setNav(h)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderTimer();renderToday()}})
}
function exportBackup(){const payload={version:'Page & Pace v7 build01',exported_at:new Date().toISOString(),settings:{newWordCount:settings.newWordCount,weekStart:settings.weekStart},quickLog:state.quickLog,readingProgress:state.readingProgress,vocabProgress:state.vocabProgress,skippedPlans:state.skippedPlans};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download=`Page_and_Pace_backup_${localISO()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importBackup(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);state.quickLog=d.quickLog||state.quickLog;state.readingProgress=d.readingProgress||state.readingProgress;state.vocabProgress=d.vocabProgress||state.vocabProgress;state.skippedPlans=d.skippedPlans||state.skippedPlans;if(d.settings){settings.newWordCount=d.settings.newWordCount??settings.newWordCount;settings.weekStart=d.settings.weekStart??settings.weekStart;saveSettingsLocal()}persist();renderAll();toast('備份已匯入')}catch{toast('備份格式無法讀取')}};r.readAsText(f)}

async function init(){
  document.documentElement.dataset.theme=localStorage.getItem(STORE+'theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');bind();renderAll();await loadStatic();const h=location.hash.slice(1);if(['week','study','review','archive'].includes(h))setNav(h);else setNav('today');if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});if(settings.webAppUrl&&settings.token)syncCloud(false)
}
init().catch(e=>{console.error(e);toast('初始化失敗，請重新整理')});
})();
