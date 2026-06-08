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

  // ---- tile-source math (pure; device-pixel tile grid at scale dCell) ----
  // inclusive tile-index range covering the visible stage (+overscan), centered on stitch (cx,cy)
  function tilesFor(cx, cy, W, H, dCell, DPR, TILE, over){
    const cxd=cx*dCell, cyd=cy*dCell, halfW=W*DPR/2+over, halfH=H*DPR/2+over;
    return { tx0:Math.floor((cxd-halfW)/TILE), tx1:Math.floor((cxd+halfW)/TILE),
             ty0:Math.floor((cyd-halfH)/TILE), ty1:Math.floor((cyd+halfH)/TILE) };
  }
  // top-left of tile (tx,ty) in the canvas backing store (device px)
  function tileDest(tx, ty, cx, cy, W, H, dCell, DPR, TILE){
    return { x: tx*TILE - cx*dCell + W*DPR/2, y: ty*TILE - cy*dCell + H*DPR/2 };
  }
  // residual CSS transform: a canvas painted at `renderCell` CSS px/stitch (centered on the view
  // center) shown at vp.zoom. transform-origin:0 0.
  function residualTransform(vp, renderCell, W, H){
    const S=vp.zoom/renderCell;
    return { S, Tx:(W/2)*(1-S), Ty:(H/2)*(1-S) };
  }

  let PIECE=null, VP=null, rasterCanvas=null;
  const DPR=Math.max(1, Math.min(3, window.devicePixelRatio||1)); // captured at load; a display-ratio change needs a reload
  let curDeviceCell=0;
  function maxCellFor(){ if(!PIECE) return 9999; return Math.max(1, Math.floor(16000/Math.max(PIECE.cols,PIECE.rows))); }
  function stageSize(){ const s=document.querySelector(".stage"); return [s.clientWidth, s.clientHeight]; }
  function applyTransform(){ if(!rasterCanvas||!VP) return; const [W,H]=stageSize();
    const {S,Tx,Ty}=residualTransform(VP, renderCell, W, H);
    rasterCanvas.style.transform=`translate(${Tx}px,${Ty}px) scale(${S})`; updateHud(); }
  const TILE=256, OVER=256; let cache=new Map(); const CACHE_MAX=64; let renderCell=0;
  function tileFor(dCell,tx,ty){ const k=dCell+":"+tx+":"+ty;
    if(cache.has(k)){ const c=cache.get(k); cache.delete(k); cache.set(k,c); return c; }
    const c=PIECE.rasterTile(dCell,tx,ty);
    cache.set(k,c); while(cache.size>CACHE_MAX){ cache.delete(cache.keys().next().value); } return c;
  }
  // paint the visible tiles (+overscan) into the stage-sized canvas at the view center, using `cell`
  function retile(cell){
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    const [W,H]=stageSize(); renderCell=cell; const dCell=Math.round(cell*DPR);
    const bw=Math.round(W*DPR), bh=Math.round(H*DPR);
    if(VY.cv.width!==bw||VY.cv.height!==bh){ VY.cv.width=bw; VY.cv.height=bh; }
    VY.cv.style.width=W+"px"; VY.cv.style.height=H+"px";
    VY.ctx.setTransform(1,0,0,1,0,0); VY.ctx.clearRect(0,0,bw,bh);
    const {tx0,tx1,ty0,ty1}=tilesFor(VP.cx,VP.cy,W,H,dCell,DPR,TILE,OVER);
    for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){
      const d=tileDest(tx,ty,VP.cx,VP.cy,W,H,dCell,DPR,TILE);
      VY.ctx.drawImage(tileFor(dCell,tx,ty), Math.round(d.x), Math.round(d.y));
    }
    rasterCanvas=VY.cv; curDeviceCell=dCell; applyTransform();
  }
  function attach(piece, restoreView){
    cache=new Map(); PIECE=piece; const [W,H]=stageSize();
    VP = restoreView ? clampView({...restoreView, fitZoom:fitView(piece,W,H).fitZoom}, piece, W,H)
                     : fitView(piece, W, H);
    retile(transformFor(VP,W,H).cell);
  }
  function getView(){ return VP?{cx:VP.cx,cy:VP.cy,zoom:VP.zoom}:null; }
  function isFit(){ if(!PIECE||!VP) return true; const [W,H]=stageSize(); const f=fitView(PIECE,W,H);
    return Math.abs(VP.zoom-f.zoom)<1e-3 && Math.abs(VP.cx-f.cx)<1e-3 && Math.abs(VP.cy-f.cy)<1e-3; }
  function fit(){ if(!PIECE) return; const [W,H]=stageSize(); VP=fitView(PIECE,W,H); retile(transformFor(VP,W,H).cell);
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), true); }
  function updateHud(){ const el=document.getElementById("vpZoom"); if(el&&VP) el.textContent=Math.round(VP.zoom/(VP.fitZoom||VP.zoom)*100)+"%"; }

  let raf=0, settleT=0;
  function schedule(){ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; retile(renderCell); }); }
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    retile(transformFor(VP,W,H).cell);
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), isFit()); }, 130); }
  function liveCommit(){ const [W,H]=stageSize(); VP=clampView(VP,PIECE,W,H); schedule(); settle(); }
  function init(){
    const stage=document.querySelector(".stage");
    stage.addEventListener("wheel",(e)=>{ if(!PIECE) return; e.preventDefault();
      const r=stage.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      const dy=e.deltaMode===1 ? e.deltaY*16 : e.deltaMode===2 ? e.deltaY*400 : e.deltaY;
      const factor=Math.exp(-dy*0.0015);
      VP=zoomAt(VP, factor, sx, sy, r.width, r.height); liveCommit();
    },{passive:false});
    let dragging=false, lastX=0, lastY=0;
    stage.addEventListener("pointerdown",(e)=>{ if(!PIECE||e.pointerType==="touch") return; if(e.target.closest&&e.target.closest(".vphud")) return; dragging=true; lastX=e.clientX; lastY=e.clientY;
      stage.setPointerCapture(e.pointerId); stage.classList.add("grabbing"); });
    stage.addEventListener("pointermove",(e)=>{ if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      VP={...VP, cx:VP.cx-dx/VP.zoom, cy:VP.cy-dy/VP.zoom}; liveCommit(); });
    const up=()=>{ if(!dragging) return; dragging=false; stage.classList.remove("grabbing"); settle(); }; // restart the settle timer from release, not the last move
    stage.addEventListener("pointerup",up); stage.addEventListener("pointercancel",up);
    stage.addEventListener("dblclick",(e)=>{ if(!PIECE) return; const r=stage.getBoundingClientRect();
      VP=zoomAt(VP, e.shiftKey?0.5:2, e.clientX-r.left, e.clientY-r.top, r.width, r.height); liveCommit(); });
    let pts=new Map(), pinch0=0, pinchVP=null, pmid=null;
    stage.addEventListener("pointerdown",(e)=>{ if(e.pointerType!=="touch")return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
    stage.addEventListener("pointermove",(e)=>{ if(e.pointerType!=="touch"||!pts.has(e.pointerId))return;
      const p=pts.get(e.pointerId); const lx=p.x, ly=p.y; p.x=e.clientX; p.y=e.clientY;
      const arr=[...pts.values()];
      if(pts.size===2){ const [a,b]=arr; const r=stage.getBoundingClientRect();
        const dist=Math.hypot(a.x-b.x,a.y-b.y);
        const mx=(a.x+b.x)/2-r.left, my=(a.y+b.y)/2-r.top;
        if(!pinch0){ pinch0=dist; pinchVP=VP; pmid=[mx,my]; }
        else { VP=zoomAt(pinchVP, dist/pinch0, pmid[0], pmid[1], r.width, r.height); liveCommit(); }
      } else if(pts.size===1){ VP={...VP, cx:VP.cx-(e.clientX-lx)/VP.zoom, cy:VP.cy-(e.clientY-ly)/VP.zoom}; liveCommit(); }
    });
    const tup=(e)=>{ if(e.pointerType!=="touch")return; pts.delete(e.pointerId); if(pts.size<2){ pinch0=0; pinchVP=null; } };
    stage.addEventListener("pointerup",tup); stage.addEventListener("pointercancel",tup);
    window.addEventListener("keydown",(e)=>{ if(!PIECE) return; const tag=(e.target.tagName||"").toLowerCase();
      if(tag==="input"||tag==="select"||tag==="textarea"||tag==="button") return; const [W,H]=stageSize();
      if(e.key==="+"||e.key==="="){ VP=zoomAt(VP,1.25,W/2,H/2,W,H); liveCommit(); }
      else if(e.key==="-"||e.key==="_"){ VP=zoomAt(VP,0.8,W/2,H/2,W,H); liveCommit(); }
      else if(e.key==="0"){ fit(); }
      else if(e.key==="ArrowLeft"){ VP={...VP,cx:VP.cx-20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowRight"){ VP={...VP,cx:VP.cx+20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowUp"){ VP={...VP,cy:VP.cy-20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowDown"){ VP={...VP,cy:VP.cy+20/VP.zoom}; liveCommit(); }
      else return; e.preventDefault(); });
    const rb=document.getElementById("vpReset"); if(rb) rb.onclick=fit;
    let _resizeT;
    window.addEventListener("resize",()=>{ clearTimeout(_resizeT); _resizeT=setTimeout(()=>{ if(PIECE) attach(PIECE, getView()); }, 120); }); // refit at new size; hash stays from last onSettle (may be briefly stale until next interaction)
  }

  VY.viewport = { LODS, ZMAX, cellForLod, lodForZoom, screenToPattern, patternToScreen,
                  fitView, clampView, zoomAt, transformFor, tilesFor, tileDest, residualTransform,
                  attach, init, fit, getView, isFit };
})();
