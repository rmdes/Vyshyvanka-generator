"use strict";
window.VY = window.VY || {};

/* ===================== state + UI ===================== */
const SHAPES=[["sleeve","Sleeve band"],["collar","Collar / cuff"],["rushnyk","Rushnyk"],["sampler","Sampler"]];
const LAYOUTS=[["fabric","Seamless"],["bordered","Border frame"],["runner","Side runner"],["medallion","Medallion"]];
const BGS=[["linen","Linen"],["charcoal","Charcoal"],["black","Black"],["indigo","Indigo"]];
const SCALES=[["small","S"],["medium","M"],["large","L"]];
const SYMS=[["d4","8-fold"],["d2","4-fold"],["loose","Loose"]];
const dpr=window.devicePixelRatio||1;
const RES=[
  ["screen",`This screen (${Math.round(screen.width*dpr)}×${Math.round(screen.height*dpr)})`,Math.round(screen.width*dpr),Math.round(screen.height*dpr)],
  ["fhd","Desktop 1920×1080",1920,1080],
  ["qhd","QHD 2560×1440",2560,1440],
  ["uhd","4K 3840×2160",3840,2160],
  ["uw","Ultrawide 3440×1440",3440,1440],
  ["mbp","Laptop 2880×1800",2880,1800],
  ["phone","Phone 1170×2532",1170,2532],
  ["sq","Square 1080×1080",1080,1080],
];
const state={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:20,symmetry:"d4",lab:null};

const regionSel=document.getElementById("region");
for(const k in VY.REGIONS){const o=document.createElement("option");o.value=k;o.textContent=VY.REGIONS[k].name;regionSel.appendChild(o);}
const resSel=document.getElementById("res");
RES.forEach(([v,lbl])=>{const o=document.createElement("option");o.value=v;o.textContent=lbl;resSel.appendChild(o);});
function buildSeg(id,items,key){const el=document.getElementById(id);items.forEach(([v,lbl])=>{const b=document.createElement("button");b.dataset.v=v;b.textContent=lbl;b.onclick=()=>{state[key]=v;syncUI();generate();};el.appendChild(b);});}
buildSeg("shapeSeg",SHAPES,"shape");buildSeg("layoutSeg",LAYOUTS,"layout");buildSeg("bgSeg",BGS,"bg");buildSeg("scaleSeg",SCALES,"scale");buildSeg("symSeg",SYMS,"symmetry");

function syncUI(){
  regionSel.value=state.region;
  document.getElementById("regionNote").textContent=VY.REGIONS[state.region].note;
  document.getElementById("complexity").value=state.complexity;
  document.getElementById("cxVal").textContent=state.complexity;
  document.getElementById("variety").value=state.variety;
  document.getElementById("vyVal").textContent=state.variety+"%";
  const cx=document.getElementById("complexity");
  cx.setAttribute("aria-valuetext",`Complexity ${state.complexity} of 5`);
  const vy=document.getElementById("variety");
  vy.setAttribute("aria-valuetext",`Variety ${state.variety} percent`);
  document.getElementById("tradition").value=state.tradition;
  document.getElementById("trVal").textContent=state.tradition+"%";
  document.getElementById("tradition").setAttribute("aria-valuetext",`Tradition to invention ${state.tradition} percent`);
  document.getElementById("seed").value=state.seed;
  resSel.value=state.res;
  const wall=state.mode==="wallpaper";
  document.getElementById("wallControls").classList.toggle("hidden",!wall);
  document.getElementById("panelControls").classList.toggle("hidden",wall);
  document.getElementById("hint").textContent=wall?"preview scaled · PNG exports full resolution":"scroll to pan tall panels";
  const setOn=(b,isOn)=>{b.classList.toggle("on",isOn);b.setAttribute("role","radio");b.setAttribute("aria-checked",String(isOn));};
  [...document.getElementById("modeSeg").children].forEach(b=>setOn(b,b.dataset.mode===state.mode));
  [...document.getElementById("styleSeg").children].forEach(b=>setOn(b,b.dataset.style===state.style));
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry"};
  for(const id in segKey)[...document.getElementById(id).children].forEach(b=>setOn(b,b.dataset.v===state[segKey[id]]));
  const name=VY.REGIONS[state.region].name.split(" — ")[0];
  document.getElementById("title").textContent=wall
    ? `${name} · ${LAYOUTS.find(l=>l[0]===state.layout)[1]} wallpaper`
    : `${name} · ${SHAPES.find(s=>s[0]===state.shape)[1]}`;
  if(state.lab){
    document.getElementById("labNLayers").value=state.lab.layers.length;
    document.getElementById("labNLayersVal").textContent=state.lab.layers.length;
    document.getElementById("labLevels").value=state.lab.levels;
    document.getElementById("labLevelsVal").textContent=state.lab.levels;
    buildLabLayers(state.lab);
    const body=document.getElementById("labBody");
    if(body.classList.contains("hidden")){ body.classList.remove("hidden"); document.getElementById("labToggle").setAttribute("aria-expanded","true"); document.getElementById("labToggle").textContent="🧪 Lab ▾"; }
  }
}

function generate(updateHash=true){
  pushHistory();
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}|${state.tradition}|${state.symmetry}|${state.lab?JSON.stringify(state.lab):""}`);
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setConfig({
    P,
    region:state.region,
    variety:state.variety/100,
    dens,
    tradition:state.tradition/100,
    symmetry:state.symmetry,
    lab:state.lab,
  });
  const seedNum = VY.gen.hashStr(state.seed);
  VY.app._lastTile=null;
  if(state.mode==="wallpaper"&&state.layout==="fabric"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const tileModel=VY.gen.composeFabricTile(state.scale);
    const base={small:5,medium:8,large:12}[state.scale];
    const cell=Math.max(4,Math.round(base*H/1080));
    const tileCanvas=VY.render.buildTileCanvas(tileModel,cell,state.style,seedNum);
    VY.cv.width=W;VY.cv.height=H;VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.fillStyle=P.bg;VY.ctx.fillRect(0,0,W,H);
    VY.render.fillPattern(W,H,tileCanvas);
    VY.render.fitPreview(W,H);
    VY.app._lastTile=tileCanvas;
    VY.app._lastModel=tileModel;
    document.getElementById("dims").textContent=`${W}×${H}px · seamless tile ${tileModel.cols}×${tileModel.rows}`;
  }else if(state.mode==="wallpaper"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const model=VY.gen.composeWallpaper(W,H,state.layout,state.scale);
    VY.cv.width=W;VY.cv.height=H;VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.fillStyle=P.bg;VY.ctx.fillRect(0,0,W,H);
    const ox=Math.round((W-model.cols*model.cell)/2),oy=Math.round((H-model.rows*model.cell)/2);
    VY.render.drawGrid(model,model.cell,ox,oy,state.style,seedNum);
    VY.render.fitPreview(W,H);
    VY.app._lastModel=model;
    document.getElementById("dims").textContent=`${W}×${H}px · ${model.cols}×${model.rows} stitches`;
  }else{
    const model=VY.gen.composePanel(state.shape);
    const cell=Math.max(3,Math.min(22,Math.floor(Math.min(720/model.cols,720/model.rows))));
    const W=model.cols*cell,H=model.rows*cell;
    VY.cv.width=W*dpr;VY.cv.height=H*dpr;VY.ctx.setTransform(dpr,0,0,dpr,0,0);
    VY.ctx.fillStyle=P.bg;VY.ctx.fillRect(0,0,W,H);
    VY.render.drawGrid(model,cell,0,0,state.style,seedNum);
    VY.render.fitPreview(W,H);
    VY.app._lastModel=model;
    document.getElementById("dims").textContent=`${model.cols}×${model.rows} stitches · cell ${cell}px`;
  }
  if(updateHash)writeHash();
}

/* ---- shareable URL ---- */
function writeHash(){const o={m:state.mode,r:state.region,c:state.complexity,vy:state.variety,st:state.style,seed:state.seed,res:state.res,lay:state.layout,bg:state.bg,sc:state.scale,sh:state.shape,tr:state.tradition,sym:state.symmetry};if(state.lab)o.lab=JSON.stringify(state.lab);const p=new URLSearchParams(o);history.replaceState(null,"","#"+p.toString());}
function readHash(){if(!location.hash)return;const p=new URLSearchParams(location.hash.slice(1));const g=(k,d)=>p.get(k)??d;
  state.mode=g("m",state.mode);if(VY.REGIONS[g("r","")])state.region=g("r");const ci=+g("c",state.complexity); if(Number.isFinite(ci)) state.complexity=Math.max(1,Math.min(5,Math.round(ci)));
  const vi=+g("vy",state.variety); if(Number.isFinite(vi)) state.variety=Math.max(0,Math.min(100,Math.round(vi)));state.style=g("st",state.style);state.seed=g("seed",state.seed);state.res=g("res",state.res);
  state.layout=g("lay",state.layout);state.bg=g("bg",state.bg);state.scale=g("sc",state.scale);state.shape=g("sh",state.shape);
  const ti=+g("tr",state.tradition); if(Number.isFinite(ti)) state.tradition=Math.max(0,Math.min(100,Math.round(ti)));
  const sy=g("sym",state.symmetry); if(sy==="d4"||sy==="d2"||sy==="loose") state.symmetry=sy;
  const lb=g("lab",""); if(lb){ try{ const o=JSON.parse(lb); if(o && typeof o==="object" && !Array.isArray(o) && (Array.isArray(o.layers)||o.sym||o.levels||o.centerStyle)) state.lab=o; }catch{} }}

/* ---- events ---- */
[...document.getElementById("modeSeg").children].forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;syncUI();generate();});
[...document.getElementById("styleSeg").children].forEach(b=>b.onclick=()=>{state.style=b.dataset.style;syncUI();generate();});
regionSel.onchange=e=>{state.region=e.target.value;syncUI();generate();};
resSel.onchange=e=>{state.res=e.target.value;generate();};
document.getElementById("complexity").oninput=e=>{state.complexity=+e.target.value;document.getElementById("cxVal").textContent=state.complexity;};
document.getElementById("complexity").onchange=()=>generate();
document.getElementById("variety").oninput=e=>{state.variety=+e.target.value;document.getElementById("vyVal").textContent=state.variety+"%";};
document.getElementById("variety").onchange=()=>generate();
document.getElementById("tradition").oninput=e=>{state.tradition=+e.target.value;document.getElementById("trVal").textContent=state.tradition+"%";};
document.getElementById("tradition").onchange=()=>generate();
document.getElementById("seed").onchange=e=>{state.seed=e.target.value.trim()||"vyshyvanka";generate();};
document.getElementById("gen").onclick=()=>{state.seed=Math.random().toString(36).slice(2,9);syncUI();generate();};
document.getElementById("png").onclick=()=>{const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_${state.mode==="wallpaper"?state.layout+"_"+state.res:state.shape}_${state.seed}.png`;
  a.href=VY.cv.toDataURL("image/png");a.click();};
document.getElementById("share").onclick=async()=>{writeHash();const btn=document.getElementById("share");
  try{await navigator.clipboard.writeText(location.href);btn.textContent="Copied!";setTimeout(()=>btn.textContent="Copy link",1200);}
  catch{prompt("Share link:",location.href);}};

/* ---- favorites (localStorage) ---- */
const FAV_KEY="vy_favorites";
const loadFavs=()=>{try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch{return[];}};
const saveFavs=(f)=>{try{localStorage.setItem(FAV_KEY,JSON.stringify(f));return true;}catch{return false;}};
function renderFavs(){
  const wrap=document.getElementById("favs"); wrap.innerHTML="";
  loadFavs().forEach((f,idx)=>{
    const b=document.createElement("button"); b.className="fav"; b.title=f.seed;
    const img=document.createElement("img"); img.src=f.thumb; img.alt=`${f.region} ${f.seed}`;
    const rm=document.createElement("button"); rm.className="rm"; rm.textContent="✕";
    rm.onclick=(e)=>{e.stopPropagation();const arr=loadFavs();arr.splice(idx,1);saveFavs(arr);renderFavs();};
    b.appendChild(img); b.appendChild(rm);
    b.onclick=()=>{Object.assign(state,f.state);syncUI();generate();};
    wrap.appendChild(b);
  });
}
document.getElementById("save").onclick=()=>{
  const tc=document.createElement("canvas"); tc.width=108; tc.height=72;
  tc.getContext("2d").drawImage(VY.cv,0,0,108,72);
  const thumb=tc.toDataURL("image/png");
  const arr=loadFavs();
  arr.unshift({seed:state.seed, region:state.region, state:{...state}, thumb});
  if(!saveFavs(arr.slice(0,12))) alert("Couldn't save favorite (storage full or unavailable).");
  renderFavs();
};

/* ---- undo (history stack) ---- */
const HIST=[]; let restoring=false;
function pushHistory(){ if(restoring) return; HIST.push(JSON.stringify(state)); if(HIST.length>30) HIST.shift(); }
document.getElementById("undo").onclick=()=>{
  if(HIST.length<2){return;} HIST.pop();
  const prev=JSON.parse(HIST[HIST.length-1]);
  restoring=true; Object.assign(state,prev); syncUI(); generate(); restoring=false;
};

/* ---- Lab panel (genome overrides) ---- */
const LAB_COORDS=["radial","manhattan","chebyshev","diagonal","angle","lattice"];
const LAB_WAVES=["cos","tri","sq"];
function labCurrentGenome(){
  // derive a starting genome from the current seed+aim so the Lab opens pre-filled
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setSeed(state.seed+"|lab");  // transient reseed; safe because generate() always reseeds before any render
  return VY.gen.sampleGenome(P,{ornate:dens,wild:state.variety/100,tradition:state.tradition/100,symmetry:state.symmetry});
}
function buildLabLayers(G){
  const host=document.getElementById("labLayers"); host.innerHTML="";
  G.layers.forEach((L,i)=>{
    const box=document.createElement("div"); box.className="labLayer";
    const sel=(opts,val)=>{const s=document.createElement("select");opts.forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);});return s;};
    const num=(v,step,min,max)=>{const n=document.createElement("input");n.type="number";n.value=v;n.step=step;if(min!=null)n.min=min;if(max!=null)n.max=max;return n;};
    const coord=sel(LAB_COORDS,L.coord), wave=sel(LAB_WAVES,L.wave);
    const freq=num(L.freq,0.1), phase=num(L.phase,0.05), weight=num(L.weight,0.1,0), slot=num(L.slot,1,1);
    [[coord,"coordinate"],[wave,"waveform"],[freq,"frequency"],[phase,"phase"],[weight,"weight"],[slot,"color slot"]].forEach(([el,name])=>{el.title=name;el.setAttribute("aria-label",`Layer ${i+1} ${name}`);});
    box.innerHTML=`<label>Layer ${i+1}</label>`;
    const row1=document.createElement("div");row1.className="lrow";row1.append(coord,wave);
    const row2=document.createElement("div");row2.className="lrow";row2.append(freq,phase);
    const row3=document.createElement("div");row3.className="lrow";row3.append(weight,slot);
    box.append(row1,row2,row3); host.appendChild(box);
    [coord,wave,freq,phase,weight,slot].forEach(el=>el.onchange=commitLab);
    box._get=()=>({coord:coord.value,wave:wave.value,freq:+freq.value,phase:+phase.value,weight:+weight.value,slot:Math.max(1,Math.round(+slot.value))});
  });
}
function commitLab(){
  const layers=[...document.querySelectorAll("#labLayers .labLayer")].map(b=>b._get());
  state.lab={ levels:+document.getElementById("labLevels").value, centerStyle:"dot", layers };
  generate();
}
function openLabFromSeed(){
  const G=labCurrentGenome();
  document.getElementById("labNLayers").value=G.layers.length;
  document.getElementById("labNLayersVal").textContent=G.layers.length;
  document.getElementById("labLevels").value=G.levels;
  document.getElementById("labLevelsVal").textContent=G.levels;
  buildLabLayers(G);
}
document.getElementById("labToggle").onclick=()=>{
  const body=document.getElementById("labBody"), open=body.classList.toggle("hidden")===false;
  document.getElementById("labToggle").setAttribute("aria-expanded",String(open));
  document.getElementById("labToggle").textContent=open?"🧪 Lab ▾":"🧪 Lab ▸";
  if(open && !state.lab) openLabFromSeed();
};
document.getElementById("labNLayers").oninput=e=>{document.getElementById("labNLayersVal").textContent=e.target.value;};
document.getElementById("labNLayers").onchange=e=>{
  const n=+e.target.value, G=state.lab||labCurrentGenome();
  const layers=[]; for(let i=0;i<n;i++) layers.push(G.layers[i]||G.layers[G.layers.length-1]);
  buildLabLayers({...G,layers}); commitLab();
};
document.getElementById("labLevels").oninput=e=>{document.getElementById("labLevelsVal").textContent=e.target.value;};
document.getElementById("labLevels").onchange=commitLab;
document.getElementById("labReset").onclick=()=>{ state.lab=null; generate(); };

/* ---- mobile drawer ---- */
document.getElementById("menuBtn").onclick=()=>document.body.classList.toggle("menu-open");
document.getElementById("backdrop").onclick=()=>document.body.classList.remove("menu-open");
document.getElementById("drawerClose").onclick=()=>document.body.classList.remove("menu-open");

/* ---- boot ---- */
VY.app = { generate, state, _lastTile:null, _lastModel:null };
readHash();syncUI();generate(false);renderFavs();

document.getElementById("tile").onclick=()=>{
  if(!VY.app._lastTile){alert("Tile export is available for the Seamless layout.");return;}
  const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_tile_${state.seed}.png`;
  a.href=VY.app._lastTile.toDataURL("image/png"); a.click();
};

document.getElementById("chart").onclick=()=>{
  const model=VY.app._lastModel;
  if(!model){return;}
  const cells=model.cols*model.rows;
  if(cells>20000 && !confirm(`This chart is ${model.cols}×${model.rows} (${cells.toLocaleString()} stitches) — a very large image that isn't practical to stitch. Tip: the Seamless layout or a Garment panel makes a usable chart. Download anyway?`)){return;}
  const c=VY.render.renderChart(model);
  const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_chart_${state.seed}.png`;
  a.href=c.toDataURL("image/png"); a.click();
};
