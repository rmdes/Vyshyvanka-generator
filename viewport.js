"use strict";
window.VY = window.VY || {};
(function(){
  const LODS=[1,2,3,4,6,8,12,16,24,32,48];   // stitch cell sizes in CSS px
  const ZMAX=LODS[LODS.length-1];
  function cellForLod(i){ return LODS[Math.max(0,Math.min(LODS.length-1,i))]; }
  function lodForZoom(zoom){ for(let i=0;i<LODS.length;i++){ if(LODS[i]>=zoom) return i; } return LODS.length-1; }

  // viewport vp = { cx, cy, zoom, fitZoom } in PATTERN space (stitch units); zoom = CSS px per stitch
  function screenToPattern(vp, sx, sy, stageW, stageH){
    return { px:(sx-stageW/2)/vp.zoom + vp.cx, py:(sy-stageH/2)/vp.zoom + vp.cy };
  }
  function patternToScreen(vp, px, py, stageW, stageH){
    return { sx:(px-vp.cx)*vp.zoom + stageW/2, sy:(py-vp.cy)*vp.zoom + stageH/2 };
  }
  function fitView(piece, stageW, stageH){
    const zoom=Math.max(0.01, Math.min(stageW/Math.max(1,piece.cols), stageH/Math.max(1,piece.rows)));
    return { cx:piece.cols/2, cy:piece.rows/2, zoom, fitZoom:zoom };
  }
  function clampView(vp, piece, stageW, stageH){
    const fz=vp.fitZoom||fitView(piece,stageW,stageH).fitZoom;
    const zoom=Math.max(fz, Math.min(ZMAX, vp.zoom));
    const cx=Math.max(0, Math.min(piece.cols, vp.cx));
    const cy=Math.max(0, Math.min(piece.rows, vp.cy));
    return { cx, cy, zoom, fitZoom:fz };
  }
  // zoom by `factor` keeping the pattern point under (sx,sy) fixed
  function zoomAt(vp, factor, sx, sy, stageW, stageH){
    const p=screenToPattern(vp, sx, sy, stageW, stageH);
    const zoom=Math.max(vp.fitZoom||0.01, Math.min(ZMAX, vp.zoom*factor));
    return { cx:p.px-(sx-stageW/2)/zoom, cy:p.py-(sy-stageH/2)/zoom, zoom, fitZoom:vp.fitZoom };
  }
  // transform that places the (cols*cell × rows*cell) raster on the stage
  function transformFor(vp, stageW, stageH){
    const lod=lodForZoom(vp.zoom), cell=cellForLod(lod), s=vp.zoom/cell;
    return { lod, cell, s, tx:stageW/2 - vp.cx*vp.zoom, ty:stageH/2 - vp.cy*vp.zoom };
  }

  let PIECE=null, VP=null, rasterCanvas=null, curCell=0;
  function stageSize(){ const s=document.querySelector(".stage"); return [s.clientWidth, s.clientHeight]; }
  function applyTransform(){
    if(!rasterCanvas) return;
    const [W,H]=stageSize(); const t=transformFor(VP,W,H);
    const k=t.cell/curCell; // raster rendered at curCell vs the LOD cell
    rasterCanvas.style.transform=`translate(${t.tx}px,${t.ty}px) scale(${t.s*k})`;
  }
  let cache=new Map(); const CACHE_MAX=6;
  function rasterFor(cell){
    if(cache.has(cell)){ const c=cache.get(cell); cache.delete(cell); cache.set(cell,c); return c; }
    const c=PIECE.rasterAtCell(cell);
    cache.set(cell,c); while(cache.size>CACHE_MAX){ cache.delete(cache.keys().next().value); }
    return c;
  }
  function reraster(){
    const [W,H]=stageSize(); const t=transformFor(VP,W,H); curCell=t.cell;
    const c=rasterFor(curCell);
    VY.cv.width=c.width; VY.cv.height=c.height; VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.clearRect(0,0,c.width,c.height); VY.ctx.drawImage(c,0,0);
    VY.cv.style.width=c.width+"px"; VY.cv.style.height=c.height+"px"; rasterCanvas=VY.cv;
    applyTransform();
  }
  function attach(piece, restoreView){
    cache=new Map();
    PIECE=piece; const [W,H]=stageSize();
    VP = restoreView ? clampView({...restoreView, fitZoom:fitView(piece,W,H).fitZoom}, piece, W,H)
                     : fitView(piece, W, H);
    reraster();
  }
  function getView(){ return VP?{cx:VP.cx,cy:VP.cy,zoom:VP.zoom}:null; }

  let raf=0, settleT=0;
  function schedule(){ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; applyTransform(); }); }
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    if(transformFor(VP,W,H).cell!==curCell) reraster(); else applyTransform(); }, 130); }
  function liveCommit(){ const [W,H]=stageSize(); VP=clampView(VP,PIECE,W,H);
    if(transformFor(VP,W,H).cell!==curCell){ reraster(); } else { schedule(); }
    settle(); }
  function init(){
    const stage=document.querySelector(".stage");
    stage.addEventListener("wheel",(e)=>{ if(!PIECE) return; e.preventDefault();
      const r=stage.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      const factor=Math.exp(-e.deltaY*0.0015);
      VP=zoomAt(VP, factor, sx, sy, r.width, r.height); liveCommit();
    },{passive:false});
    let dragging=false, lastX=0, lastY=0;
    stage.addEventListener("pointerdown",(e)=>{ if(!PIECE||e.pointerType==="touch") return; dragging=true; lastX=e.clientX; lastY=e.clientY;
      stage.setPointerCapture(e.pointerId); stage.classList.add("grabbing"); });
    stage.addEventListener("pointermove",(e)=>{ if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      VP={...VP, cx:VP.cx-dx/VP.zoom, cy:VP.cy-dy/VP.zoom}; liveCommit(); });
    const up=()=>{ if(!dragging) return; dragging=false; stage.classList.remove("grabbing"); settle(); };
    stage.addEventListener("pointerup",up); stage.addEventListener("pointercancel",up);
    let _resizeT;
    window.addEventListener("resize",()=>{ clearTimeout(_resizeT); _resizeT=setTimeout(()=>{ if(PIECE) attach(PIECE, getView()); }, 120); });
  }

  VY.viewport = { LODS, ZMAX, cellForLod, lodForZoom, screenToPattern, patternToScreen,
                  fitView, clampView, zoomAt, transformFor, attach, init, getView };
})();
