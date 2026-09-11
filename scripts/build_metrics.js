#!/usr/bin/env node
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const source=process.env.HIPER_ODOO_SOURCE||path.resolve(root,"../HIPERRELACIONES_ODOO_2026_09_10_11.json");
const gitSource=path.join(root,"data/git_activity.json");
const odoo=JSON.parse(fs.readFileSync(source,"utf8"));
const git=fs.existsSync(gitSource)?JSON.parse(fs.readFileSync(gitSource,"utf8")):{commits:[],coverage:{status:"incomplete"}};
const previousGraph=JSON.parse(fs.readFileSync(path.join(root,"data/hyperrelations.json"),"utf8"));
const previousMetrics=JSON.parse(fs.readFileSync(path.join(root,"data/productivity.json"),"utf8"));
const previousRecords=JSON.parse(fs.readFileSync(path.join(root,"data/records.json"),"utf8"));
const people=odoo.roster.map(item=>item.name);
const refreshedDays=new Set(odoo.report.complete_days.concat(odoo.report.partial_days));
const dayLabel=day=>day.split("-").slice(1).reverse().join("/");

const oldEvents=previousGraph.events.filter(item=>!refreshedDays.has(item.day));
const newEvents=odoo.interactions.map(item=>({
  day:item.day,time:item.time,actor:item.actor,counterpart:item.counterpart,type:item.type,
  source:`Odoo · ${item.model==="project.task"?"Tareas":"Tickets"}`,
  reference:`${item.model==="project.task"?"T":"TK"}#${item.res_id}`,
  title:item.title,evidence:item.evidence,message_id:item.message_id??null,tracking_id:item.tracking_id??null,
}));
const events=[...oldEvents,...newEvents].sort((a,b)=>`${a.day} ${a.time} ${a.actor}`.localeCompare(`${b.day} ${b.time} ${b.actor}`));
const eventKeys=events.map(item=>[item.day,item.time,item.actor,item.counterpart,item.type,item.reference,item.message_id,item.tracking_id].join("|"));
if(new Set(eventKeys).size!==eventKeys.length)throw new Error("duplicate directed interactions");

const complete=odoo.report.complete_days.map(day=>`${dayLabel(day)} completo`);
const partial=odoo.report.partial_days.map(day=>`${dayLabel(day)} hasta ${odoo.report.end_local_exclusive.slice(11)} Argentina`);
const graph={
  report:{title:"HiperNrelaciones",period_start:`${events[0]?.day||odoo.report.start_local.slice(0,10)} 00:00:00 America/Argentina/Cordoba`,period_end:`${odoo.report.end_local_exclusive} America/Argentina/Cordoba`,query_end_utc:odoo.report.end_utc_exclusive,coverage:[oldEvents.length?`${dayLabel(oldEvents[0].day)} histórico conservado`:null,...complete,...partial,"Odoo + Git + Daily Meetings"].filter(Boolean).join(" · "),method:"Solo menciones resolubles, respuestas directas, cambios rastreados de responsables y compromisos individuales explícitos."},
  people,events,
};

const goal=/^(?:Hecho|Resuelto|Aprobado|Validaci[oó]n funcional|Verificaci[oó]n del cliente|Implementado en producci[oó]n|Implementado en staging|Pre-producci[oó]n)$/i;
const creationBatchCounts=new Map();
odoo.creations.forEach(item=>{const key=`${item.day}|${item.time}|${item.creator}`;creationBatchCounts.set(key,(creationBatchCounts.get(key)||0)+1)});
const isBatchCreation=item=>(creationBatchCounts.get(`${item.day}|${item.time}|${item.creator}`)||0)>=10;
const metrics={
  methodology:previousMetrics.methodology,
  sources:{odoo:[path.basename(source)],daily:"jinzo-work-log/dm/dm-desa (10 y 11/09 ausentes)",git_in_outcomes:git.coverage?.status==="complete",git:git.coverage,cutoff_local:`${odoo.report.end_local_exclusive} America/Argentina/Cordoba`,complete_days:odoo.report.complete_days,partial_days:odoo.report.partial_days},
  days:Object.fromEntries(Object.entries(previousMetrics.days).filter(([day])=>!refreshedDays.has(day))),
};
for(const day of refreshedDays){
  metrics.days[day]=people.map(person=>{
    const outgoing=newEvents.filter(item=>item.day===day&&item.actor===person);
    const comments=odoo.comments.filter(item=>item.day===day&&item.author===person);
    const sheets=odoo.timesheets.filter(item=>item.day===day&&item.employee===person&&item.hours>0);
    const allCreations=odoo.creations.filter(item=>item.day===day&&item.creator===person);
    const creations=allCreations.filter(item=>!isBatchCreation(item)&&person!=="Jinzo");
    const transitions=odoo.tracking.filter(item=>item.day===day&&item.actor===person&&person!=="Jinzo"&&goal.test(item.new||""));
    const commits=git.commits.filter(item=>item.day===day&&item.person===person&&item.outcome_eligible);
    const outcomes=new Set([...creations.map(item=>`create:${item.model}:${item.res_id}`),...transitions.map(item=>`state:${item.model}:${item.res_id}:${item.new}`),...commits.map(item=>`git:${item.sha}`)]);
    const q=comments.length?comments.reduce((sum,item)=>sum+item.quality_ratio,0)/comments.length:null;
    const own=sheets.filter(item=>item.classification==="own_entry").reduce((sum,item)=>sum+item.hours,0);
    const third=sheets.filter(item=>item.classification==="third_party_entry").reduce((sum,item)=>sum+item.hours,0);
    return {person,I:outgoing.length,H:sheets.reduce((sum,item)=>sum+item.hours,0),R:new Set(outgoing.map(item=>item.counterpart)).size,Q:q,E:outcomes.size,coverage:{comments:comments.length,quality_messages:comments.length,timesheets:sheets.length,own_entry_hours:own,third_party_entry_hours:third,creations:creations.length,batch_creations:allCreations.length-creations.length,tracked:odoo.tracking.filter(item=>item.day===day&&item.actor===person).length,git_commits:commits.length,quality_complete:true,hours_attribution_complete:true,outcome_complete:true,git_complete:git.coverage?.status==="complete",outcome_note:"E integra creaciones no masivas, avances sustantivos y commits Git verificables; merges, lotes y automatizaciones no suman."},quality_checks:comments.map(item=>item.quality_flags)};
  });
}

const oldRecords=previousRecords.records.filter(item=>!refreshedDays.has(item.day));
const comments=odoo.comments.map(item=>({kind:"comment",day:item.day,person:item.author,id:`M${item.message_id}`,message_id:item.message_id,date_utc:item.date_utc,source:"Odoo",model:item.model,res_id:item.res_id,title:item.title,text:item.text_sanitized,quality:item.quality_ratio,quality_flags:item.quality_flags,counterparts:[...new Set(newEvents.filter(event=>event.message_id===item.message_id).map(event=>event.counterpart))]}));
const timesheets=odoo.timesheets.map(item=>({kind:"timesheet",day:item.day,person:item.employee,id:`H${item.line_id}`,date_utc:item.create_date_utc,work_date:item.day,source:"Odoo",model:"account.analytic.line",res_id:item.line_id,work_model:item.task_id?"project.task":null,work_res_id:item.task_id||null,title:item.task||"Sin tarea vinculada",text:item.description_sanitized,hours:item.hours,project:item.project,entry_class:item.classification,created_by:item.create_user,modified_by:item.write_user,modified_after_creation:item.modified_after_creation,correction_status:item.correction_status}));
const tracking=odoo.tracking.map(item=>({kind:"activity",day:item.day,person:item.actor,id:`T${item.tracking_id}`,tracking_id:item.tracking_id,message_id:item.message_id,date_utc:item.date_utc,source:"Odoo",model:item.model,res_id:item.res_id,title:item.title,text:`${item.field}: ${item.old||"∅"} → ${item.new||"∅"}`,old:item.old,new:item.new,field:item.field,activity_types:["tracking"],counterparts:[...new Set(newEvents.filter(event=>event.tracking_id===item.tracking_id||event.message_id===item.message_id).map(event=>event.counterpart))]}));
const creations=odoo.creations.map(item=>({kind:"activity",day:item.day,person:item.creator,id:`C${item.model}:${item.res_id}`,date_utc:item.date_utc,source:"Odoo",model:item.model,res_id:item.res_id,title:item.title,text:isBatchCreation(item)?"Creación dentro de un lote masivo; visible como registro, excluida de E":"Creación del registro",activity_types:["creation"],batch:isBatchCreation(item),outcome_eligible:!isBatchCreation(item)}));
const interactionMap=new Map();
newEvents.forEach((item,index)=>{
  const key=item.message_id?`M${item.message_id}`:item.tracking_id?`T${item.tracking_id}`:`I${item.day}-${index}`;
  if(!interactionMap.has(key))interactionMap.set(key,{kind:"interaction",day:item.day,person:item.actor,id:`I${key}`,message_id:item.message_id,tracking_id:item.tracking_id,date_utc:null,source:item.source,model:item.reference.startsWith("TK#")?"helpdesk.ticket":item.reference.startsWith("T#")?"project.task":null,res_id:+item.reference.split("#")[1]||null,title:item.title,text:item.evidence,reference:item.reference,interaction_types:[],counterparts:[],is_derived:true});
  const record=interactionMap.get(key);record.interaction_types.push(item.type);record.counterparts.push(item.counterpart);
});
for(const record of interactionMap.values()){record.interaction_types=[...new Set(record.interaction_types)];record.counterparts=[...new Set(record.counterparts)];}
const gitRecords=git.commits.filter(item=>item.person).map(item=>({kind:"commit",day:item.day,person:item.person,id:item.sha.slice(0,12),sha:item.sha,date_utc:item.date_utc,source:"GitHub",model:item.repo,res_id:null,title:item.subject,text:item.body||item.subject,reference:item.url,files:item.files,commit_class:item.classification,coverage:item.identity_evidence}));
const records={report:{...odoo.report,roster_scope:"Todos los res.users activos, share=false",git_coverage:git.coverage,daily_coverage:{"2026-09-10":"archivo ausente","2026-09-11":"archivo ausente"}},people,records:[...oldRecords,...comments,...timesheets,...tracking,...creations,...interactionMap.values(),...gitRecords]};
const stable=record=>`${record.kind}|${record.id}|${record.day}|${record.person}|${record.text||""}`;
const recordKeys=records.records.map(stable);
if(new Set(recordKeys).size!==recordKeys.length){const seen=new Set();throw new Error(`duplicate records: ${recordKeys.filter(key=>seen.has(key)||!seen.add(key)).join(", ")}`)}

fs.writeFileSync(path.join(root,"data/hyperrelations.json"),JSON.stringify(graph,null,2)+"\n");
fs.writeFileSync(path.join(root,"data/productivity.json"),JSON.stringify(metrics,null,2)+"\n");
fs.writeFileSync(path.join(root,"data/records.json"),JSON.stringify(records,null,2)+"\n");

const trackingBatchKey=new Map();
const trackingCandidates=records.records.filter(record=>record.kind==="activity"&&record.activity_types?.includes("tracking")&&record.date_utc&&record.field);
const trackingFamilies=new Map();
trackingCandidates.forEach(record=>{const key=[record.day,record.person,record.model,record.field,record.old||"",record.new||""].join("|");(trackingFamilies.get(key)||trackingFamilies.set(key,[]).get(key)).push(record)});
for(const [family,list] of trackingFamilies){
  const sorted=[...list].sort((a,b)=>a.date_utc.localeCompare(b.date_utc));let cluster=[];
  const flush=()=>{if(new Set(cluster.map(item=>item.res_id)).size>=3){const key=`tracking-batch|${family}|${cluster[0].date_utc}`;cluster.forEach(item=>trackingBatchKey.set(item.id,key))}cluster=[]};
  sorted.forEach(record=>{if(cluster.length&&(new Date(record.date_utc.replace(" ","T")+"Z")-new Date(cluster.at(-1).date_utc.replace(" ","T")+"Z"))/1000>90)flush();cluster.push(record)});flush();
}

function workTarget(record){
  if(record.batch)return {key:`batch|${record.day}|${record.person}|${record.date_utc}|${record.model}|creation`,model:record.model,res_id:null,batch:true};
  if(trackingBatchKey.has(record.id))return {key:trackingBatchKey.get(record.id),model:record.model,res_id:null,batch:true,tracking_batch:true};
  if(record.work_model&&record.work_res_id)return {key:`work|${record.day}|${record.person}|${record.work_model}|${record.work_res_id}`,model:record.work_model,res_id:record.work_res_id};
  if(record.model&&record.res_id&&["project.task","helpdesk.ticket"].includes(record.model))return {key:`work|${record.day}|${record.person}|${record.model}|${record.res_id}`,model:record.model,res_id:record.res_id};
  const ref=(record.reference||"").match(/^(TK|T)#(\d+)$/);
  if(ref)return {key:`work|${record.day}|${record.person}|${ref[1]==="TK"?"helpdesk.ticket":"project.task"}|${ref[2]}`,model:ref[1]==="TK"?"helpdesk.ticket":"project.task",res_id:+ref[2]};
  return {key:`single|${record.day}|${record.source}|${record.kind}|${record.id}`,model:record.model||null,res_id:record.res_id||null};
}
const unitMap=new Map();
records.records.forEach(record=>{
  const target=workTarget(record);
  if(!unitMap.has(target.key))unitMap.set(target.key,{key:target.key,day:record.day,person:record.person,model:target.model,res_id:target.res_id,batch:!!target.batch,tracking_batch:!!target.tracking_batch,title:record.title,sources:[],kinds:[],counterparts:[],subevents:[]});
  const unit=unitMap.get(target.key),subevent={...record};
  if(subevent.kind==="interaction"&&!String(subevent.source).startsWith("Daily")){subevent.is_derived=true;if(!String(subevent.id).startsWith("I"))subevent.display_id=`I${subevent.id}`}
  unit.sources.push(subevent.source);unit.kinds.push(subevent.kind);unit.counterparts.push(...(subevent.counterparts||[]));unit.subevents.push(subevent);
});
const workUnits=[...unitMap.values()].map(unit=>{
  unit.sources=[...new Set(unit.sources.map(source=>source.startsWith("Odoo")?"Odoo":source.startsWith("Git")?"GitHub":"Daily"))];
  unit.kinds=[...new Set(unit.kinds)];unit.counterparts=[...new Set(unit.counterparts)];
  unit.subevents.sort((a,b)=>String(a.date_utc||a.day).localeCompare(String(b.date_utc||b.day)));
  unit.source_event_count=unit.subevents.filter(item=>!item.is_derived).length;
  unit.derived_event_count=unit.subevents.filter(item=>item.is_derived).length;
  unit.record_count=unit.subevents.length;
  unit.date_utc=unit.subevents.find(item=>item.date_utc)?.date_utc||null;
  unit.hours=unit.subevents.filter(item=>item.kind==="timesheet").reduce((sum,item)=>sum+(item.hours||0),0);
  if(unit.batch){unit.batch_ids=unit.subevents.map(item=>item.res_id);unit.title=unit.tracking_batch?`Lote de ${new Set(unit.batch_ids).size} tareas con el mismo cambio`:`Lote de ${unit.source_event_count} tareas creadas`}
  return unit;
}).sort((a,b)=>`${a.day} ${a.person} ${a.date_utc||""}`.localeCompare(`${b.day} ${b.person} ${b.date_utc||""}`));
const units={report:{...records.report,source_record_count:records.records.length,work_unit_count:workUnits.length,method:"Vista derivada; conserva cada registro fuente dentro de subevents."},people,work_units:workUnits};
fs.writeFileSync(path.join(root,"data/work_units.json"),JSON.stringify(units,null,2)+"\n");
console.log(JSON.stringify({people:people.length,events:events.length,records:records.records.length,work_units:workUnits.length,days:Object.keys(metrics.days),git_commits:gitRecords.length},null,2));
