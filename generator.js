"use strict";
window.VY = window.VY || {};

/* ===================== deterministic RNG ===================== */
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let RNG=Math.random;
const ri  =(a,b)=>a+Math.floor(RNG()*(b-a+1));
const pick=(arr)=>arr[Math.floor(RNG()*arr.length)];
const chance=(p)=>RNG()<p;
const shuffle=(a)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(RNG()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

/* global generation config (set per generate) */
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:''};

/* ===================== grid helpers ===================== */
const newGrid=(w,h)=>Array.from({length:h},()=>new Int8Array(w));
function blit(dst,src,ox,oy){
  for(let y=0;y<src.length;y++){const dy=oy+y; if(dy<0||dy>=dst.length)continue; const r=src[y];
    for(let x=0;x<r.length;x++){if(r[x]){const dx=ox+x; if(dx<0||dx>=dst[0].length)continue; dst[dy][dx]=r[x];}}}
}
function blitWrap(dst,src,ox,oy){ const H=dst.length,W=dst[0].length;
  for(let y=0;y<src.length;y++){const r=src[y];for(let x=0;x<r.length;x++){if(r[x]){
    dst[((oy+y)%H+H)%H][((ox+x)%W+W)%W]=r[x];}}}}
function transpose(g){const h=g.length,w=g[0].length,t=newGrid(h,w);for(let y=0;y<h;y++)for(let x=0;x<w;x++)t[x][y]=g[y][x];return t;}

/* ===================== MOTIF — combinatorial, 8-fold symmetric =====================
 * ALL random choices are made up-front; the per-cell loop is a pure function of (x,y),
 * which guarantees perfect symmetry and determinism. */
/* A "theme" fixes a shared family (shapes, ring-step, colours, baseline flags) once per
 * generation. Each motif only DEVIATES from it with probability scaled by Variety — so
 * low variety = identical clean repeats, high variety = lively but same family (coherent). */
function buildTheme(P,v){
  const col=()=>pick(P.colorBias)+1;
  const arches=["diamond","square","star","octa","cross","lattice","double","rosette"];
  const nArch=v<0.34?1:(v<0.67?2:3);
  return {
    arches:shuffle(arches).slice(0,nArch),
    ringStep:pick(v>0.55?[1,2]:[2,3]),
    colors:[col(),col(),col()],
    armKind:pick(["plus","x","both"]),
    base:{arms:chance(.5),rays:chance(.35),hooks:chance(.5),tips:chance(.6),
          innerLat:chance(.3),overlay:chance(.3),center:pick(["dot","cross","sdiamond","ring"])}
  };
}
function makeMotif(m){
  const T=CFG.theme, v=CFG.variety, g=newGrid(m,m), c=(m-1)/2, R=c;
  const dev=(p)=>RNG()<v*p;                       // deviate-from-theme probability
  const arche=T.arches.length>1?pick(T.arches):T.arches[0];
  const ringStep=dev(0.3)?pick([1,2,3]):T.ringStep;
  let colA=T.colors[0], colB=T.colors[1], colC=T.colors[2];
  if(dev(0.6)){const r=shuffle([colA,colB,colC]);colA=r[0];colB=r[1];colC=r[2];}
  const ringPal=[colA,colB,colC,colA,colB];
  const f=(base,p=0.4)=>dev(p)?!base:base;
  const useArms=f(T.base.arms), rays=f(T.base.rays), hooks=f(T.base.hooks), tips=f(T.base.tips),
        innerLat=arche==="lattice"||f(T.base.innerLat), overlay=f(T.base.overlay);
  const armKind=T.armKind, armCol=colC, ovCol=colB;
  const centerStyle=dev(0.5)?pick(["dot","cross","sdiamond","ring"]):T.base.center;
  const ringOf=(d)=>{const k=R-d;return (k>=0&&k%ringStep===0)?ringPal[((k/ringStep)|0)%ringPal.length]:0;};
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){
    const ax=Math.abs(x-c),ay=Math.abs(y-c),dm=ax+ay,dc=Math.max(ax,ay),dd=Math.abs(ax-ay);
    let val=0;
    if(arche==="diamond"||arche==="rosette"){ if(dm<=R)val=ringOf(dm); }
    else if(arche==="square"){ if(dc<=R)val=ringOf(dc); }
    else if(arche==="star"){ val=(dm===R||dc===R)?colA:(dm<R?ringOf(dm):0); }
    else if(arche==="octa"){ if(dm===R||dc===R||(dd===0&&dc<=R))val=colA; else if(dm<R&&(R-dm)%2===0)val=colB; }
    else if(arche==="cross"){ if((x===c||y===c)&&dc<=R)val=colA; if(dm===R)val=val||colB; }
    else if(arche==="lattice"){ if(ax%2===0&&ay%2===0)val=((ax+ay)%4===0)?colA:colB; }
    else if(arche==="double"){ if(dm<=R)val=ringOf(dm); if(dc===R)val=val||colB; }
    if(useArms&&(armKind==="plus"||armKind==="both")&&(x===c||y===c)&&dc<=R)val=val||armCol;
    if(useArms&&(armKind==="x"||armKind==="both")&&dd===0&&dc<=R)val=val||armCol;
    if(rays&&(x===c||y===c)&&dc===R)val=colC;
    if(innerLat&&ax%2===0&&ay%2===0&&dm<R&&dm>0)val=val||colB;
    if(overlay&&dd===0&&dc===Math.round(R*0.5))val=ovCol;
    if(val)g[y][x]=val;
  }
  // centre
  if(centerStyle==="dot"||centerStyle==="ring")g[c][c]=colC;
  else if(centerStyle==="cross"){g[c][c]=colC;if(g[c-1])g[c-1][c]=colC;if(g[c+1])g[c+1][c]=colC;g[c][c-1]=colC;g[c][c+1]=colC;}
  else {g[c][c]=colA;if(g[c-1])g[c-1][c]=colC;if(g[c+1])g[c+1][c]=colC;g[c][c-1]=colC;g[c][c+1]=colC;}
  if(hooks){const cr=[[0,0,1,1],[m-1,0,-1,1],[0,m-1,1,-1],[m-1,m-1,-1,-1]];
    for(const[sx,sy,dx,dy]of cr){g[sy][sx]=colB;if(g[sy+dy])g[sy+dy][sx]=colB;g[sy][sx+dx]=colB;}}
  if(tips){g[0][c]=colA;g[m-1][c]=colA;g[c][0]=colA;g[c][m-1]=colA;}
  return g;
}
function makeFiller(){
  const m=pick([3,3,5]), g=newGrid(m,m), c=(m-1)/2, col=pick(CFG.theme.colors), k=pick(["dot","cross","diamond","x"]);
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){const ax=Math.abs(x-c),ay=Math.abs(y-c),dm=ax+ay,dd=Math.abs(ax-ay);
    let val=0;if(k==="dot"&&dm===0)val=col;if(k==="cross"&&(x===c||y===c))val=col;if(k==="diamond"&&dm===c)val=col;if(k==="x"&&dd===0)val=col;
    if(val)g[y][x]=val;}
  return g;
}

/* ===================== FIELD-FUNCTION MOTIF ENGINE =====================
 * A motif = a stack of math "layers" summed into a scalar field over
 * symmetry-folded coordinates, then quantized to discrete stitches.
 * PURE: makeFieldMotif(m, genome) depends only on its args (no CFG). */
function fieldCoord(kind, ax, ay, R){
  switch(kind){
    case 'radial':    return Math.hypot(ax,ay)/R;
    case 'manhattan': return (ax+ay)/(2*R);
    case 'chebyshev': return Math.max(ax,ay)/R;
    case 'diagonal':  return Math.abs(ax-ay)/R;
    case 'angle':     return Math.atan2(ay,ax)/(Math.PI/2);   // 0..1 over a quadrant
    case 'lattice':   return ((ax%2)+(ay%2))/2;               // 0,0.5,1
    default:          return Math.hypot(ax,ay)/R;
  }
}
function fieldWave(kind, t){
  switch(kind){
    case 'cos': return Math.cos(t*2*Math.PI);
    case 'tri': { const p=((t%1)+1)%1; return 1-4*Math.abs(p-0.5); }
    case 'sq':  return Math.cos(t*2*Math.PI)>=0 ? 1 : -1;
    default:    return Math.cos(t*2*Math.PI);
  }
}
function applyCenter(g, c, style, col){
  if(style==='none') return;
  if(style==='dot'||style==='ring'){ g[c][c]=col; return; }
  g[c][c]=col; if(g[c-1])g[c-1][c]=col; if(g[c+1])g[c+1][c]=col;
  if(c-1>=0)g[c][c-1]=col; if(c+1<g.length)g[c][c+1]=col;
}
// genome = { sym:'d4'|'d2'|'loose', layers:[{coord,wave,freq,phase,weight,slot}], levels:Int, centerStyle:str }
function makeFieldMotif(m, G){
  const g=newGrid(m,m), c=(m-1)/2, R=Math.max(1,c);
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){
    let ax=Math.abs(x-c), ay=Math.abs(y-c);
    if(G.sym==='d4' && ax<ay){ const t=ax; ax=ay; ay=t; }   // fold diagonal -> 8-fold
    if(G.sym!=='loose' && Math.hypot(x-c,y-c) > R+0.5) continue;   // d4/d2 clip to a disc; loose fills the square
    let F=0, wsum=0;
    for(const L of G.layers){
      F += L.weight*fieldWave(L.wave, fieldCoord(L.coord,ax,ay,R)*L.freq + L.phase);
      wsum += Math.abs(L.weight);
    }
    F = wsum ? F/wsum : 0;                                   // normalize to ~[-1,1]
    const band = Math.floor(((F+1)/2)*G.levels);            // 0..levels
    if(band >= Math.ceil(G.levels/2)){
      const L = G.layers[band % G.layers.length];
      g[y][x] = L.slot;                                      // slot is already a 1-based thread index
    }
  }
  applyCenter(g, c, G.centerStyle, G.layers[0].slot);
  // non-empty floor: never return a fully blank motif
  let any=false; for(const r of g){ for(const v of r){ if(v){any=true;break;} } if(any)break; }
  if(!any) g[c][c]=G.layers[0].slot;
  return g;
}

// aim = { ornate:1..5, wild:0..1, tradition:0..1, symmetry:'d4'|'d2'|'loose' }
function sampleGenome(P, aim){
  const tr=aim.tradition, wild=aim.wild, ornate=aim.ornate;
  const coordsTrad=['radial','manhattan','chebyshev'];
  const coordsInv =['radial','manhattan','chebyshev','diagonal','angle','lattice'];
  const nLayers=Math.max(1, Math.min(4, Math.round(1 + (ornate-1)*0.6 + tr*1.5)));
  const layers=[];
  for(let i=0;i<nLayers;i++){
    // tradition unlocks chaos progressively: exotic coords >0.4, square waves >0.5, free freq/phase >=0.3
    const coord = pick(tr>0.4 ? coordsInv : coordsTrad);
    const wave  = pick(tr>0.5 ? ['cos','tri','sq'] : ['cos','tri']);
    const freq  = tr<0.3 ? ri(1,3) : (1 + RNG()*wild*(1+tr*5));
    const phase = (tr<0.3?0:RNG()) * wild;
    const weight= (1 - 0.5*wild) + RNG()*wild*1.2;   // wild widens layer-weight spread everywhere
    const slot  = pick(P.colorBias)+1;            // 1-based thread index
    layers.push({coord,wave,freq,phase,weight,slot});
  }
  const levels = 2 + Math.round(ornate*0.8 + tr*3);
  const centerStyle = pick(['dot','cross','ring','none']);
  return { sym: aim.symmetry||'d4', layers, levels, centerStyle };
}

/* ===================== HERO MOTIFS — chart library mixed into procedural pool ===================== */
// map semantic slots (1=primary,2=secondary,3=accent) -> palette thread indices
function remapHero(g){
  const P=CFG.P, slot=[0, P.colorBias[0]+1, (P.colorBias[1]??P.colorBias[0])+1, P.threads.length];
  return g.map(row=>{const r=new Int8Array(row.length);
    for(let x=0;x<row.length;x++){const s=row[x]; r[x]=s?slot[Math.min(s,3)]:0;} return r;});
}
function heroForRegion(region){
  return (VY.HERO_MOTIFS||[]).filter(h=>!h.regions.length||h.regions.includes(region));
}
// pure selection: which source for a given roll r, tradition tr, hero availability
function pickSource(r, tr, hasHero){
  if(r < tr) return 'field';                 // tradition high -> more field (invention)
  const rest=r-tr, span=Math.max(1e-6, 1-tr);
  if(hasHero && rest < span*0.5) return 'hero';
  return 'archetype';
}
function genomeForCFG(m){
  const aim={ornate:CFG.dens, wild:CFG.variety, tradition:CFG.tradition, symmetry:CFG.symmetry};
  const base=sampleGenome(CFG.P, aim);
  return CFG.lab ? mergeGenome(base, CFG.lab) : base;
}
// merge partial lab overrides onto a sampled genome (overridden fields win)
function mergeGenome(base, lab){
  const out={ sym: lab.sym||base.sym, levels: lab.levels||base.levels,
              centerStyle: lab.centerStyle||base.centerStyle, layers: base.layers.map(l=>({...l})) };
  if(Array.isArray(lab.layers)){
    out.layers = lab.layers.map((lo,i)=>({ ...(base.layers[i]||base.layers[0]), ...lo }));
  }
  return out;
}
function pickMotif(m){
  const tr=CFG.tradition, pool=heroForRegion(CFG.region);
  const src=pickSource(RNG(), tr, pool.length>0);
  if(src==='field') return makeFieldMotif(m, genomeForCFG(m));
  if(src==='hero')  return remapHero(pick(pool).grid);
  return makeMotif(m);
}

/* ===================== bands ===================== */
function borderBand(cols){
  const P=CFG.P, kind=pick(["diamonds","zigzag","meander","hatch"]);
  const cA=pick(P.colorBias)+1, cB=((cA)%P.threads.length)+1;
  if(kind==="diamonds"){
    const r=ri(1,2),h=2*r+1,period=h+ri(1,2),g=newGrid(cols,h);
    for(let cx=period/2|0;cx<cols;cx+=period)for(let y=0;y<h;y++)for(let x=-r;x<=r;x++){
      const px=cx+x;if(px<0||px>=cols)continue;const dm=Math.abs(x)+Math.abs(y-r);
      if(dm===r)g[y][px]=cA;if(dm===0)g[y][px]=cB;}
    return g;
  }
  if(kind==="zigzag"){
    const amp=ri(1,2),h=2*amp+1,period=ri(3,5)*2,g=newGrid(cols,h);
    const tri=(x)=>{const t=((x%period)+period)%period,half=period/2;return t<half?t/half:(period-t)/half;};
    for(let x=0;x<cols;x++){const y=Math.round(amp+(tri(x)*2-1)*amp);if(g[y])g[y][x]=cA;}
    return g;
  }
  if(kind==="meander"){
    const h=5,period=6,g=newGrid(cols,h),seg=[[0,2],[1,2],[2,2],[2,1],[2,0],[3,0],[4,0],[4,1],[4,2]];
    for(let bx=0;bx<cols;bx+=period)for(const [dx,dy] of seg){const px=bx+dx;if(px>=0&&px<cols)g[dy][px]=cA;}
    return g;
  }
  const h=3,g=newGrid(cols,h);
  for(let x=0;x<cols;x++){if((x%4)<2){g[0][x]=cA;g[2][x]=cA;}g[1][x]=chance(.5)?cB:0;}
  return g;
}
function separator(cols){
  const P=CFG.P, cA=pick(P.colorBias)+1, kind=pick(["solid","dotted","double"]);
  if(kind==="solid"){const g=newGrid(cols,1);for(let x=0;x<cols;x++)g[0][x]=cA;return g;}
  if(kind==="double"){const g=newGrid(cols,3);for(let x=0;x<cols;x++){g[0][x]=cA;g[2][x]=cA;}return g;}
  const g=newGrid(cols,1);for(let x=0;x<cols;x++)if(x%2===0)g[0][x]=cA;return g;
}
function mainBand(cols,m){
  const motif=pickMotif(m),pad=1,gap=Math.max(1,Math.round(m*(0.3+CFG.variety*0.3))),period=m+gap;
  const count=Math.max(1,Math.floor((cols+gap)/period)),total=count*period-gap,start=Math.floor((cols-total)/2);
  const g=newGrid(cols,m+pad*2),alt=CFG.variety>0.5?pickMotif(m):motif;
  for(let i=0;i<count;i++)blit(g,(i%2?alt:motif),start+i*period,pad);
  return g;
}
function borderStrip(cols,layers){
  const parts=[];for(let i=0;i<layers;i++){parts.push(borderBand(cols));if(i<layers-1)parts.push(separator(cols));}
  const h=parts.reduce((s,b)=>s+b.length,0),g=newGrid(cols,h);let y=0;for(const b of parts){blit(g,b,0,y);y+=b.length;}return g;
}

/* ===================== PANEL composition ===================== */
function composePanel(shape){
  const P=CFG.P, dens=CFG.dens, m=[7,9,9,11,13][dens-1];let cols,spec=[];
  const B=()=>spec.push(borderBand(cols)),S=()=>spec.push(separator(cols)),M=(mm)=>spec.push(mainBand(cols,mm||m));
  if(shape==="sleeve"){cols=[31,35,39,43,47][dens-1];const reps=[3,4,5,6,7][dens-1];B();S();for(let i=0;i<reps;i++){M();S();}B();}
  else if(shape==="collar"){cols=[110,130,150,160,170][dens-1];B();S();M();S();B();}
  else if(shape==="rushnyk"){cols=[45,51,55,61,67][dens-1];B();S();M(m);S();M(m+4);S();M(m);S();B();}
  else return sampler();
  const rows=spec.reduce((s,b)=>s+b.length,0),grid=newGrid(cols,rows);let y=0;for(const b of spec){blit(grid,b,0,y);y+=b.length;}
  return {grid,cols,rows,palette:P};
}
function sampler(){
  const P=CFG.P, G=[3,3,4,4,5][CFG.dens-1],m=11,gap=2,cell=m+gap,cols=G*cell+gap,rows=G*cell+gap,grid=newGrid(cols,rows);
  for(let r=0;r<G;r++)for(let c=0;c<G;c++)blit(grid,pickMotif(m),gap+c*cell,gap+r*cell);
  const cA=P.colorBias[0]+1;for(let x=0;x<cols;x++){grid[0][x]=cA;grid[rows-1][x]=cA;}for(let y=0;y<rows;y++){grid[y][0]=cA;grid[y][cols-1]=cA;}
  return {grid,cols,rows,palette:P};
}

/* ===================== WALLPAPER composition ===================== */
function composeWallpaper(W,H,layout,scaleKey){
  const P=CFG.P, dens=CFG.dens, v=CFG.variety;
  const base={small:5,medium:8,large:12}[scaleKey];
  const cell=Math.max(4,Math.round(base*H/1080));
  const cols=Math.round(W/cell),rows=Math.round(H/cell),grid=newGrid(cols,rows);
  const m=[7,9,9,11,13][dens-1];

  if(layout==="fabric"){
    const mm=[9,11,13][{small:0,medium:1,large:2}[scaleKey]];
    const setN=Math.max(1,1+Math.round(v*3));
    const motifs=[];for(let i=0;i<setN;i++)motifs.push(pickMotif(mm));
    const latt=pick(v>0.5?["straight","brick","diamond"]:["straight","brick"]);
    const gap=Math.max(2,Math.round(mm*(0.3+(chance(v)?0.35:0))));
    const period=mm+gap;
    const vstep=latt==="diamond"?Math.max(4,Math.round(period*0.55)):period;
    const useFiller=(dens>=3||v>0.45);
    const filler=useFiller?makeFiller():null;
    let row=0;
    for(let gy=-mm;gy<rows;gy+=vstep,row++){
      const off=(latt!=="straight"&&row%2)?Math.round(period/2):0;
      let i=0;
      for(let gx=-mm+off;gx<cols;gx+=period,i++){
        const idx=v>0.75?ri(0,setN-1):(row+i)%setN;
        blit(grid,motifs[idx],gx,gy);
        if(filler) blit(grid,filler,gx+Math.round(period/2),gy+Math.round(vstep/2));
      }
    }
  }
  else if(layout==="bordered"){
    const margin=Math.max(2,Math.round(rows*0.04)),layers=Math.min(3,1+Math.round(dens/2));
    const top=borderStrip(cols,layers);
    blit(grid,top,0,margin); blit(grid,top,0,rows-margin-top.length);
    const side=transpose(borderStrip(rows,layers));
    blit(grid,side,margin,0); blit(grid,side,cols-margin-side[0].length,0);
    const inset=margin+top.length+1, cmA=pickMotif(m+2), cmB=pickMotif(m+2);
    blit(grid,cmA,inset,inset); blit(grid,cmB,cols-inset-(m+2),inset);
    blit(grid,cmB,inset,rows-inset-(m+2)); blit(grid,cmA,cols-inset-(m+2),rows-inset-(m+2));
  }
  else if(layout==="runner"){
    const mm=m+2,ribW=mm+4,ribbon=newGrid(ribW,rows),cEdge=pick(P.colorBias)+1;
    const gap=Math.max(2,Math.round(mm*(0.4+v*0.3))),period=mm+gap,startY=Math.round((rows%period)/2);
    let i=0;for(let gy=startY;gy+mm<=rows;gy+=period,i++) blit(ribbon,pickMotif(mm),Math.round((ribW-mm)/2),gy);
    for(let y=0;y<rows;y++){ribbon[y][0]=cEdge;ribbon[y][ribW-1]=cEdge;}
    const x0=Math.round(cols*0.07);
    blit(grid,ribbon,x0,0);
    if(dens>=3) blit(grid,ribbon,cols-x0-ribW,0);
  }
  else {
    const big=(Math.round(Math.min(cols,rows)*0.5)|1);
    blit(grid,makeMotif(big),Math.round((cols-big)/2),Math.round((rows-big)/2)); // keep procedural: a small hero grid would look sparse at giant centerpiece size
    const pad=Math.max(3,Math.round(rows*0.06));
    const cmA=pickMotif(m+2),cmB=pickMotif(m+2);
    blit(grid,cmA,pad,pad);blit(grid,cmB,cols-pad-(m+2),pad);
    blit(grid,cmB,pad,rows-pad-(m+2));blit(grid,cmA,cols-pad-(m+2),rows-pad-(m+2));
    const frame=transpose(borderStrip(rows,1));blit(grid,frame,1,0);blit(grid,frame,cols-frame[0].length-1,0);
  }
  return {grid,cols,rows,cell,palette:P,W,H};
}

/* ===================== seamless fabric tile ===================== */
function composeFabricTile(scaleKey){
  const P=CFG.P, v=CFG.variety;
  const mm=[9,11,13][{small:0,medium:1,large:2}[scaleKey]];
  const gap=Math.max(2,Math.round(mm*0.35)), period=mm+gap;
  const latt=pick(v>0.5?["straight","brick","diamond"]:["straight","brick"]);
  const cols=latt==="straight"?period:period*2;
  const rows=latt==="straight"?period:period*2;
  const grid=newGrid(cols,rows);
  const setN=Math.max(1,1+Math.round(v*3)), motifs=[];
  for(let i=0;i<setN;i++) motifs.push(pickMotif(mm));
  const filler=(CFG.dens>=3||v>0.45)?makeFiller():null;
  let row=0;
  for(let gy=0; gy<rows; gy+=period, row++){
    const off=(latt!=="straight"&&row%2)?Math.round(period/2):0;
    let i=0;
    for(let gx=off; gx<cols; gx+=period, i++){
      const idx=(row+i)%setN;
      blitWrap(grid, motifs[idx], gx, gy);
      if(filler) blitWrap(grid, filler, gx+Math.round(period/2), gy+Math.round(period/2));
    }
  }
  return {grid,cols,rows,palette:P};
}

/* ===================== DMC nearest-match ===================== */
function hex2rgbG(h){if(h.toLowerCase()==="blanc")return[255,255,255];
  const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function nearestDMC(hex){
  const t=hex2rgbG(hex); let best=null, bd=Infinity;
  for(const f of (VY.DMC||[])){const c=hex2rgbG(f.hex);
    const d=(c[0]-t[0])**2+(c[1]-t[1])**2+(c[2]-t[2])**2;
    if(d<bd){bd=d; best=f;}}
  return best;
}

/* ===================== exported entry points ===================== */
VY.gen = { composeWallpaper, composePanel, sampler };
VY.gen.nearestDMC = nearestDMC;
VY.gen.composeFabricTile = composeFabricTile;
VY.gen.makeMotif = makeMotif; // expose for reuse by later tasks
VY.gen.makeFieldMotif = makeFieldMotif;
VY.gen.sampleGenome = sampleGenome;
VY.gen.pickMotif = pickMotif;
VY.gen.pickSource = pickSource;
VY.gen.setSeed = (str) => { RNG = mulberry32(hashStr(str)); };
VY.gen.setConfig = (cfg) => {
  Object.assign(CFG, cfg);
  CFG.theme = buildTheme(CFG.P, CFG.variety);
};
VY.gen.hashStr = hashStr;
