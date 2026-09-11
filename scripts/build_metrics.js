#!/usr/bin/env node
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const sources={
  "2026-09-09":path.resolve(root,"../../.scratch/METRICAS_BASE_2026_09_09.md"),
  "2026-09-10":path.resolve(root,"../../.scratch/METRICAS_BASE_2026_09_10.md"),
};
const graph=JSON.parse(fs.readFileSync(path.join(root,"data/hyperrelations.json"),"utf8"));
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
    const uniqueMessages=[...new Map(outgoing.filter(event=>event.message_id).map(event=>[event.message_id,event])).values()];
    const checks=uniqueMessages.map(checklist);
    const quality=checks.length?checks.reduce((sum,item)=>sum+Object.values(item).filter(Boolean).length,0)/(checks.length*5):null;
    const outcomes=new Set();
    if(base.creations) [...section.matchAll(/`(?:project\.task|helpdesk\.ticket)` #(\d+).*?creaci[oó]n/gi)].forEach(match=>outcomes.add(`create:${match[1]}`));
    [...section.matchAll(/`(?:project\.task|helpdesk\.ticket)` #(\d+)[^\n]*/g)].forEach(match=>{if(goal.test(match[0]))outcomes.add(`state:${match[1]}`);goal.lastIndex=0});
    const outcomeComplete=base.tracked<=30;
    return {person,I:outgoing.length,H:base.hours,R:new Set(outgoing.map(event=>event.counterpart)).size,Q:quality,E:outcomeComplete?outcomes.size:null,coverage:{comments:base.comments,quality_messages:checks.length,timesheets:base.timesheets,creations:base.creations,tracked:base.tracked,quality_complete:base.comments===checks.length,hours_attribution_complete:false,hours_note:"El total usa fecha laboral, pero este corte no expone separación carga propia/terceros.",outcome_complete:outcomeComplete,git_complete:false,outcome_note:outcomeComplete?"E no incorpora entregables Git en este corte.":"Cambios concentrados compatibles con lote/automatización; E excluido."},quality_checks:checks};
  });
}
fs.writeFileSync(path.join(root,"data/productivity.json"),JSON.stringify(output,null,2)+"\n");
