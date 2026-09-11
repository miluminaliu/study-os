/**
 * Study OS v7 Web App PATCH
 *
 * IMPORTANT
 * - 保留既有 syncStudyCalendar() 與其 Calendar -> ActivityLog trigger。
 * - 專案內只能有一組 doGet / doPost；用本檔取代上一版 Study OS WebApp patch。
 * - 同步密鑰不寫在這份公開程式。請到 Apps Script：專案設定 → 指令碼屬性
 *   新增 STUDY_WEB_SECRET = 你目前 Study OS 已在使用的同步密鑰。
 * - Calendar 依名稱尋找：後西醫｜DONE / 後西醫｜PLAN。
 */

const STUDY_V7_MANUAL_SHEET='ManualProgress';
const STUDY_V7_QUICK_SHEET='QuickLog';
const STUDY_V7_QUESTION_SHEET='QuestionLog';
const STUDY_V7_VOCAB_SHEET='Vocabulary';
const STUDY_V7_WEEKLY_SHEET='WeeklyPlan';
const STUDY_V7_DECISION_SHEET='DecisionLog';
const STUDY_V7_DONE_CAL='後西醫｜DONE';
const STUDY_V7_PLAN_CAL='後西醫｜PLAN';

function doGet(e){
  try{
    const p=(e&&e.parameter)||{},action=String(p.action||'');
    if(action==='sync'){
      if(!studyV7_auth_(p.token))return studyV7_output_({ok:false,error:'unauthorized'},p.callback);
      const refresh={requested:String(p.refresh_calendar||'')==='1',ran:false,error:''};
      if(refresh.requested&&typeof syncStudyCalendar==='function'){
        try{syncStudyCalendar();refresh.ran=true}catch(err){refresh.error=String(err&&err.message||err)}
      }
      return studyV7_output_({
        ok:true,
        activityLog:studyV7_sheetObjects_('ActivityLog'),
        manualProgress:studyV7_sheetObjects_(STUDY_V7_MANUAL_SHEET),
        quickLog:studyV7_sheetObjects_(STUDY_V7_QUICK_SHEET),
        questionLog:studyV7_sheetObjects_(STUDY_V7_QUESTION_SHEET),
        vocabulary:studyV7_sheetObjects_(STUDY_V7_VOCAB_SHEET),
        weeklyPlan:studyV7_sheetObjects_(STUDY_V7_WEEKLY_SHEET),
        decisionLog:studyV7_sheetObjects_(STUDY_V7_DECISION_SHEET),
        calendarRefresh:refresh,
        version:'7.0.0',time:new Date().toISOString()
      },p.callback);
    }
    return studyV7_output_({ok:true,service:'Study OS v7',version:'7.0.0',time:new Date().toISOString()},p.callback);
  }catch(err){return studyV7_output_({ok:false,error:String(err&&err.message||err)},e&&e.parameter&&e.parameter.callback)}
}

function doPost(e){
  try{
    const raw=e&&e.parameter&&e.parameter.payload;
    if(!raw)return studyV7_json_({ok:false,error:'missing_payload'});
    const body=JSON.parse(raw);
    if(!studyV7_auth_(body.token))return studyV7_json_({ok:false,error:'unauthorized'});
    const action=String(body.action||''),items=Array.isArray(body.items)?body.items:[];
    if(!items.length)return studyV7_json_({ok:true,changed:0});
    const lock=LockService.getDocumentLock(); lock.waitLock(15000);
    try{
      let changed=0,calendarChanged=0,calendarErrors=[];
      if(action==='manual_upsert'||action==='upsert') changed=studyV7_upsert_(STUDY_V7_MANUAL_SHEET,'key',studyV7_manualHeaders_(),items);
      else if(action==='manual_remove'||action==='remove') changed=studyV7_remove_(STUDY_V7_MANUAL_SHEET,'key',items.map(x=>x.key));
      else if(action==='quick_add'){
        changed=studyV7_upsert_(STUDY_V7_QUICK_SHEET,'event_id',studyV7_quickHeaders_(),items);
        items.forEach(item=>{try{const ev=studyV7_upsertCalendar_(STUDY_V7_DONE_CAL,item,'DONE');if(ev){calendarChanged++;item.calendar_event_id=ev.getId()}}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        studyV7_upsert_(STUDY_V7_QUICK_SHEET,'event_id',studyV7_quickHeaders_(),items);
      }
      else if(action==='quick_remove'){
        const ids=items.map(x=>String(x.event_id||'')).filter(Boolean);
        ids.forEach(id=>{try{const row=studyV7_findObject_(STUDY_V7_QUICK_SHEET,'event_id',id);if(studyV7_deleteCalendarByWebId_(STUDY_V7_DONE_CAL,id,row&&row.date||''))calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        changed=studyV7_remove_(STUDY_V7_QUICK_SHEET,'event_id',ids);
      }
      else if(action==='question_upsert') changed=studyV7_upsert_(STUDY_V7_QUESTION_SHEET,'id',studyV7_questionHeaders_(),items);
      else if(action==='question_remove') changed=studyV7_remove_(STUDY_V7_QUESTION_SHEET,'id',items.map(x=>x.id));
      else if(action==='vocab_upsert') changed=studyV7_upsert_(STUDY_V7_VOCAB_SHEET,'id',studyV7_vocabHeaders_(),items);
      else if(action==='vocab_remove') changed=studyV7_remove_(STUDY_V7_VOCAB_SHEET,'id',items.map(x=>x.id));
      else if(action==='weekly_upsert') changed=studyV7_upsert_(STUDY_V7_WEEKLY_SHEET,'id',studyV7_weeklyHeaders_(),items);
      else if(action==='weekly_remove') changed=studyV7_remove_(STUDY_V7_WEEKLY_SHEET,'id',items.map(x=>x.id));
      else if(action==='decision_upsert') changed=studyV7_upsert_(STUDY_V7_DECISION_SHEET,'id',studyV7_decisionHeaders_(),items);
      else if(action==='decision_remove') changed=studyV7_remove_(STUDY_V7_DECISION_SHEET,'id',items.map(x=>x.id));
      else if(action==='plan_add'){
        items.forEach(item=>{try{if(studyV7_upsertCalendar_(STUDY_V7_PLAN_CAL,item,'PLAN'))calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
        changed=items.length;
      }
      else if(action==='plan_remove'){
        items.forEach(item=>{try{if(studyV7_deleteCalendarByWebId_(STUDY_V7_PLAN_CAL,String(item.event_id||'')))calendarChanged++}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        if(typeof syncStudyCalendar==='function'){try{syncStudyCalendar()}catch(err){calendarErrors.push(String(err&&err.message||err))}}
        changed=items.length;
      }
      else return studyV7_json_({ok:false,error:'unknown_action'});
      return studyV7_json_({ok:true,action,changed,calendarChanged,calendarErrors});
    }finally{lock.releaseLock()}
  }catch(err){return studyV7_json_({ok:false,error:String(err&&err.message||err)})}
}

function studyV7_auth_(token){const secret=PropertiesService.getScriptProperties().getProperty('STUDY_WEB_SECRET')||'';return !!secret&&String(token||'')===secret}
function studyV7_manualHeaders_(){return ['key','subject','course_type','code','status','progress','recent','updated_at']}
function studyV7_quickHeaders_(){return ['event_id','date','type','subject','activity','topic','minutes','status','format','source','platform','domain','understanding','url','notes','updated_at','start_time','end_time','calendar_event_id']}
function studyV7_questionHeaders_(){return ['id','date','subject','source','topic','total_questions','correct','wrong','accuracy','error_type','note','reviewed','reviewed_at','updated_at']}
function studyV7_vocabHeaders_(){return ['id','word','meaning','source','sentence','level','due','last_reviewed','interval_step','mastered','created_at','updated_at']}
function studyV7_weeklyHeaders_(){return ['id','week_start','subject','planned_minutes','goal','updated_at']}
function studyV7_decisionHeaders_(){return ['id','title','reason','review_date','status','created_at','updated_at']}

function studyV7_sheet_(name,headers){
  const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
  if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
  sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);return sh;
}
function studyV7_sheetObjects_(name){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);if(!sh||sh.getLastRow()<1)return[];const v=sh.getDataRange().getDisplayValues(),h=v[0].map(x=>String(x||'').trim());return v.slice(1).filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>{const o={};h.forEach((k,i)=>{if(k)o[k]=r[i]??''});return o})}
function studyV7_upsert_(name,keyName,headers,items){const sh=studyV7_sheet_(name,headers),keyCol=headers.indexOf(keyName),last=sh.getLastRow(),rows=last>1?sh.getRange(2,1,last-1,headers.length).getValues():[],idx=new Map();rows.forEach((r,i)=>{const k=String(r[keyCol]||'');if(k)idx.set(k,i+2)});let changed=0;items.forEach(item=>{const key=String(item[keyName]||'').trim();if(!key)return;const vals=headers.map(h=>studyV7_norm_(item[h])),row=idx.get(key);if(row)sh.getRange(row,1,1,headers.length).setValues([vals]);else{sh.appendRow(vals);idx.set(key,sh.getLastRow())}changed++});return changed}
function studyV7_remove_(name,keyName,keys){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);if(!sh||sh.getLastRow()<2)return 0;const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],col=h.indexOf(keyName);if(col<0)return 0;const wanted=new Set(keys.map(x=>String(x||'')).filter(Boolean)),v=sh.getRange(2,col+1,sh.getLastRow()-1,1).getValues(),rows=[];v.forEach((r,i)=>{if(wanted.has(String(r[0]||'')))rows.push(i+2)});rows.sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r));return rows.length}
function studyV7_norm_(v){if(v===undefined||v===null)return'';if(typeof v==='boolean')return v;if(typeof v==='number'&&isFinite(v))return v;return String(v)}

function studyV7_calendarByName_(name){const c=CalendarApp.getCalendarsByName(name);if(!c.length)throw new Error('Calendar not found: '+name);return c[0]}
function studyV7_range_(item){const mins=Math.max(1,Number(item.minutes)||1);let start=studyV7_date_(item.start_time),end=studyV7_date_(item.end_time);if(!start){const p=String(item.date||Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')).split('-').map(Number);start=new Date(p[0],p[1]-1,p[2],9,0,0,0)}if(!end)end=new Date(start.getTime()+mins*60000);if(end<=start)end=new Date(start.getTime()+mins*60000);return{start,end}}
function studyV7_date_(v){if(!v)return null;const d=new Date(String(v));return isNaN(d.getTime())?null:d}
function studyV7_title_(item,kind){return ['後西醫',kind,item.subject||'',item.activity||'',item.topic||''].join('｜')}
function studyV7_desc_(item,kind){return [`${kind==='PLAN'?'minutes':'actual_minutes'}=${Number(item.minutes)||0}`,`status=${item.status||(kind==='PLAN'?'預定':'完成')}`,`subject=${item.subject||''}`,`activity=${item.activity||''}`,`understanding=${item.understanding||''}`,'source_app=Study OS v7',`web_event_id=${item.event_id||''}`].join('\n')}
function studyV7_upsertCalendar_(calendarName,item,kind){const cal=studyV7_calendarByName_(calendarName),id=String(item.event_id||'').trim();if(!id)throw new Error('missing web_event_id');let ev=studyV7_findCalendarByWebId_(cal,id,item.date);const r=studyV7_range_(item),title=studyV7_title_(item,kind),desc=studyV7_desc_(item,kind);if(ev){ev.setTitle(title);ev.setTime(r.start,r.end);ev.setDescription(desc)}else ev=cal.createEvent(title,r.start,r.end,{description:desc});return ev}
function studyV7_findCalendarByWebId_(cal,id,dateStr){let center=dateStr?studyV7_date_(dateStr+'T12:00:00'):new Date();if(!center)center=new Date();const from=new Date(center.getTime()-86400000),to=new Date(center.getTime()+2*86400000),needle='web_event_id='+id;for(const ev of cal.getEvents(from,to))if(String(ev.getDescription()||'').indexOf(needle)>=0)return ev;return null}
function studyV7_findObject_(sheetName,keyName,keyValue){return studyV7_sheetObjects_(sheetName).find(r=>String(r[keyName]||'')===String(keyValue||''))||null}
function studyV7_deleteCalendarByWebId_(calendarName,id,dateStr){if(!id)return false;const cal=studyV7_calendarByName_(calendarName),ev=studyV7_findCalendarByWebId_(cal,id,dateStr||'');if(!ev)return false;ev.deleteEvent();return true}

function studyV7_output_(obj,callback){const payload=JSON.stringify(obj),cb=String(callback||'');if(cb&&/^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON)}
function studyV7_json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
