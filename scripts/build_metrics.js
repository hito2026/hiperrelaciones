#!/usr/bin/env node
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const sources={
  "2026-09-09":path.resolve(root,"../../.scratch/METRICAS_BASE_2026_09_09.md"),
  "2026-09-10":path.resolve(root,"../../.scratch/METRICAS_BASE_2026_09_10.md"),
};
const graph=JSON.parse(fs.readFileSync(path.join(root,"data/hyperrelations.json"),"utf8"));
const coverage=JSON.parse(fs.readFileSync(path.resolve(root,"../../.scratch/INDICATOR_COVERAGE_2026_09_09_10.json"),"utf8"));
const people=graph.people;

function sections(markdown){
  const result=new Map();
  const matches=[...markdown.matchAll(/^## (.+)$/gm)];
  matches.forEach((match,index)=>result.set(match[1],markdown.slice(match.index,(matches[index+1]||{index:markdown.length}).index)));
  return result;
}
function summary(section){
  const match=section.match(/Creaciones: \*\*(\d+)\*\*; comentarios: \*\*(\d+)\*\*; cambios rastreados: \*\*(\d+)\*\*; partes de horas: \*\*(\d+)\*\* \(([\d.]+) h\)/);
  return match?{creations:+match[1],comments:+match[2],tracked:+match[3],timesheets:+match[4],hours:+match[5]}:{creations:0,comments:0,tracked:0,timesheets:0,hours:0};
}
function checklist(event){
  const text=`${event.title||""} ${event.evidence||""}`;
  return {
    context:text.length>=45,
    action:/\b(cre|creó|creado|agreg|quit|activ|implement|corrig|revis|inform|envi|explic|configur|resolv|cambi)/i.test(text),
    reference:/(https?:|\brepo\b|\brama\b|\bm[oó]dulo\b|#[0-9]+|\bTK\b)/i.test(text),
    result:/\b(producci[oó]n|staging|stg|resuelt|hecho|implementad|validaci[oó]n|verificaci[oó]n|entreg)/i.test(text),
    next:/(@\w|validar|revisar|pr[oó]ximo|pendiente|responsable|cuando|podr[ií]a)/i.test(text),
  };
}
const goal=/→\s*(?:Hecho|Resuelto|Aprobado|Validaci[oó]n funcional|Verificaci[oó]n del cliente|Implementado en producci[oó]n|Implementado en staging|Pre-producci[oó]n)/gi;
const output={
  methodology:{name:"Índice de Contribución Verificable",vector:["I","H","R","Q","E"],weights:{I:.20,H:.20,R:.15,Q:.25,E:.20},targets:{I:8,H:8,R:5,E:5},warning:"Indicador operativo de actividad observable; no es una evaluación laboral. La ausencia de registro no equivale a ausencia de trabajo."},
  sources:{odoo:["METRICAS_BASE_2026_09_09.md","METRICAS_BASE_2026_09_10.md","INTERACCIONES_ODOO_2026_09_09_10.json"],daily:"DM-2026-09-09.md",git_in_outcomes:false,cutoff_local:"2026-09-10 17:44:18 America/Argentina/Cordoba",day_10_partial:true},
  days:{},
};
for(const [day,file] of Object.entries(sources)){
  const byPerson=sections(fs.readFileSync(file,"utf8"));
  output.days[day]=people.map(person=>{
    const section=byPerson.get(person)||"",base=summary(section);
    const outgoing=graph.events.filter(event=>event.day===day&&event.actor===person);
    const verified=coverage.metrics_by_person_day.find(row=>row.day===day&&row.person===person);
    const comments=coverage.comments.filter(item=>item.day===day&&item.author===person);
    const checks=comments.map(item=>item.quality_flags);
    const quality=verified.quality_average;
    const outcomes=new Set();
    if(base.creations) [...section.matchAll(/`(?:project\.task|helpdesk\.ticket)` #(\d+).*?creaci[oó]n/gi)].forEach(match=>outcomes.add(`create:${match[1]}`));
    [...section.matchAll(/`(?:project\.task|helpdesk\.ticket)` #(\d+)[^\n]*/g)].forEach(match=>{if(goal.test(match[0]))outcomes.add(`state:${match[1]}`);goal.lastIndex=0});
    const outcomeComplete=base.tracked<=30;
    return {person,I:outgoing.length,H:verified.positive_hours,R:new Set(outgoing.map(event=>event.counterpart)).size,Q:quality,E:outcomeComplete?outcomes.size:null,coverage:{comments:verified.unique_human_comments,quality_messages:verified.quality_messages,timesheets:verified.timesheet_line_ids.length,own_entry_hours:verified.own_entry_hours,third_party_entry_hours:verified.third_party_entry_hours,creations:base.creations,tracked:base.tracked,quality_complete:verified.unique_human_comments===verified.quality_messages,hours_attribution_complete:true,outcome_complete:outcomeComplete,git_complete:false,outcome_note:outcomeComplete?"E no incorpora entregables Git en este corte.":"Cambios concentrados compatibles con lote/automatización; E excluido."},quality_checks:checks};
  });
}
fs.writeFileSync(path.join(root,"data/productivity.json"),JSON.stringify(output,null,2)+"\n");
const activity=[];
for(const [day,file] of Object.entries(sources)){
  for(const [person,section] of sections(fs.readFileSync(file,"utf8"))){
    if(!people.includes(person))continue;
    for(const match of section.matchAll(/^- `(project\.task|helpdesk\.ticket)` #(\d+) — ([^\n]+)$/gm)){
      const line=match[3];if(!/cambio de campo|creaci[oó]n/i.test(line))continue;
      const split=line.split(" — ");activity.push({kind:"activity",day,person,id:`A${day}-${match[1]}-${match[2]}`,date_utc:null,model:match[1],res_id:+match[2],title:split[0],text:split.slice(1).join(" — "),activity_types:[/creaci[oó]n/i.test(line)?"creation":null,/cambio de campo/i.test(line)?"tracking":null].filter(Boolean)});
    }
  }
}
const interactionMap=new Map();
graph.events.forEach((item,index)=>{
  const key=item.message_id?`M${item.message_id}`:`I${index+1}`;
  if(!interactionMap.has(key))interactionMap.set(key,{kind:"interaction",day:item.day,person:item.actor,id:key,date_utc:null,source:item.source,title:item.title,text:item.evidence,reference:item.reference,interaction_types:[],counterparts:[]});
  const record=interactionMap.get(key);record.interaction_types.push(item.type);record.counterparts.push(item.counterpart);
});
for(const record of interactionMap.values()){record.interaction_types=[...new Set(record.interaction_types)];record.counterparts=[...new Set(record.counterparts)];}
const records={report:{...coverage.report,roster_scope:coverage.roster_scope,git_covered:false,day_10_partial:true},people,records:[
  ...coverage.comments.map(item=>({kind:"comment",day:item.day,person:item.author,id:`M${item.message_id}`,date_utc:item.date_utc,source:"Odoo",model:item.model,res_id:item.res_id,title:item.title,text:item.text_sanitized,quality:item.quality_ratio})),
  ...coverage.timesheets.map(item=>({kind:"timesheet",day:item.day,person:item.employee,id:`H${item.line_id}`,date_utc:item.create_date_utc,source:"Odoo",model:"account.analytic.line",res_id:item.line_id,title:item.task||"Sin tarea vinculada",text:item.description_sanitized,hours:item.hours,project:item.project,entry_class:item.classification,created_by:item.create_user,modified_by:item.write_user,modified_after_creation:item.modified_after_creation,correction_status:item.correction_status})),
  ...activity.map(item=>({...item,source:"Odoo"})),...interactionMap.values()
]};
fs.writeFileSync(path.join(root,"data/records.json"),JSON.stringify(records,null,2)+"\n");
