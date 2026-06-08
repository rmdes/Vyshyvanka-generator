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
const DEFAULTS={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:45,symmetry:"d4",lab:null,viewX:null,viewY:null,viewZoom:null};
const state={...DEFAULTS};

const regionSel=document.getElementById("region");
for(const k in VY.REGIONS){const o=document.createElement("option");o.value=k;o.textContent=VY.REGIONS[k].name;regionSel.appendChild(o);}
const resSel=document.getElementById("res");
RES.forEach(([v,lbl])=>{const o=document.createElement("option");o.value=v;o.textContent=lbl;resSel.appendChild(o);});
function buildSeg(id,items,key){const el=document.getElementById(id);items.forEach(([v,lbl])=>{const b=document.createElement("button");b.dataset.v=v;b.textContent=lbl;b.onclick=()=>{resetView();state[key]=v;syncUI();generate();};el.appendChild(b);});}
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
  document.getElementById("panelControls").classList.toggle("hidden",state.mode!=="panel");
  document.getElementById("hint").textContent="scroll = zoom · drag = pan · 0 = fit";
  const setOn=(b,isOn)=>{b.classList.toggle("on",isOn);b.setAttribute("role","radio");b.setAttribute("aria-checked",String(isOn));};
  [...document.getElementById("modeSeg").children].forEach(b=>setOn(b,b.dataset.mode===state.mode));
  [...document.getElementById("styleSeg").children].forEach(b=>setOn(b,b.dataset.style===state.style));
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry"};
  for(const id in segKey)[...document.getElementById(id).children].forEach(b=>setOn(b,b.dataset.v===state[segKey[id]]));
  const name=VY.REGIONS[state.region].name.split(" — ")[0];
  document.getElementById("title").textContent =
      state.mode==="explore" ? `${name} · Infinite fabric`
    : wall                   ? `${name} · ${LAYOUTS.find(l=>l[0]===state.layout)[1]} wallpaper`
    :                          `${name} · ${SHAPES.find(s=>s[0]===state.shape)[1]}`;
  const _lp=document.getElementById("labPinned"); if(_lp) _lp.style.display=(state.lab && Array.isArray(state.lab.layers))?"":"none";
  if(state.lab && Array.isArray(state.lab.layers)){
    document.getElementById("labNLayers").value=state.lab.layers.length;
    document.getElementById("labNLayersVal").textContent=state.lab.layers.length;
    document.getElementById("labLevels").value=state.lab.levels;
    document.getElementById("labLevelsVal").textContent=state.lab.levels;
    buildLabLayers(state.lab);
  }
}

function generate(updateHash=true){
  pushHistory();
  // NOTE: state.lab is deliberately NOT in the RNG seed — the genome is applied purely (makeFieldMotif)
  // and shared via the URL hash, so editing the Lab changes ONLY field-motif geometry, not the whole canvas.
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}|${state.tradition}|${state.symmetry}`);
  const P=(state.mode==="wallpaper"||state.mode==="explore")?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
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
  let piece, exp;
  if(state.mode==="wallpaper"&&state.layout==="fabric"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const tileModel=VY.gen.composeFabricTile(state.scale);
    const base={small:5,medium:8,large:12}[state.scale];
    const cell=Math.max(4,Math.round(base*H/1080));
    const pcols=Math.round(W/cell), prows=Math.round(H/cell);
    const tileCanvas=VY.render.buildTileCanvas(tileModel,cell,state.style,seedNum);
    exp=document.createElement("canvas"); exp.width=W; exp.height=H;
    const eg=exp.getContext("2d"); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    const pat=eg.createPattern(tileCanvas,"repeat"); eg.fillStyle=pat; eg.fillRect(0,0,W,H);
    VY.app._lastTile=tileCanvas; VY.app._lastModel=tileModel;
    piece={cols:pcols, rows:prows, bg:P.bg,
           rasterTile:(dCell,tx,ty)=>VY.render.rasterSeamlessTile(tileModel,dCell,tx,ty,state.style,seedNum,P.bg,256)};
    document.getElementById("dims").textContent=`${W}×${H}px · seamless tile ${tileModel.cols}×${tileModel.rows}`;
  }else if(state.mode==="wallpaper"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const model=VY.gen.composeWallpaper(W,H,state.layout,state.scale);
    exp=document.createElement("canvas"); exp.width=W; exp.height=H;
    const eg=exp.getContext("2d"); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    const ox=Math.round((W-model.cols*model.cell)/2),oy=Math.round((H-model.rows*model.cell)/2);
    VY.render.setCtx(eg); VY.render.drawGrid(model,model.cell,ox,oy,state.style,seedNum); VY.render.setCtx(VY.ctx);
    VY.app._lastModel=model;
    piece={cols:model.cols, rows:model.rows, bg:P.bg,
           rasterTile:(dCell,tx,ty)=>VY.render.rasterTile(model,dCell,tx,ty,state.style,seedNum,P.bg,256)};
    document.getElementById("dims").textContent=`${W}×${H}px · ${model.cols}×${model.rows} stitches`;
  }else if(state.mode==="explore"){
    const mm=11;   // fixed medium lattice for v1 (zoom is the user's scale control)
    const cfg=VY.gen.buildFabricConfig(P,
      {ornate:dens, wild:state.variety/100, tradition:state.tradition/100, symmetry:state.symmetry},
      state.lab, mm, state.seed);
    exp=null;                       // export = current view (#png falls back to VY.cv)
    VY.app._lastModel=null; VY.app._lastTile=null;
    piece={infinite:true, bg:P.bg,
      rasterTile:(dCell,tx,ty)=>{ const w=VY.gen.composeInfiniteTile(cfg,dCell,tx,ty,256);
        return VY.render.rasterWindowTile(w.model,dCell,w.ox,w.oy,state.style,seedNum,P.bg,256); }};
    document.getElementById("dims").textContent=`Infinite fabric · roam to explore`;
  }else{
    const model=VY.gen.composePanel(state.shape);
    const cell=Math.max(3,Math.min(22,Math.floor(Math.min(720/model.cols,720/model.rows))));
    const W=model.cols*cell,H=model.rows*cell;
    exp=document.createElement("canvas"); exp.width=W*dpr; exp.height=H*dpr;
    const eg=exp.getContext("2d"); eg.setTransform(dpr,0,0,dpr,0,0); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    VY.render.setCtx(eg); VY.render.drawGrid(model,cell,0,0,state.style,seedNum); VY.render.setCtx(VY.ctx);
    VY.app._lastModel=model;
    piece={cols:model.cols, rows:model.rows, bg:P.bg,
           rasterTile:(dCell,tx,ty)=>VY.render.rasterTile(model,dCell,tx,ty,state.style,seedNum,P.bg,256)};
    document.getElementById("dims").textContent=`${model.cols}×${model.rows} stitches · cell ${cell}px`;
  }
  VY.app._exportCanvas=exp; VY.app._piece=piece;
  const rv=(state.viewZoom)?{cx:state.viewX,cy:state.viewY,zoom:state.viewZoom}:null;
  VY.viewport.attach(piece, rv);
  if(updateHash)writeHash();
}

/* ---- shareable URL ---- */
function writeHash(){const o={m:state.mode,r:state.region,c:state.complexity,vy:state.variety,st:state.style,seed:state.seed,res:state.res,lay:state.layout,bg:state.bg,sc:state.scale,sh:state.shape,tr:state.tradition,sym:state.symmetry};if(state.lab)o.lab=JSON.stringify(state.lab);if(state.viewZoom){o.vox=state.viewX;o.voy=state.viewY;o.voz=state.viewZoom;}const p=new URLSearchParams(o);history.replaceState(null,"","#"+p.toString());}
function readHash(){if(!location.hash)return;const p=new URLSearchParams(location.hash.slice(1));const g=(k,d)=>p.get(k)??d;
  state.mode=g("m",state.mode);if(VY.REGIONS[g("r","")])state.region=g("r");const ci=+g("c",state.complexity); if(Number.isFinite(ci)) state.complexity=Math.max(1,Math.min(5,Math.round(ci)));
  const vi=+g("vy",state.variety); if(Number.isFinite(vi)) state.variety=Math.max(0,Math.min(100,Math.round(vi)));state.style=g("st",state.style);state.seed=g("seed",state.seed);state.res=g("res",state.res);
  state.layout=g("lay",state.layout);state.bg=g("bg",state.bg);state.scale=g("sc",state.scale);state.shape=g("sh",state.shape);
  const ti=+g("tr",state.tradition); if(Number.isFinite(ti)) state.tradition=Math.max(0,Math.min(100,Math.round(ti)));
  const sy=g("sym",state.symmetry); if(sy==="d4"||sy==="d2"||sy==="loose") state.symmetry=sy;
  const lb=g("lab",""); if(lb){ try{ const o=JSON.parse(lb); if(o && typeof o==="object" && !Array.isArray(o) && (Array.isArray(o.layers)||o.sym||o.levels||o.centerStyle)) state.lab=o; }catch{} }
  const vox=+g("vox","x"),voy=+g("voy","x"),voz=+g("voz","x");
  if(Number.isFinite(vox)&&Number.isFinite(voy)&&Number.isFinite(voz)&&voz>0){ state.viewX=vox;state.viewY=voy;state.viewZoom=voz; }}

/* ---- events ---- */
function resetView(){ state.viewX=state.viewY=state.viewZoom=null; }
[...document.getElementById("modeSeg").children].forEach(b=>b.onclick=()=>{resetView();state.mode=b.dataset.mode;syncUI();generate();});
[...document.getElementById("styleSeg").children].forEach(b=>b.onclick=()=>{state.style=b.dataset.style;syncUI();generate();});
regionSel.onchange=e=>{resetView();state.region=e.target.value;syncUI();generate();};
resSel.onchange=e=>{resetView();state.res=e.target.value;generate();};
document.getElementById("complexity").oninput=e=>{state.complexity=+e.target.value;document.getElementById("cxVal").textContent=state.complexity;};
document.getElementById("complexity").onchange=()=>{resetView();generate();};
document.getElementById("variety").oninput=e=>{state.variety=+e.target.value;document.getElementById("vyVal").textContent=state.variety+"%";};
document.getElementById("variety").onchange=()=>{resetView();generate();};
document.getElementById("tradition").oninput=e=>{state.tradition=+e.target.value;document.getElementById("trVal").textContent=state.tradition+"%";};
document.getElementById("tradition").onchange=()=>{resetView();generate();};
document.getElementById("seed").onchange=e=>{resetView();state.seed=e.target.value.trim()||"vyshyvanka";generate();};
document.getElementById("gen").onclick=()=>{resetView();state.lab=null;state.seed=Math.random().toString(36).slice(2,9);syncUI();generate();
  if(!document.querySelector('.acc-sec[data-sec="lab"] .acc-b').classList.contains("hidden")) openLabFromSeed();};
document.getElementById("png").onclick=()=>{const a=document.createElement("a");
  const tag=state.mode==="wallpaper"?state.layout+"_"+state.res:state.mode==="explore"?"explore":state.shape;
  a.download=`vyshyvanka_${state.region}_${tag}_${state.seed}.png`;
  a.href=(VY.app._exportCanvas||VY.cv).toDataURL("image/png");a.click();};
document.getElementById("share").onclick=async()=>{writeHash();const btn=document.getElementById("share");
  try{await navigator.clipboard.writeText(location.href);btn.textContent="Copied!";setTimeout(()=>btn.textContent="🔗 Copy share link",1200);}
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
    b.onclick=()=>{Object.assign(state,f.state);syncUI();generate();if(state.lab)openSection("lab");};
    wrap.appendChild(b);
  });
}
document.getElementById("save").onclick=()=>{
  const tc=document.createElement("canvas"); tc.width=108; tc.height=72;
  tc.getContext("2d").drawImage(VY.app._exportCanvas||VY.cv,0,0,108,72);
  const thumb=tc.toDataURL("image/png");
  const arr=loadFavs();
  arr.unshift({seed:state.seed, region:state.region, state:{...state}, thumb});
  if(!saveFavs(arr.slice(0,12))) alert("Couldn't save favorite (storage full or unavailable).");
  renderFavs();
};

document.getElementById("resetAll").onclick=()=>{
  if(!confirm("Reset everything? This clears your saved favorites and returns all controls to defaults.")) return;
  try{localStorage.removeItem(FAV_KEY);localStorage.removeItem(SEC_KEY);}catch{}
  Object.assign(state,DEFAULTS,{lab:null});
  history.replaceState(null,"",location.pathname+location.search);
  syncUI(); generate(false); renderFavs(); openSection("design");
};

/* ---- undo (history stack) ---- */
const HIST=[]; let restoring=false;
function pushHistory(){ if(restoring) return; HIST.push(JSON.stringify(state)); if(HIST.length>30) HIST.shift(); }
document.getElementById("undo").onclick=()=>{
  if(HIST.length<2){return;} HIST.pop();
  const prev=JSON.parse(HIST[HIST.length-1]);
  restoring=true; Object.assign(state,prev); syncUI(); generate(); restoring=false;
  if(state.lab)openSection("lab");
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
    box.innerHTML=`<label>Layer ${i+1}</label>`;
    const grid=document.createElement("div"); grid.className="labgrid";
    const cell=(name,el)=>{const c=document.createElement("div");c.className="labf";
      const s=document.createElement("span");s.textContent=name;c.append(s,el);
      el.title=name; el.setAttribute("aria-label",`Layer ${i+1} ${name}`); return c;};
    const sel=(opts,val)=>{const s=document.createElement("select");opts.forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);});return s;};
    const num=(v,step,min,max)=>{const n=document.createElement("input");n.type="number";n.value=v;n.step=step;if(min!=null)n.min=min;if(max!=null)n.max=max;return n;};
    const coord=sel(LAB_COORDS,L.coord), wave=sel(LAB_WAVES,L.wave);
    const freq=num(L.freq,0.1), phase=num(L.phase,0.05), weight=num(L.weight,0.1,0), slot=num(L.slot,1,1);
    grid.append(cell("coord",coord),cell("wave",wave),cell("freq",freq),cell("phase",phase),cell("weight",weight),cell("slot",slot));
    box.appendChild(grid); host.appendChild(box);
    [coord,wave,freq,phase,weight,slot].forEach(el=>el.onchange=commitLab);
    box._get=()=>({coord:coord.value,wave:wave.value,freq:+freq.value,phase:+phase.value,weight:+weight.value,slot:Math.max(1,Math.round(+slot.value))});
  });
}
function commitLab(){
  const layers=[...document.querySelectorAll("#labLayers .labLayer")].map(b=>b._get());
  state.lab={ levels:+document.getElementById("labLevels").value, centerStyle:(state.lab&&state.lab.centerStyle)||"dot", layers };
  generate();   // keep the current zoom so genome edits are visible up close
}
function openLabFromSeed(){
  const G=labCurrentGenome();
  document.getElementById("labNLayers").value=G.layers.length;
  document.getElementById("labNLayersVal").textContent=G.layers.length;
  document.getElementById("labLevels").value=G.levels;
  document.getElementById("labLevelsVal").textContent=G.levels;
  buildLabLayers(G);
}
/* ---- accordion (single-open, persisted) ---- */
const SEC_KEY="vy_openSection";
const SECTIONS=["design","lab","output","style","export"];
function openSection(key){
  if(!SECTIONS.includes(key)) key="design";
  SECTIONS.forEach(s=>{
    const sec=document.querySelector(`.acc-sec[data-sec="${s}"]`);
    const h=sec.querySelector(".acc-h"), b=sec.querySelector(".acc-b");
    const on=(s===key);
    b.classList.toggle("hidden",!on);
    h.setAttribute("aria-expanded",String(on));
  });
  try{localStorage.setItem(SEC_KEY,key);}catch{}
  if(key==="lab" && !state.lab) openLabFromSeed();
}
document.querySelectorAll(".acc-h").forEach(h=>{
  h.onclick=()=>openSection(h.closest(".acc-sec").dataset.sec);
});
document.getElementById("labNLayers").oninput=e=>{document.getElementById("labNLayersVal").textContent=e.target.value;};
document.getElementById("labNLayers").onchange=e=>{
  const n=+e.target.value, G=state.lab||labCurrentGenome();
  const layers=[]; for(let i=0;i<n;i++) layers.push(G.layers[i]||G.layers[G.layers.length-1]);
  buildLabLayers({...G,layers}); commitLab();
};
document.getElementById("labLevels").oninput=e=>{document.getElementById("labLevelsVal").textContent=e.target.value;};
document.getElementById("labLevels").onchange=commitLab;
document.getElementById("labReset").onclick=()=>{ state.lab=null; generate(); openLabFromSeed(); };
document.getElementById("labRandom").onclick=()=>{
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setSeed(Math.random().toString(36).slice(2)+"|labrnd");  // transient; generate() reseeds before render
  const G=VY.gen.sampleGenome(P,{ornate:dens,wild:state.variety/100,tradition:state.tradition/100,symmetry:state.symmetry});
  state.lab={ levels:G.levels, centerStyle:G.centerStyle, layers:G.layers };
  document.getElementById("labNLayers").value=G.layers.length;
  document.getElementById("labNLayersVal").textContent=G.layers.length;
  document.getElementById("labLevels").value=G.levels;
  document.getElementById("labLevelsVal").textContent=G.levels;
  buildLabLayers(G);
  generate();   // keep the current zoom so the new genome is visible up close
};

/* ---- mobile drawer ---- */
document.getElementById("menuBtn").onclick=()=>document.body.classList.toggle("menu-open");
document.getElementById("backdrop").onclick=()=>document.body.classList.remove("menu-open");
document.getElementById("drawerClose").onclick=()=>document.body.classList.remove("menu-open");

/* ---- boot ---- */
VY.app = { generate, state, _lastTile:null, _lastModel:null, _exportCanvas:null, _piece:null };
VY.viewport.init();
VY.viewport.onSettle=(view,fit)=>{ if(fit){ state.viewX=state.viewY=state.viewZoom=null; } else { state.viewX=+view.cx.toFixed(2); state.viewY=+view.cy.toFixed(2); state.viewZoom=+view.zoom.toFixed(3); } writeHash(); };
readHash();syncUI();generate(false);renderFavs();
let _open="design"; try{const k=localStorage.getItem(SEC_KEY); if(SECTIONS.includes(k)) _open=k;}catch{}
if(state.lab) _open="lab";
openSection(_open);

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
