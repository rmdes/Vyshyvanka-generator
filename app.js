"use strict";
window.VY = window.VY || {};

/* ===================== state + UI ===================== */
const SHAPES=[["sleeve","Sleeve band"],["collar","Collar / cuff"],["rushnyk","Rushnyk"],["sampler","Sampler"]];
const LAYOUTS=[["fabric","Seamless"],["bordered","Border frame"],["runner","Side runner"],["medallion","Medallion"]];
const BGS=[["linen","Linen"],["charcoal","Charcoal"],["black","Black"],["indigo","Indigo"]];
const SCALES=[["small","S"],["medium","M"],["large","L"]];
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
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve"};

const regionSel=document.getElementById("region");
for(const k in VY.REGIONS){const o=document.createElement("option");o.value=k;o.textContent=VY.REGIONS[k].name;regionSel.appendChild(o);}
const resSel=document.getElementById("res");
RES.forEach(([v,lbl])=>{const o=document.createElement("option");o.value=v;o.textContent=lbl;resSel.appendChild(o);});
function buildSeg(id,items,key){const el=document.getElementById(id);items.forEach(([v,lbl])=>{const b=document.createElement("button");b.dataset.v=v;b.textContent=lbl;b.onclick=()=>{state[key]=v;syncUI();generate();};el.appendChild(b);});}
buildSeg("shapeSeg",SHAPES,"shape");buildSeg("layoutSeg",LAYOUTS,"layout");buildSeg("bgSeg",BGS,"bg");buildSeg("scaleSeg",SCALES,"scale");

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
  document.getElementById("seed").value=state.seed;
  resSel.value=state.res;
  const wall=state.mode==="wallpaper";
  document.getElementById("wallControls").classList.toggle("hidden",!wall);
  document.getElementById("panelControls").classList.toggle("hidden",wall);
  document.getElementById("hint").textContent=wall?"preview scaled · PNG exports full resolution":"scroll to pan tall panels";
  const setOn=(b,isOn)=>{b.classList.toggle("on",isOn);b.setAttribute("role","radio");b.setAttribute("aria-checked",String(isOn));};
  [...document.getElementById("modeSeg").children].forEach(b=>setOn(b,b.dataset.mode===state.mode));
  [...document.getElementById("styleSeg").children].forEach(b=>setOn(b,b.dataset.style===state.style));
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale"};
  for(const id in segKey)[...document.getElementById(id).children].forEach(b=>setOn(b,b.dataset.v===state[segKey[id]]));
  const name=VY.REGIONS[state.region].name.split(" — ")[0];
  document.getElementById("title").textContent=wall
    ? `${name} · ${LAYOUTS.find(l=>l[0]===state.layout)[1]} wallpaper`
    : `${name} · ${SHAPES.find(s=>s[0]===state.shape)[1]}`;
}

function generate(updateHash=true){
  pushHistory();
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}`);
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setConfig({
    P,
    region:state.region,
    variety:state.variety/100,
    dens,
    decoP:0.25+dens*0.13,
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
function writeHash(){const p=new URLSearchParams({m:state.mode,r:state.region,c:state.complexity,vy:state.variety,st:state.style,seed:state.seed,res:state.res,lay:state.layout,bg:state.bg,sc:state.scale,sh:state.shape});history.replaceState(null,"","#"+p.toString());}
function readHash(){if(!location.hash)return;const p=new URLSearchParams(location.hash.slice(1));const g=(k,d)=>p.get(k)??d;
  state.mode=g("m",state.mode);if(VY.REGIONS[g("r","")])state.region=g("r");state.complexity=+g("c",state.complexity);
  state.variety=+g("vy",state.variety);state.style=g("st",state.style);state.seed=g("seed",state.seed);state.res=g("res",state.res);
  state.layout=g("lay",state.layout);state.bg=g("bg",state.bg);state.scale=g("sc",state.scale);state.shape=g("sh",state.shape);}

/* ---- events ---- */
[...document.getElementById("modeSeg").children].forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;syncUI();generate();});
[...document.getElementById("styleSeg").children].forEach(b=>b.onclick=()=>{state.style=b.dataset.style;syncUI();generate();});
regionSel.onchange=e=>{state.region=e.target.value;syncUI();generate();};
resSel.onchange=e=>{state.res=e.target.value;generate();};
document.getElementById("complexity").oninput=e=>{state.complexity=+e.target.value;document.getElementById("cxVal").textContent=state.complexity;};
document.getElementById("complexity").onchange=()=>generate();
document.getElementById("variety").oninput=e=>{state.variety=+e.target.value;document.getElementById("vyVal").textContent=state.variety+"%";};
document.getElementById("variety").onchange=()=>generate();
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
