const state={data:null,metrics:null,day:"all",person:"",timer:null,playing:false};
const $=selector=>document.querySelector(selector);
const esc=value=>(value??"").toString().replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const clean=value=>(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const shortName=name=>{const parts=name.split(/\s+/);return parts.length<2?name:`${parts[0]} ${parts.at(-1)[0]}.`};

async function init(){
  [state.data,state.metrics]=await Promise.all(["data/hyperrelations.json","data/productivity.json"].map(url=>fetch(url).then(response=>{if(!response.ok)throw new Error("dataset unavailable");return response.json()})));
  $("#coverage").textContent=state.data.report.coverage;
  $("#day").addEventListener("change",event=>{stop();state.day=event.target.value;render()});
  $("#person").addEventListener("input",event=>{state.person=event.target.value;render()});
  $("#play").addEventListener("click",()=>state.playing?stop():play());
  $("#reset").addEventListener("click",reset);
  $("#close").addEventListener("click",()=>$("#detail").close());
  $("#formula").addEventListener("click",openFormula);
  $("#purpose").addEventListener("click",openPurpose);
  $("#detail").addEventListener("click",event=>{if(event.target===$("#detail"))$("#detail").close()});
  render();
}

function visibleEvents(){
  const query=clean(state.person);
  return state.data.events.filter(event=>(state.day==="all"||event.day===state.day)&&(!query||clean(`${event.actor} ${event.counterpart}`).includes(query)));
}

function render(){
  const events=visibleEvents(),connected=new Set(events.flatMap(event=>[event.actor,event.counterpart])),query=clean(state.person);
  const people=state.data.people.filter(name=>!query||clean(name).includes(query)||connected.has(name));
  const pairs=new Map();events.forEach(event=>{const key=`${event.actor}\u0000${event.counterpart}`;(pairs.get(key)||pairs.set(key,[]).get(key)).push(event)});
  $("#activeDay").textContent=state.day==="2026-09-09"?"9/09 · paso 1/2":state.day==="2026-09-10"?"10/09 · paso 2/2":"Vista acumulada · 9 y 10/09";
  $("#stats").innerHTML=`<span><b>${events.length}</b> eventos</span><span><b>${pairs.size}</b> pares</span><span><b>${connected.size}</b> personas</span>`;
  const head=`<thead><tr><th>Actor ↓<br>Contraparte →</th>${people.map(name=>`<th title="${esc(name)}"><span>${esc(shortName(name))}</span></th>`).join("")}</tr></thead>`;
  const body=people.map(actor=>`<tr><th title="${esc(actor)}">${esc(shortName(actor))}</th>${people.map(counterpart=>{
    if(actor===counterpart)return "<td class='diagonal'>—</td>";
    const list=pairs.get(`${actor}\u0000${counterpart}`)||[];
    if(!list.length)return "<td class='empty'>—</td>";
    return `<td><button class="hit ${state.playing?"revealing":""}" type="button" data-actor="${esc(actor)}" data-counterpart="${esc(counterpart)}" aria-label="Ver ${list.length} interacciones de ${esc(actor)} hacia ${esc(counterpart)}"><b>${list.length}</b></button></td>`;
  }).join("")}</tr>`).join("");
  $("#matrix").innerHTML=head+`<tbody>${body}</tbody>`;
  $("#matrix").querySelectorAll(".hit").forEach(button=>button.addEventListener("click",()=>openDetail(button.dataset.actor,button.dataset.counterpart,pairs.get(`${button.dataset.actor}\u0000${button.dataset.counterpart}`)||[])));
  renderProductivity();
}

const normalized=(value,target,log=false)=>log?Math.min(1,Math.log1p(value)/Math.log1p(target)):Math.min(1,value/target);
function metricRows(){
  const days=state.day==="all"?Object.keys(state.metrics.days):[state.day];
  return state.data.people.map(person=>{
    const rows=days.map(day=>state.metrics.days[day].find(row=>row.person===person));
    const messages=rows.reduce((sum,row)=>sum+row.coverage.quality_messages,0);
    const qPoints=rows.reduce((sum,row)=>sum+(row.Q??0)*row.coverage.quality_messages,0);
    const events=state.data.events.filter(event=>days.includes(event.day)&&event.actor===person);
    return {person,I:events.length,H:rows.reduce((s,r)=>s+r.H,0),R:new Set(events.map(e=>e.counterpart)).size,Q:messages?qPoints/messages:null,E:rows.every(r=>r.E!==null)?rows.reduce((s,r)=>s+r.E,0):null,coverage:{comments:rows.reduce((s,r)=>s+r.coverage.comments,0),quality_messages:messages,timesheets:rows.reduce((s,r)=>s+r.coverage.timesheets,0),quality_complete:rows.every(r=>r.coverage.quality_complete),outcome_complete:rows.every(r=>r.coverage.outcome_complete)}};
  });
}
function score(row){
  const t=state.metrics.methodology.targets,w=state.metrics.methodology.weights;
  const values={I:normalized(row.I,t.I,true),H:normalized(row.H,t.H),R:normalized(row.R,t.R,true),Q:row.Q,E:normalized(row.E,t.E,true)};
  const available=Object.entries(values).filter(([,value])=>value!==null),weight=available.reduce((sum,[key])=>sum+w[key],0);
  return {value:Math.round(100*available.reduce((sum,[key,value])=>sum+w[key]*value,0)/weight),values,incomplete:row.Q===null||row.E===null||!row.coverage.quality_complete};
}
function renderProductivity(){
  const query=clean(state.person),rows=metricRows().filter(row=>!query||clean(row.person).includes(query)).map(row=>({...row,score:score(row)})).sort((a,b)=>b.score.value-a.score.value||a.person.localeCompare(b.person));
  renderCompanyTrace();
  $("#productivity").innerHTML=rows.map(row=>`<button class="person-metric" data-person="${esc(row.person)}" type="button"><span class="person-name">${esc(row.person)}</span><strong>${row.score.value}</strong><span class="vector">[${row.I}, ${row.H.toFixed(2)}, ${row.R}, ${row.Q===null?"s/d":Math.round(row.Q*100)}, ${row.E===null?"s/d":row.E}]</span>${row.score.incomplete?'<small>datos incompletos</small>':""}</button>`).join("");
  $("#productivity").querySelectorAll(".person-metric").forEach(button=>button.addEventListener("click",()=>openMetric(rows.find(row=>row.person===button.dataset.person))));
}
function companyMeasure(day){
  const previous=state.day;state.day=day;const rows=metricRows().map(row=>({...row,score:score(row)}));state.day=previous;
  const values=rows.map(row=>row.score.value).sort((a,b)=>a-b),complete=rows.filter(row=>!row.score.incomplete).length;
  return {mean:Math.round(values.reduce((sum,value)=>sum+value,0)/values.length),median:values[Math.floor(values.length/2)],complete,total:rows.length};
}
function renderCompanyTrace(){
  const points=["2026-09-09","2026-09-10","all"].map(day=>({day,...companyMeasure(day)}));
  const label=day=>day==="all"?"Acumulado":day==="2026-09-09"?"9/09":"10/09";
  $("#companyTrace").innerHTML=`<strong>Traza general de la compañía</strong>${points.map(point=>`<span class="${state.day===point.day?"active":""}"><b>${point.mean}</b><small>${label(point.day)} · mediana ${point.median} · cobertura completa ${point.complete}/${point.total}</small></span>`).join("")}`;
}
function openMetric(row){
  const t=state.metrics.methodology.targets;
  $("#detailTitle").textContent=`${row.person} · ICV ${row.score.value}`;
  const labels={I:"Interacciones",H:"Horas",R:"Contrapartes",Q:"Calidad documental",E:"Resultados"};
  $("#detailBody").innerHTML=`<p class="detail-count">Vector crudo <b>[${row.I}, ${row.H.toFixed(2)}, ${row.R}, ${row.Q===null?"s/d":Math.round(row.Q*100)}, ${row.E===null?"s/d":row.E}]</b></p><div class="metric-detail">${Object.entries(row.score.values).map(([key,value])=>`<div><span>${labels[key]}</span><b>${key}: ${value===null?"sin datos":key==="Q"?Math.round(value*100)+"/100":row[key]}</b><small>${value===null?"componente excluido":Math.round(value*100)+"% normalizado"}</small></div>`).join("")}</div><p><strong>Cobertura:</strong> ${row.coverage.comments} comentarios; ${row.coverage.quality_messages} evaluables; ${row.coverage.timesheets} partes de horas. ${row.score.incomplete?"El puntaje se recalculó solo con componentes disponibles; lotes y automatizaciones se excluyen.":"Cobertura completa para la rúbrica disponible."}</p><p class="method">Metas: I ${t.I}, H ${t.H} h, R ${t.R}, E ${t.E}. Los conteos usan saturación logarítmica.</p>`;
  $("#detail").showModal();
}
function openFormula(){
  const m=state.metrics.methodology;
  $("#detailTitle").textContent=m.name;
  $("#detailBody").innerHTML=`<p class="detail-count"><b>100 × (0,20·Iₙ + 0,20·Hₙ + 0,15·Rₙ + 0,25·Q + 0,20·Eₙ)</b></p><p><strong>I</strong>: interacciones salientes verificadas. <strong>H</strong>: horas laborales positivas. <strong>R</strong>: contrapartes únicas. <strong>Q</strong>: checklist de contexto, acción, referencia, resultado y próximo paso. <strong>E</strong>: creaciones y avances verificables.</p><p>Metas visibles: I=${m.targets.I}, H=${m.targets.H} h, R=${m.targets.R}, E=${m.targets.E}. I, R y E saturan logarítmicamente; H satura en la meta diaria. Si Q no es evaluable se excluye y los pesos restantes se reescalan.</p><p class="productivity-warning">${esc(m.warning)}</p>`;
  $("#detail").showModal();
}
function openPurpose(){
  $("#detailTitle").textContent="Propósito de Hiperrelaciones";
  $("#detailBody").innerHTML=`<p>Este espacio representa una <strong>matriz de interacciones verificables entre el personal de la compañía</strong>. Cada tarea, comentario, cambio, parte de horas o acción registrada se analiza, depura e integra para construir un mapa de cómo se conecta el trabajo.</p><p>Las filas muestran quién realizó la interacción y las columnas, la contraparte. Solo se incorporan relaciones con evidencia: menciones directas, respuestas, cambios rastreados de responsables o compromisos explícitos. Compartir un proyecto o estar asignado no alcanza.</p><h3>Vector de contribución verificable</h3><div class="purpose-vars"><p><b>I · Interacciones</b><br>Acciones humanas salientes, verificadas y deduplicadas.</p><p><b>H · Horas</b><br>Horas laborales positivas registradas para la persona, distinguiendo quién cargó el parte.</p><p><b>R · Red</b><br>Cantidad de contrapartes únicas con interacción comprobada.</p><p><b>Q · Calidad documental</b><br>Checklist objetivo: contexto, acción, referencia, resultado y próximo paso.</p><p><b>E · Resultados</b><br>Creaciones y avances verificables hacia validación, resolución o producción.</p></div><p>El <strong>ICV</strong> permite comparar órdenes de magnitud, no personas en términos absolutos. La traza general muestra promedio, mediana y cobertura por día y acumulada para seguir la evolución de la compañía.</p><p class="productivity-warning">No es una evaluación laboral. Solo refleja actividad observable en las fuentes consultadas; una ausencia de registro no significa ausencia de trabajo.</p>`;
  $("#detail").showModal();
}

function openDetail(actor,counterpart,events){
  $("#detailTitle").textContent=`${actor} → ${counterpart}`;
  $("#detailBody").innerHTML=`<p class="detail-count"><b>${events.length}</b> ${events.length===1?"actividad":"actividades"}</p>${[...events].sort((a,b)=>`${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`)).map(event=>`<article><div><time>${esc(event.day.split("-").reverse().join("/"))} · ${esc(event.time)}</time><span>${esc(event.type.replaceAll("_"," "))}</span></div><h3>${esc(event.reference)} · ${esc(event.title)}</h3><p>${esc(event.evidence)}</p><footer>${esc(event.source)}${event.message_id?` · mensaje ${esc(event.message_id)}`:""}</footer></article>`).join("")}`;
  $("#detail").showModal();
}

function stop(){
  if(state.timer)clearTimeout(state.timer);state.timer=null;state.playing=false;
  $("#play").textContent="▶ Reproducir evolución";$("#play").setAttribute("aria-pressed","false");
}
function reset(){stop();state.day="all";state.person="";$("#day").value="all";$("#person").value="";render()}
function play(){
  stop();state.playing=true;$("#play").textContent="■ Pausar";$("#play").setAttribute("aria-pressed","true");
  const days=[...new Set(state.data.events.map(event=>event.day))].sort();let index=0;
  const advance=()=>{state.day=days[index];$("#day").value=state.day;render();index+=1;if(index<days.length)state.timer=setTimeout(advance,Number($("#speed").value));else state.timer=setTimeout(stop,Number($("#speed").value))};advance();
}

init().catch(()=>{$("#matrix").innerHTML="<tbody><tr><td class='load-error'>No se pudo cargar la matriz.</td></tr></tbody>"});
