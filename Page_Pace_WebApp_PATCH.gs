/**
 * Page & Pace v7 build01 — Apps Script Web App PATCH
 *
 * Purpose:
 * - Keep the existing Calendar -> ActivityLog workflow.
 * - Keep existing ManualProgress / QuickLog / QuestionLog behavior.
 * - Add ReadingProgress and VocabProgress sync for Page & Pace.
 * - Website DONE entries are mirrored to a Google Calendar named "後西醫｜DONE".
 *
 * IMPORTANT
 * 1. Keep your existing syncStudyCalendar() function and its trigger in the project.
 * 2. Replace the previous Web App doGet/doPost patch with this file so there is only ONE doGet/doPost pair.
 * 3. Replace the placeholder below with the same sync secret you already use.
 */

const PP_SYNC_SECRET = 'PASTE_YOUR_EXISTING_SYNC_SECRET_HERE';
const PP_DONE_CALENDAR_NAME = '後西醫｜DONE';
const PP_MANUAL_SHEET = 'ManualProgress';
const PP_QUICK_SHEET = 'QuickLog';
const PP_QUESTION_SHEET = 'QuestionLog';
const PP_READING_SHEET = 'ReadingProgress';
const PP_VOCAB_SHEET = 'VocabProgress';

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '');

    if (action === 'sync') {
      if (p.token !== PP_SYNC_SECRET) return ppOutput_({ok:false,error:'unauthorized'}, p.callback);
      const calendarRefresh = {requested:String(p.refresh_calendar||'')==='1',ran:false,error:''};
      if (calendarRefresh.requested) {
        try {
          if (typeof syncStudyCalendar === 'function') {
            syncStudyCalendar();
            calendarRefresh.ran = true;
          } else {
            calendarRefresh.error = 'syncStudyCalendar() not found';
          }
        } catch (err) {
          calendarRefresh.error = String(err && err.message || err);
        }
      }
      ppEnsureNewSheets_();
      return ppOutput_({
        ok:true,
        activityLog:ppSheetObjects_('ActivityLog'),
        manualProgress:ppSheetObjects_(PP_MANUAL_SHEET),
        quickLog:ppSheetObjects_(PP_QUICK_SHEET),
        questionLog:ppSheetObjects_(PP_QUESTION_SHEET),
        readingProgress:ppSheetObjects_(PP_READING_SHEET),
        vocabProgress:ppSheetObjects_(PP_VOCAB_SHEET),
        calendarRefresh:calendarRefresh,
        time:new Date().toISOString()
      }, p.callback);
    }

    if (action === 'quick_status') {
      if (p.token !== PP_SYNC_SECRET) return ppOutput_({ok:false,error:'unauthorized'}, p.callback);
      const id = String(p.event_id || '');
      const row = ppFindObjectByKey_(PP_QUICK_SHEET,'event_id',id);
      const cal = ppDoneCalendar_();
      let ev = null;
      if (cal && row) {
        if (row.calendar_event_id) {
          try { ev = cal.getEventById(String(row.calendar_event_id)); } catch (_e) {}
        }
        if (!ev) ev = ppFindCalendarEventByWebId_(cal,id,row.date);
      }
      return ppOutput_({ok:true,event_id:id,inSheet:!!row,inCalendar:!!ev,calendar_event_id:ev?ev.getId():(row&&row.calendar_event_id||'')},p.callback);
    }

    return ppOutput_({ok:true,service:'Page & Pace v7',time:new Date().toISOString()},p.callback);
  } catch (err) {
    return ppOutput_({ok:false,error:String(err&&err.message||err)},e&&e.parameter&&e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) return ppJson_({ok:false,error:'missing_payload'});
    const body = JSON.parse(raw);
    if (body.token !== PP_SYNC_SECRET) return ppJson_({ok:false,error:'unauthorized'});
    const action = String(body.action || '');
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return ppJson_({ok:true,changed:0});

    const lock = LockService.getDocumentLock();
    lock.waitLock(15000);
    try {
      let changed = 0, calendarChanged = 0, calendarErrors = [];

      if (action === 'manual_upsert' || action === 'upsert') {
        changed = ppUpsertRows_(ppSheet_(PP_MANUAL_SHEET,ppManualHeaders_()),'key',ppManualHeaders_(),items);
      } else if (action === 'manual_remove' || action === 'remove') {
        changed = ppRemoveByKey_(ppSheet_(PP_MANUAL_SHEET,ppManualHeaders_()),'key',items.map(x=>x.key));
      } else if (action === 'quick_add') {
        changed = ppUpsertRows_(ppSheet_(PP_QUICK_SHEET,ppQuickHeaders_()),'event_id',ppQuickHeaders_(),items);
        const enriched = [];
        items.forEach(src=>{
          const item = Object.assign({},src);
          try {
            const ev = ppUpsertCalendarEventForQuick_(item);
            if (ev) { item.calendar_event_id = ev.getId(); calendarChanged++; }
          } catch (err) { calendarErrors.push(String(err&&err.message||err)); }
          enriched.push(item);
        });
        ppUpsertRows_(ppSheet_(PP_QUICK_SHEET,ppQuickHeaders_()),'event_id',ppQuickHeaders_(),enriched);
      } else if (action === 'quick_remove') {
        const ids = items.map(x=>String(x.event_id||'')).filter(Boolean);
        ids.forEach(id=>{try{calendarChanged += ppDeleteCalendarEventByWebId_(id)?1:0}catch(err){calendarErrors.push(String(err&&err.message||err))}});
        changed = ppRemoveByKey_(ppSheet_(PP_QUICK_SHEET,ppQuickHeaders_()),'event_id',ids);
      } else if (action === 'question_upsert') {
        changed = ppUpsertRows_(ppSheet_(PP_QUESTION_SHEET,ppQuestionHeaders_()),'id',ppQuestionHeaders_(),items);
      } else if (action === 'question_remove') {
        changed = ppRemoveByKey_(ppSheet_(PP_QUESTION_SHEET,ppQuestionHeaders_()),'id',items.map(x=>x.id));
      } else if (action === 'reading_upsert') {
        changed = ppUpsertRows_(ppSheet_(PP_READING_SHEET,ppReadingHeaders_()),'id',ppReadingHeaders_(),items);
      } else if (action === 'reading_remove') {
        changed = ppRemoveByKey_(ppSheet_(PP_READING_SHEET,ppReadingHeaders_()),'id',items.map(x=>x.id));
      } else if (action === 'vocab_upsert') {
        changed = ppUpsertRows_(ppSheet_(PP_VOCAB_SHEET,ppVocabHeaders_()),'word_id',ppVocabHeaders_(),items);
      } else if (action === 'vocab_remove') {
        changed = ppRemoveByKey_(ppSheet_(PP_VOCAB_SHEET,ppVocabHeaders_()),'word_id',items.map(x=>x.word_id));
      } else {
        return ppJson_({ok:false,error:'unknown_action'});
      }
      return ppJson_({ok:true,action,changed,calendarChanged,calendarErrors});
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return ppJson_({ok:false,error:String(err&&err.message||err)});
  }
}

function ppManualHeaders_(){return ['key','subject','course_type','code','status','progress','recent','updated_at'];}
function ppQuickHeaders_(){return ['event_id','date','type','subject','activity','topic','minutes','status','format','source','platform','domain','understanding','url','notes','updated_at','start_time','end_time','calendar_event_id'];}
function ppQuestionHeaders_(){return ['id','date','subject','source','topic','total_questions','correct','wrong','accuracy','error_type','note','reviewed','reviewed_at','updated_at'];}
function ppReadingHeaders_(){return ['id','volume','day','title','status','correct','total','minutes','error_types','note','updated_at'];}
function ppVocabHeaders_(){return ['word_id','word','state','stage','due','last_reviewed','correct','reviews','source','mastered','updated_at'];}

function ppEnsureNewSheets_(){
  ppSheet_(PP_READING_SHEET,ppReadingHeaders_());
  ppSheet_(PP_VOCAB_SHEET,ppVocabHeaders_());
}

function ppSheet_(name,headers){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  if(sh.getMaxColumns()<headers.length) sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}
function ppSheetObjects_(name){
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if(!sh||sh.getLastRow()<1||sh.getLastColumn()<1)return[];
  const values=sh.getDataRange().getDisplayValues();
  if(!values.length)return[];
  const headers=values[0].map(x=>String(x||'').trim());
  return values.slice(1).filter(row=>row.some(v=>String(v||'').trim()!=='')).map(row=>{const obj={};headers.forEach((h,i)=>{if(h)obj[h]=row[i]==null?'':row[i]});return obj;});
}
function ppFindObjectByKey_(sheetName,keyName,keyValue){return ppSheetObjects_(sheetName).find(r=>String(r[keyName]||'')===String(keyValue||''))||null;}
function ppUpsertRows_(sh,keyName,headers,items){
  const keyCol=headers.indexOf(keyName),lastRow=sh.getLastRow();
  const current=lastRow>1?sh.getRange(2,1,lastRow-1,headers.length).getValues():[];
  const index=new Map();current.forEach((r,i)=>{const k=String(r[keyCol]||'');if(k)index.set(k,i+2)});
  let changed=0;
  items.forEach(item=>{const key=String(item[keyName]||'').trim();if(!key)return;const vals=headers.map(h=>ppNormalize_(item[h])),row=index.get(key);if(row)sh.getRange(row,1,1,headers.length).setValues([vals]);else{sh.appendRow(vals);index.set(key,sh.getLastRow())}changed++;});
  return changed;
}
function ppRemoveByKey_(sh,keyName,keys){
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],col=headers.indexOf(keyName);if(col<0||sh.getLastRow()<2)return 0;
  const wanted=new Set(keys.map(x=>String(x||'')).filter(Boolean)),vals=sh.getRange(2,col+1,sh.getLastRow()-1,1).getValues(),rows=[];
  vals.forEach((r,i)=>{if(wanted.has(String(r[0]||'')))rows.push(i+2)});rows.sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r));return rows.length;
}

function ppDoneCalendar_(){
  const list=CalendarApp.getCalendarsByName(PP_DONE_CALENDAR_NAME);
  if(!list||!list.length)throw new Error('DONE calendar not found: '+PP_DONE_CALENDAR_NAME);
  return list[0];
}
function ppQuickDateRange_(item){
  const mins=Math.max(1,Number(item.minutes)||1);let end=ppParseDateSafe_(item.end_time),start=ppParseDateSafe_(item.start_time);
  if(!end){const parts=String(item.date||Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')).split('-').map(Number),now=new Date();end=new Date(parts[0],parts[1]-1,parts[2],now.getHours(),now.getMinutes(),now.getSeconds(),0);}
  if(!start)start=new Date(end.getTime()-mins*60000);if(end<=start)end=new Date(start.getTime()+mins*60000);return{start,end};
}
function ppParseDateSafe_(v){if(!v)return null;const d=new Date(String(v));return isNaN(d.getTime())?null:d;}
function ppCalendarDescription_(item){return [`actual_minutes=${Number(item.minutes)||0}`,`status=${item.status||'完成'}`,`format=${item.format||''}`,`source=${item.source||'Page & Pace'}`,`platform=${item.platform||''}`,`domain=${item.domain||''}`,`understanding=${item.understanding||''}`,`url=${item.url||''}`,`notes=${String(item.notes||'').replace(/\n/g,' / ')}`,'source_app=Page & Pace',`web_event_id=${item.event_id||''}`].join('\n');}
function ppCalendarTitle_(item){return ['後西醫','DONE',item.subject||'',item.activity||'',item.topic||''].join('｜');}
function ppUpsertCalendarEventForQuick_(item){
  const cal=ppDoneCalendar_(),webId=String(item.event_id||'').trim();if(!webId)throw new Error('missing web_event_id');let ev=null;
  if(item.calendar_event_id){try{ev=cal.getEventById(String(item.calendar_event_id))}catch(_e){}}
  if(!ev)ev=ppFindCalendarEventByWebId_(cal,webId,item.date);
  const tr=ppQuickDateRange_(item),title=ppCalendarTitle_(item),desc=ppCalendarDescription_(item);
  if(ev){ev.setTitle(title);ev.setTime(tr.start,tr.end);ev.setDescription(desc);}else ev=cal.createEvent(title,tr.start,tr.end,{description:desc});
  return ev;
}
function ppFindCalendarEventByWebId_(cal,webId,dateStr){
  if(!cal||!webId)return null;let center;if(dateStr){const p=String(dateStr).split('-').map(Number);center=new Date(p[0],p[1]-1,p[2],0,0,0,0);}else center=new Date();
  const from=new Date(center.getTime()-86400000),to=new Date(center.getTime()+2*86400000),needle='web_event_id='+webId,events=cal.getEvents(from,to);
  for(let i=0;i<events.length;i++)if(String(events[i].getDescription()||'').indexOf(needle)>=0)return events[i];return null;
}
function ppDeleteCalendarEventByWebId_(webId){const cal=ppDoneCalendar_(),row=ppFindObjectByKey_(PP_QUICK_SHEET,'event_id',webId);let ev=null;if(row&&row.calendar_event_id){try{ev=cal.getEventById(String(row.calendar_event_id))}catch(_e){}}if(!ev)ev=ppFindCalendarEventByWebId_(cal,webId,row&&row.date||'');if(!ev)return false;ev.deleteEvent();return true;}
function ppNormalize_(v){if(v===undefined||v===null)return'';if(typeof v==='boolean')return v;if(typeof v==='number'&&isFinite(v))return v;return String(v);}
function ppOutput_(obj,callback){const payload=JSON.stringify(obj),cb=String(callback||'');if(cb&&/^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+payload+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);}
function ppJson_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

/** Run once after pasting the patch if you want to create the two new tabs immediately. */
function setupPagePaceSheets(){ppEnsureNewSheets_();Logger.log('Page & Pace sheets ready');}
