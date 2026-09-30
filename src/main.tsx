import React, {useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import Papa from "papaparse";
import "./styles.css";

type Row = Record<string, string>;
type Severity = "error" | "warning" | "recommendation" | "pass";
type Check = {severity: Severity; title: string; detail: string};

const demoCommunity = `SampleID,Pocillopora,Porites,Macroalgae,Sponge
S01,12,4,8,1
S02,10,6,7,0
S03,3,15,2,2
S04,4,13,3,1
S05,18,2,5,0
S06,16,3,6,1`;

const demoMetadata = `SampleID,Site,Season,Method
S01,La Entrega,Dry,BRUVS
S02,La Entrega,Dry,BRUVS
S03,San Agustin,Rainy,UVC
S04,San Agustin,Rainy,UVC
S05,La Entrega,Rainy,UVC
S06,La Entrega,Rainy,UVC`;

const problemCommunity = `SampleID,Pocillopora,Porites,RareTaxon
S01,12,4,0
S02,0,0,0
S03,3,,1
S03,4,13,0
S05,-2,2,0`;

const problemMetadata = `SampleID,Site,Season
S01,A,Dry
S02,A,Dry
S03,B,Rainy
S04,B,Rainy`;

function parseCSV(text:string): Row[] {
  return Papa.parse<Row>(text.trim(), {header:true, skipEmptyLines:true}).data;
}
function isMissing(v:any){ return v === undefined || v === null || String(v).trim()===""; }
function numeric(v:any){ const n=Number(v); return !isMissing(v) && Number.isFinite(n); }

function scientificChecks(comm:Row[], meta:Row[]): Check[] {
  const out:Check[]=[];
  if(!comm.length){ return [{severity:"error",title:"Community matrix missing",detail:"Load a community matrix before analysis."}];}
  const ccols=Object.keys(comm[0]);
  if(!ccols.includes("SampleID")) out.push({severity:"error",title:"SampleID missing",detail:"Community data require a SampleID column."});
  const taxa=ccols.filter(x=>x!=="SampleID");
  if(!taxa.length) out.push({severity:"error",title:"No taxa columns",detail:"At least one taxon/response column is required."});

  const ids=comm.map(r=>r.SampleID).filter(Boolean);
  const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  out.push(dup.length ? {severity:"error",title:"Duplicate SampleID",detail:`Duplicates: ${dup.join(", ")}.`} :
    {severity:"pass",title:"Unique sample identifiers",detail:`${ids.length} unique samples detected.`});

  let missing=0, negative=0, nonnumeric=0, emptySamples:string[]=[];
  comm.forEach(r=>{
    let sum=0, valid=0;
    taxa.forEach(t=>{
      const v=r[t];
      if(isMissing(v)){missing++; return;}
      if(!numeric(v)){nonnumeric++; return;}
      const n=Number(v); valid++; sum+=n; if(n<0) negative++;
    });
    if(valid===taxa.length && sum===0) emptySamples.push(r.SampleID);
  });
  if(missing) out.push({severity:"error",title:"Missing community values",detail:`${missing} empty cell(s) detected. EcoStat will not silently replace them with zero.`});
  if(nonnumeric) out.push({severity:"error",title:"Non-numeric community values",detail:`${nonnumeric} non-numeric value(s) occur in taxa columns.`});
  if(negative) out.push({severity:"error",title:"Negative values",detail:`${negative} negative value(s) detected. Standard abundance/community dissimilarities generally require non-negative data.`});
  if(emptySamples.length) out.push({severity:"warning",title:"Empty samples",detail:`Zero-total samples: ${emptySamples.join(", ")}. Bray–Curtis involving empty samples requires explicit handling.`});

  if(meta.length){
    const mids=meta.map(r=>r.SampleID).filter(Boolean);
    const missingMeta=ids.filter(x=>!mids.includes(x));
    const orphanMeta=mids.filter(x=>!ids.includes(x));
    if(missingMeta.length || orphanMeta.length) out.push({severity:"error",title:"Community ↔ metadata mismatch",
      detail:`Missing metadata for: ${missingMeta.join(", ")||"none"}. Metadata without community sample: ${orphanMeta.join(", ")||"none"}.`});
    else out.push({severity:"pass",title:"Sample matching",detail:"All community samples match metadata by SampleID."});

    Object.keys(meta[0]).filter(x=>x!=="SampleID").forEach(f=>{
      const counts:Record<string,number>={};
      meta.forEach(r=>{ if(!isMissing(r[f])) counts[r[f]]=(counts[r[f]]||0)+1; });
      const levels=Object.keys(counts);
      if(levels.length>1 && Math.min(...Object.values(counts))<2)
        out.push({severity:"warning",title:`Low replication: ${f}`,detail:`At least one level has fewer than 2 samples (${levels.map(l=>`${l}: ${counts[l]}`).join("; ")}).`});
    });
  } else out.push({severity:"warning",title:"Metadata not loaded",detail:"Descriptive community analyses are possible, but hypothesis tests need an explicit design table."});

  if(taxa.length){
    const totals=taxa.map(t=>({t,total:comm.reduce((a,r)=>a+(numeric(r[t])?Number(r[t]):0),0)}));
    const rare=totals.filter(x=>x.total>0 && x.total<5);
    if(rare.length) out.push({severity:"recommendation",title:"Rare taxa detected",detail:`Low-total taxa: ${rare.map(x=>`${x.t} (${x.total})`).join(", ")}. Do not remove them automatically; assess ecological and analytical justification.`});
  }
  if(!out.some(x=>x.severity==="error")) out.unshift({severity:"pass",title:"Core integrity check passed",detail:"No blocking structural errors were detected. Warnings and recommendations still require scientific judgement."});
  return out;
}

function App(){
  const [commText,setCommText]=useState(demoCommunity);
  const [metaText,setMetaText]=useState(demoMetadata);
  const comm=useMemo(()=>parseCSV(commText),[commText]);
  const meta=useMemo(()=>parseCSV(metaText),[metaText]);
  const checks=useMemo(()=>scientificChecks(comm,meta),[comm,meta]);
  const taxa=comm.length?Object.keys(comm[0]).filter(x=>x!=="SampleID").length:0;
  const errors=checks.filter(x=>x.severity==="error").length;

  const loadFile=(file:File|undefined,setter:(s:string)=>void)=>{
    if(!file)return; const r=new FileReader(); r.onload=()=>setter(String(r.result||"")); r.readAsText(file);
  };
  return <div className="app">
    <aside>
      <div className="brand"><b>SIGALT</b><span>EcoStat</span></div>
      <div className="version">v0.1.0</div>
      {["Data","Scientific Data Check","Transform","Ordination","Hypothesis","Export"].map((x,i)=>
        <div className={"nav "+(i<2?"active":"future")} key={x}><span>{String(i+1).padStart(2,"0")}</span>{x}</div>)}
      <div className="asideNote">Analysis should support ecological inference—not replace scientific judgement.</div>
    </aside>
    <main>
      <header><div><div className="eyebrow">MULTIVARIATE ECOLOGICAL ANALYSIS</div><h1>Scientific Data Check</h1>
        <p>Inspect the structure of your ecological dataset before choosing a transformation, distance measure or hypothesis test.</p></div>
        <div className={"status "+(errors?"bad":"good")}>{errors?`${errors} blocking issue${errors>1?"s":""}`:"Ready for review"}</div>
      </header>

      <section className="metrics">
        <div><b>{comm.length}</b><span>Samples</span></div><div><b>{taxa}</b><span>Taxa</span></div>
        <div><b>{meta.length?Object.keys(meta[0]).length-1:0}</b><span>Metadata fields</span></div><div><b>{checks.length}</b><span>Checks</span></div>
      </section>

      <section className="uploadGrid">
        <div className="card"><div className="cardTitle">Community matrix</div><p>Rows = samples · columns = taxa · first key = SampleID</p>
          <input type="file" accept=".csv,text/csv" onChange={e=>loadFile(e.target.files?.[0],setCommText)}/></div>
        <div className="card"><div className="cardTitle">Metadata</div><p>One row per sample · SampleID must match exactly</p>
          <input type="file" accept=".csv,text/csv" onChange={e=>loadFile(e.target.files?.[0],setMetaText)}/></div>
      </section>

      <div className="demoButtons"><button onClick={()=>{setCommText(demoCommunity);setMetaText(demoMetadata)}}>Load clean demo</button>
        <button onClick={()=>{setCommText(problemCommunity);setMetaText(problemMetadata)}}>Load diagnostic demo</button></div>

      <section className="checks">
        {checks.map((c,i)=><div className={"check "+c.severity} key={i}><div className="icon">{c.severity==="pass"?"✓":c.severity==="error"?"×":c.severity==="warning"?"!":"i"}</div>
          <div><div className="checkTop"><b>{c.title}</b><span>{c.severity}</span></div><p>{c.detail}</p></div></div>)}
      </section>
      <footer><b>SIGALT EcoStat</b> · Data remain in your browser in this prototype · Statistical validation against R/vegan precedes v1.0.</footer>
    </main>
  </div>
}
createRoot(document.getElementById("root")!).render(<App/>);
