#!/usr/bin/env node
const fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const start="2026-09-15T03:00:00Z",end="2026-09-22T10:56:15Z";
const repos=[
  ["wsf/hito-devman","/Users/asartorio/.buzz/REPOS/hito-devman-ico-19"],
  ["hito2026/agentes-creados","/Users/asartorio/.buzz/.scratch/git-audit-20260911/agentes-creados"],
  ["hito2026/jinzo-plataforma","/Users/asartorio/.buzz/.scratch/git-audit-20260911/jinzo-plataforma"],
  ["hito2026/odoo-argentina-ee","/Users/asartorio/.buzz/.scratch/git-audit-20260911/odoo-argentina-ee"],
  ["hito2026/cerebro-hito","/Users/asartorio/.buzz/REPOS/cerebro-hito"],
  ["hito2026/jinzo-work-log","/Users/asartorio/.buzz/REPOS/jinzo-work-log"],
  ["hito2026/cl-cadenasmetalplas19","/Users/asartorio/.buzz/REPOS/cl-cadenasmetalplas19"],
  ["hito2026/cl-equipa19","/Users/asartorio/.buzz/REPOS/cl-equipa19"],
  ["hito2026/cl-equipavic","/Users/asartorio/.buzz/REPOS/cl-equipavic"],
  ["hito2026/documentation","/Users/asartorio/.buzz/REPOS/documentation"],
  ["hito2026/hito-gemelos-ia","/Users/asartorio/.buzz/REPOS/hito-gemelos-ia"],
  ["hito2026/milemor23","/Users/asartorio/.buzz/REPOS/milemor23-stg270726"],
  ["hito2026/odoo_tienda_nube","/Users/asartorio/.buzz/REPOS/jdm2/hito2026/odoo_tienda_nube"],
  ["hito2026/hiperrelaciones",root],
  ["hito2026/midleware-bridge-kapso-openclaw","/Users/asartorio/.buzz/REPOS/midleware-bridge-kapso-openclaw"],
  ["hito2026/bridge-kapso-openclaw","/Users/asartorio/.buzz/REPOS/bridge-kapso-openclaw"],
  ["hito2026/cognee_brain_openclaw","/Users/asartorio/.buzz/REPOS/cognee_brain_openclaw"],
  ["hito2026/jinzo_architect","/Users/asartorio/.buzz/REPOS/jinzo_architect"],
  ["hito2026/api_open_whatsapp_connector","/Users/asartorio/.buzz/REPOS/api_open_whatsapp_connector"],
  ["hito2026/open_whatsapp_connector","/Users/asartorio/.buzz/REPOS/open_whatsapp_connector"],
];
const identities=[
  [/^genagarcia094@gmail\.com$/i,"Genaro García","correo Git histórico verificado"],
  [/^(matiasmarziali96@gmail\.com|104801558\+marziali@users\.noreply\.github\.com)$/i,"Matias Marziali","correo Git histórico verificado"],
  [/^(nelartz01@gmail\.com|105108482\+NelsonTontarelli@users\.noreply\.github\.com)$/i,"Nelson Tontarelli","correo Git histórico verificado"],
  [/^pmarchionno@gmail\.com$/i,"Pablo Marchionno","correo Git histórico verificado"],
  [/^banegamatias@gmail\.com$/i,"Matias Banega","nombre y correo Git coincidentes"],
];
const run=(cwd,args)=>cp.execFileSync("git",args,{cwd,encoding:"utf8"}).trim();
const commits=[],excluded=[];
for(const [repo,cwd] of repos){
  const refs=run(cwd,["for-each-ref","--format=%(refname)","refs/remotes/origin"]).split("\n").filter(ref=>ref&&!ref.endsWith("/HEAD"));
  if(!refs.length)continue;
  const lines=run(cwd,["log",...refs,"--since",start,"--until",end,"--format=%H%x1f%aI%x1f%cI%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%P%x1f%s%x1f%b%x1e"]);
  for(const raw of lines.split("\x1e").map(value=>value.trim()).filter(Boolean)){
    const [sha,authorDate,commitDate,authorName,authorEmail,committerName,committerEmail,parents,subject,body]=raw.split("\x1f");
    if(commits.some(item=>item.sha===sha)||excluded.some(item=>item.sha===sha))continue;
    const identity=identities.find(([regex])=>regex.test(authorEmail));
    const entry={repo,sha,date_utc:new Date(authorDate).toISOString().replace("T"," ").replace(".000Z",""),day:new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Cordoba"}).format(new Date(authorDate)),author:{name:authorName,email:authorEmail},committer:{name:committerName,email:committerEmail},subject,body:body||"",parents:parents.split(" ").filter(Boolean),classification:parents.split(" ").filter(Boolean).length>1?"merge":"change",url:`https://github.com/${repo}/commit/${sha}`};
    entry.files=run(cwd,["diff-tree","--no-commit-id","--name-only","-r",sha]).split("\n").filter(Boolean).slice(0,30);
    if(identity){entry.person=identity[1];entry.identity_evidence=identity[2];entry.outcome_eligible=entry.classification==="change";commits.push(entry)}
    else excluded.push({...entry,reason:/^(jinzo|cerebro|wsf)$/i.test(authorName)?"cuenta técnica o gateway sin atribución humana":"identidad no mapeada a la nómina"});
  }
}
const output={report:{start_utc_inclusive:start,end_utc_exclusive:end,timezone:"America/Argentina/Cordoba"},coverage:{status:"complete",scope:"Todas las refs origin accesibles de los clones HitoFusion/WSF configurados. La API publica de hito2026 se enumero al corte; penclaw_hito_agent_template_v2, onlyoffice_odoo, hito-gemelos-ia, account-financial-tools y documentation no tuvieron pushes dentro de la ventana.",explicit_repositories:repos.map(([repo])=>repo)},commits:commits.sort((a,b)=>a.date_utc.localeCompare(b.date_utc)),excluded};
fs.writeFileSync(path.join(root,"data/git_activity.json"),JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({verified:commits.length,outcome_eligible:commits.filter(item=>item.outcome_eligible).length,excluded:excluded.length},null,2));
