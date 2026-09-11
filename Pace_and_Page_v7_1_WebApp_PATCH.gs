/**
 * Pace & Page v7.1 Web App PATCH
 *
 * IMPORTANT
 * - 保留既有 syncStudyCalendar() 與 Calendar -> ActivityLog trigger。
 * - Apps Script 專案內只能有一組 doGet / doPost；用本檔取代舊 Web App PATCH。
 * - Script Properties：STUDY_WEB_SECRET = 既有同步密鑰。
 * - 不要把密鑰寫進 GitHub。
 */

const PP_ACTIVITY='ActivityLog';
const PP_MANUAL='ManualProgress';
const PP_QUICK='QuickLog';
const PP_QUESTION='QuestionLog';
const PP_VOCAB='Vocabulary';
const PP_WEEKLY='WeeklyPlan';
const PP_DECISION='DecisionLog';
const PP_PLANBOARD='PlanBoard';
const PP_DONE_CAL='後西醫｜DONE';
const PP_PLAN_CAL='後西醫｜PLAN';

function doGet(e){
  try{
    const p=(e&&e.parameter)||{},action=String(p.action||'');
    if(action==='sync'){
      if(!ppAuth_(p.token))return ppOutput_({ok:false,error:'unauthorized'},p.callback);
      const refresh={requested:String(p.refresh_calendar||'')==='1',ran:false,error:''};
      if(refresh.requested&&typeof syncStudyCalendar==='function'){
        try{syncStudyCalendar();refresh.ran=true}catch(err){refresh.error=String(err&&err.message||err)}
      }
      return ppOutput_({
        ok:true,
        activityLog:ppSheetObjects_(PP_ACTIVITY),
        manualProgress:ppSheetObjects_(PP_MANUAL),
        quickLog:ppSheetObjects_(PP_QUICK),
        questionLog:ppSheetObjects_(PP_QUESTION),
        vocabulary:ppSheetObjects_(PP_VOCAB),
        weeklyPlan:ppSheetObjects_(PP_WEEKLY),
        decisionLog:ppSheetObjects_(PP_DECISION),
        planBoard:ppSheetObjects_(PP_PLANBOARD),
        calendarRefresh:refresh,
        version:'7.1.0',time:new Date().toISOString()
      },p.callback);
    }
    return ppOutput_({ok:true,service:'Pace & Page',version:'7.1.0',time:new Date().toISOString()},p.callback);
  }catch(err){return ppOutput_({ok:false,error:String(err&&err.message||err)},e&&e.parameter&&e.parameter.callback)}
}

function doPost(e){
  try{
    const raw=e&&e.parameter&&e.parameter.payload;if(!raw)return ppJson_({ok:false,error:'missing_payload'});
    const body=JSON.parse(raw);if(!ppAuth_(body.token))return ppJson_({ok:false,error:'unauthorized'});
    const action=String(body.action||''),items=Array.isArray(body.items)?body.items:[];
    if(!items.length)return ppJson_({ok:true,changed:0});
    const lock=LockService.getDocumentLock();lock.waitLock(15000);
    try{
      let changed=0,calendarChanged=0,calendarErrors=[];
      if(action==='manual_upsert') changed=ppUpsert_(PP_MANUAL,'key',ppManualHeaders_(),items);
      else if(action==='manual_remove') changed=ppRemove_(PP_MANUAL,'key',items.map(x=>x.key));
      else if(action==='quick_add'){
        items.forEach(item=>{try{const ev=ppUpsertCalendarByWebId_(PP_DONE_CAL,item,'DONE');if(ev){calendarChanged++;item.calendar_event_id=ev.getId()}}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        changed=ppUpsert_(PP_QUICK,'event_id',ppQuickHeaders_(),items);
      }
      else if(action==='quick_remove'){
        items.forEach(item=>{const id=String(item.event_id||'');try{if(ppDeleteCalendarByMarker_(PP_DONE_CAL,'web_event_id',id,item.date||''))calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        changed=ppRemove_(PP_QUICK,'event_id',items.map(x=>x.event_id));
      }
      else if(action==='question_upsert') changed=ppUpsert_(PP_QUESTION,'id',ppQuestionHeaders_(),items);
      else if(action==='question_remove') changed=ppRemove_(PP_QUESTION,'id',items.map(x=>x.id));
      else if(action==='vocab_upsert') changed=ppUpsert_(PP_VOCAB,'id',ppVocabHeaders_(),items);
      else if(action==='vocab_remove') changed=ppRemove_(PP_VOCAB,'id',items.map(x=>x.id));
      else if(action==='weekly_upsert') changed=ppUpsert_(PP_WEEKLY,'id',ppWeeklyHeaders_(),items);
      else if(action==='weekly_remove') changed=ppRemove_(PP_WEEKLY,'id',items.map(x=>x.id));
      else if(action==='decision_upsert') changed=ppUpsert_(PP_DECISION,'id',ppDecisionHeaders_(),items);
      else if(action==='decision_remove') changed=ppRemove_(PP_DECISION,'id',items.map(x=>x.id));
      else if(action==='planboard_upsert'){
        items.forEach(item=>{
          try{
            if(String(item.bucket||'')==='day'&&item.date){const ev=ppUpsertPlanBoardCalendar_(item);if(ev){calendarChanged++;item.calendar_event_id=ev.getId()}}
            else{if(ppDeleteCalendarByMarker_(PP_PLAN_CAL,'planboard_id',String(item.id||''),item.date||''))calendarChanged++;item.calendar_event_id=''}
          }catch(err){calendarErrors.push(String(err&&err.message||err))}
        });
        changed=ppUpsert_(PP_PLANBOARD,'id',ppPlanBoardHeaders_(),items);
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
      }
      else if(action==='planboard_remove'){
        items.forEach(item=>{const old=ppFindObject_(PP_PLANBOARD,'id',item.id);try{if(ppDeleteCalendarByMarker_(PP_PLAN_CAL,'planboard_id',String(item.id||''),old&&old.date||''))calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        changed=ppRemove_(PP_PLANBOARD,'id',items.map(x=>x.id));
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
      }
      else if(action==='activity_update'){
        items.forEach(item=>{try{if(ppUpdateActivity_(item))changed++;calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
      }
      else if(action==='activity_remove'){
        items.forEach(item=>{try{if(ppRemoveActivity_(item))changed++;calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
      }
      else return ppJson_({ok:false,error:'unknown_action'});
      return ppJson_({ok:true,action,changed,calendarChanged,calendarErrors});
    }finally{lock.releaseLock()}
  }catch(err){return ppJson_({ok:false,error:String(err&&err.message||err)})}
}

function ppAuth_(token){const secret=PropertiesService.getScriptProperties().getProperty('STUDY_WEB_SECRET')||'';return !!secret&&String(token||'')===secret}
function ppManualHeaders_(){return ['key','subject','course_type','code','status','progress','recent','updated_at']}
function ppQuickHeaders_(){return ['event_id','date','type','subject','activity','topic','minutes','status','format','source','platform','domain','understanding','url','notes','updated_at','start_time','end_time','calendar_event_id']}
function ppQuestionHeaders_(){return ['id','date','subject','source','topic','total_questions','correct','wrong','accuracy','error_type','note','reviewed','reviewed_at','updated_at']}
function ppVocabHeaders_(){return ['id','word','meaning','source','sentence','level','due','last_reviewed','interval_step','mastered','created_at','updated_at']}
function ppWeeklyHeaders_(){return ['id','week_start','subject','planned_minutes','goal','updated_at']}
function ppDecisionHeaders_(){return ['id','title','reason','review_date','status','created_at','updated_at']}
function ppPlanBoardHeaders_(){return ['id','bucket','date','week_start','subject','activity','topic','planned_minutes','start_time','status','sort_order','calendar_event_id','created_at','updated_at']}

function ppSheet_(name,headers){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);return sh}
function ppSheetObjects_(name){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);if(!sh||sh.getLastRow()<1)return[];const v=sh.getDataRange().getDisplayValues(),h=v[0].map(x=>String(x||'').trim());return v.slice(1).filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>{const o={};h.forEach((k,i)=>{if(k)o[k]=r[i]??''});return o})}
function ppUpsert_(name,keyName,headers,items){const sh=ppSheet_(name,headers),keyCol=headers.indexOf(keyName),last=sh.getLastRow(),rows=last>1?sh.getRange(2,1,last-1,headers.length).getValues():[],idx=new Map();rows.forEach((r,i)=>{const k=String(r[keyCol]||'');if(k)idx.set(k,i+2)});let changed=0;items.forEach(item=>{const key=String(item[keyName]||'').trim();if(!key)return;const vals=headers.map(h=>ppNorm_(item[h])),row=idx.get(key);if(row)sh.getRange(row,1,1,headers.length).setValues([vals]);else{sh.appendRow(vals);idx.set(key,sh.getLastRow())}changed++});return changed}
function ppRemove_(name,keyName,keys){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);if(!sh||sh.getLastRow()<2)return 0;const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],col=h.indexOf(keyName);if(col<0)return 0;const wanted=new Set(keys.map(x=>String(x||'')).filter(Boolean)),v=sh.getRange(2,col+1,sh.getLastRow()-1,1).getValues(),rows=[];v.forEach((r,i)=>{if(wanted.has(String(r[0]||'')))rows.push(i+2)});rows.sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r));return rows.length}
function ppFindObject_(sheetName,keyName,keyValue){return ppSheetObjects_(sheetName).find(r=>String(r[keyName]||'')===String(keyValue||''))||null}
function ppNorm_(v){if(v===undefined||v===null)return'';if(typeof v==='boolean')return v;if(typeof v==='number'&&isFinite(v))return v;return String(v)}

function ppCalendar_(name){const c=CalendarApp.getCalendarsByName(name);if(!c.length)throw new Error('Calendar not found: '+name);return c[0]}
function ppDate_(v){if(!v)return null;const d=new Date(String(v));return isNaN(d.getTime())?null:d}
function ppDateAt_(dateStr,timeStr){const p=String(dateStr||'').split('-').map(Number),t=String(timeStr||'09:00').split(':').map(Number);return p.length===3?new Date(p[0],p[1]-1,p[2],t[0]||9,t[1]||0,0,0):new Date()}
function ppRange_(item,planned){const mins=Math.max(1,Number(item.minutes||item.planned_minutes)||1);let start=ppDate_(item.start_time),end=ppDate_(item.end_time);if(!start)start=ppDateAt_(item.date,typeof item.start_time==='string'&&/^\d\d:\d\d$/.test(item.start_time)?item.start_time:'09:00');if(!end)end=new Date(start.getTime()+mins*60000);if(end<=start)end=new Date(start.getTime()+mins*60000);return{start,end}}
function ppTitle_(item,kind){return ['後西醫',kind,item.subject||'',item.activity||'',item.topic||''].join('｜')}
function ppDesc_(item,kind,extra){return [`${kind==='PLAN'?'minutes':'actual_minutes'}=${Number(item.minutes||item.planned_minutes)||0}`,`status=${item.status||(kind==='PLAN'?'預定':'完成')}`,`subject=${item.subject||''}`,`activity=${item.activity||''}`,`understanding=${item.understanding||''}`,'source_app=Pace & Page',extra||'',item.event_id?`web_event_id=${item.event_id}`:''].filter(Boolean).join('\n')}
function ppFindByMarker_(cal,key,value,dateStr){if(!value)return null;let center=dateStr?ppDate_(dateStr+'T12:00:00'):new Date();if(!center)center=new Date();const from=new Date(center.getTime()-3*86400000),to=new Date(center.getTime()+4*86400000),needle=key+'='+value;for(const ev of cal.getEvents(from,to))if(String(ev.getDescription()||'').indexOf(needle)>=0)return ev;return null}
function ppDeleteCalendarByMarker_(calendarName,key,value,dateStr){if(!value)return false;const ev=ppFindByMarker_(ppCalendar_(calendarName),key,value,dateStr);if(!ev)return false;ev.deleteEvent();return true}
function ppUpsertCalendarByWebId_(calendarName,item,kind){const cal=ppCalendar_(calendarName),id=String(item.event_id||'').trim();if(!id)throw new Error('missing web_event_id');let ev=ppFindByMarker_(cal,'web_event_id',id,item.date),r=ppRange_(item,kind==='PLAN'),title=ppTitle_(item,kind),desc=ppDesc_(item,kind,'');if(ev){ev.setTitle(title);ev.setTime(r.start,r.end);ev.setDescription(desc)}else ev=cal.createEvent(title,r.start,r.end,{description:desc});return ev}
function ppUpsertPlanBoardCalendar_(item){const cal=ppCalendar_(PP_PLAN_CAL),id=String(item.id||'').trim();if(!id)throw new Error('missing planboard id');let ev=ppFindByMarker_(cal,'planboard_id',id,item.date),r=ppRange_({date:item.date,start_time:item.start_time,planned_minutes:item.planned_minutes},true),title=ppTitle_(item,'PLAN'),desc=ppDesc_(item,'PLAN','planboard_id='+id);if(ev){ev.setTitle(title);ev.setTime(r.start,r.end);ev.setDescription(desc)}else ev=cal.createEvent(title,r.start,r.end,{description:desc});return ev}

function ppFindCalendarEventById_(calendarName,eventId,dateStr){if(!eventId)return null;const cal=ppCalendar_(calendarName);try{const direct=cal.getEventById(eventId);if(direct)return direct}catch(e){}let center=dateStr?ppDate_(dateStr+'T12:00:00'):new Date();if(!center)center=new Date();for(const ev of cal.getEvents(new Date(center.getTime()-3*86400000),new Date(center.getTime()+4*86400000)))if(String(ev.getId())===String(eventId))return ev;return null}
function ppActivityObject_(eventId){return ppFindObject_(PP_ACTIVITY,'event_id',eventId)}
function ppUpdateActivity_(item){const id=String(item.event_id||'');if(!id)return false;const old=ppActivityObject_(id);if(!old)throw new Error('ActivityLog event not found');const kind=String(old.type||item.type||'DONE').toUpperCase().includes('PLAN')?'PLAN':'DONE',calName=kind==='PLAN'?PP_PLAN_CAL:PP_DONE_CAL,ev=ppFindCalendarEventById_(calName,id,old.date||item.date);if(!ev)throw new Error('Calendar event not found');const merged=Object.assign({},old,item),r=ppRange_({date:merged.date,start_time:merged.start_time||merged.start,minutes:merged.minutes||merged.actual_minutes||60,end_time:merged.end_time},kind==='PLAN');ev.setTitle(ppTitle_(merged,kind));ev.setTime(r.start,r.end);const desc=String(ev.getDescription()||'');ev.setDescription(desc+'\nsource_app=Pace & Page');ppUpdateActivityRow_(id,merged,kind,r);return true}
function ppUpdateActivityRow_(eventId,item,kind,r){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PP_ACTIVITY);if(!sh)return;const values=sh.getDataRange().getValues(),headers=values[0].map(String),idCol=headers.indexOf('event_id');if(idCol<0)return;for(let i=1;i<values.length;i++){if(String(values[i][idCol])!==String(eventId))continue;const updates={date:item.date,type:kind,subject:item.subject,activity:item.activity,topic:item.topic,start_time:r.start,end_time:r.end,minutes:Number(item.minutes)||Number(item.actual_minutes)||0,status:kind==='PLAN'?'預定':'完成',understanding:item.understanding||'',notes:item.notes||''};headers.forEach((h,c)=>{if(updates[h]!==undefined)values[i][c]=updates[h]});sh.getRange(i+1,1,1,headers.length).setValues([values[i]]);return}}
function ppRemoveActivity_(item){const id=String(item.event_id||'');if(!id)return false;const old=ppActivityObject_(id);if(!old)throw new Error('ActivityLog event not found');const kind=String(old.type||'DONE').toUpperCase().includes('PLAN')?'PLAN':'DONE',calName=kind==='PLAN'?PP_PLAN_CAL:PP_DONE_CAL,ev=ppFindCalendarEventById_(calName,id,old.date);if(ev)ev.deleteEvent();ppRemove_(PP_ACTIVITY,'event_id',[id]);return true}

function ppOutput_(obj,callback){const payload=JSON.stringify(obj),cb=String(callback||'');if(cb&&/^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON)}
function ppJson_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
