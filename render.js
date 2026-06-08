"use strict";
window.VY = window.VY || {};

/* ===================== render ===================== */
VY.cv = document.getElementById("cv");
VY.ctx = VY.cv.getContext("2d");
const cv = VY.cv; let ctx = VY.ctx;
function setCtx(c){ ctx = c; }
function lum(hex){const n=parseInt(hex.slice(1),16);return(((n>>16)&255)*.299+((n>>8)&255)*.587+(n&255)*.114)/255;}
function hex2rgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function rgb2css(r,g,b){return `rgb(${r|0},${g|0},${b|0})`;}
function shade(hex,f){const[r,g,b]=hex2rgb(hex);return f>=0?rgb2css(r+(255-r)*f,g+(255-g)*f,b+(255-b)*f):rgb2css(r*(1+f),g*(1+f),b*(1+f));}
// deterministic per-cell jitter in [-amt,amt], seeded by (x,y,seedNum)
function cellJitter(x,y,seedNum,amt){let h=(x*73856093)^(y*19349663)^seedNum;h=Math.imul(h^(h>>>13),1274126177);return((((h>>>0)/4294967296)*2-1)*amt);}
function drawGrid(model, cell, ox, oy, style, seedNum){
  const {grid, cols, rows, palette} = model, ins = cell*0.13, lw = Math.max(1, cell*0.26);
  // --- aida weave (only when cells are big enough to read) ---
  if (cell >= 5){
    const dark = lum(palette.bg) > 0.5;
    ctx.fillStyle = dark ? "rgba(90,70,40,.07)" : "rgba(240,231,214,.06)";
    const hole = Math.max(1, cell*0.16);
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
      const cx = ox+x*cell, cy = oy+y*cell;
      ctx.fillRect(cx+cell/2-hole/2, cy+cell/2-hole/2, hole, hole); // weave hole
    }
  }
  ctx.lineCap = "round";
  for (let y=0;y<rows;y++){ const r = grid[y];
    for (let x=0;x<cols;x++){ const val = r[x]; if(!val) continue;
      const base = palette.threads[val-1];
      const j = cellJitter(x, y, seedNum, 0.10);   // ±10% lightness
      const col = shade(base, j*0.5);
      const X = ox+x*cell, Y = oy+y*cell;
      if (style === "x"){
        ctx.lineWidth = lw;
        ctx.strokeStyle = shade(base, -0.28);
        ctx.beginPath();
        ctx.moveTo(X+ins,Y+ins); ctx.lineTo(X+cell-ins,Y+cell-ins);
        ctx.moveTo(X+cell-ins,Y+ins); ctx.lineTo(X+ins,Y+cell-ins); ctx.stroke();
        ctx.lineWidth = lw*0.6; ctx.strokeStyle = col;
        const o = lw*0.18;
        ctx.beginPath();
        ctx.moveTo(X+ins-o,Y+ins-o); ctx.lineTo(X+cell-ins-o,Y+cell-ins-o);
        ctx.moveTo(X+cell-ins-o,Y+ins-o); ctx.lineTo(X+ins-o,Y+cell-ins-o); ctx.stroke();
      } else {
        ctx.fillStyle = shade(base, -0.18);
        ctx.fillRect(X+ins, Y+ins, cell-2*ins, cell-2*ins);
        ctx.fillStyle = col;
        ctx.fillRect(X+ins, Y+ins, (cell-2*ins)*0.78, (cell-2*ins)*0.78);
      }
    }
  }
}
function buildTileCanvas(model, cell, style, seedNum){
  const c=document.createElement("canvas");
  c.width=model.cols*cell; c.height=model.rows*cell;
  const tctx=c.getContext("2d");
  tctx.fillStyle=model.palette.bg; tctx.fillRect(0,0,c.width,c.height);
  const save=ctx; setCtx(tctx); drawGrid(model, cell, 0, 0, style, seedNum); setCtx(save);
  return c;
}
// one 256px tile of a finite piece at device cell dCell, by slicing the grid (drawGrid clips to the tile)
function rasterTile(model, dCell, tx, ty, style, seedNum, bg, TILE){
  const c=document.createElement("canvas"); c.width=TILE; c.height=TILE;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,TILE,TILE);
  const save=ctx; setCtx(g);
  drawGrid(model, dCell, -tx*TILE, -ty*TILE, style, seedNum);
  setCtx(save);
  return c;
}
// one 256px tile of a seamless wallpaper, pattern-filled with the world-correct phase so tiles join
function rasterSeamlessTile(tileModel, dCell, tx, ty, style, seedNum, bg, TILE){
  const tile=buildTileCanvas(tileModel, dCell, style, seedNum);   // one repeat at dCell
  const c=document.createElement("canvas"); c.width=TILE; c.height=TILE;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,TILE,TILE);
  const ox=((tx*TILE)%tile.width+tile.width)%tile.width, oy=((ty*TILE)%tile.height+tile.height)%tile.height;
  g.save(); g.translate(-ox,-oy);
  g.fillStyle=g.createPattern(tile,"repeat"); g.fillRect(0,0,TILE+tile.width,TILE+tile.height);
  g.restore();
  return c;
}

/* ===================== counted-stitch chart ===================== */
const CHART_SYMBOLS = ["✚","◆","▲","●","■","✖","★","◐","◢","✦","◇","▼"];
function renderChart(model){
  const {grid,cols,rows,palette}=model;
  const cell=18, padL=46, padT=46, legendH=24*(palette.threads.length)+40;
  const c=document.createElement("canvas");
  c.width=padL+cols*cell+20; c.height=padT+rows*cell+legendH;
  const g=c.getContext("2d");
  g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height);
  g.textAlign="center"; g.textBaseline="middle"; g.font=`${cell-4}px monospace`;
  const counts=new Array(palette.threads.length+1).fill(0);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const v=grid[y][x]; if(v){counts[v]++;
    g.fillStyle="#222"; g.fillText(CHART_SYMBOLS[(v-1)%CHART_SYMBOLS.length], padL+x*cell+cell/2, padT+y*cell+cell/2);}}
  for(let x=0;x<=cols;x++){g.strokeStyle=(x%10===0)?"#333":"#ccc"; g.lineWidth=(x%10===0)?1.4:0.5;
    g.beginPath(); g.moveTo(padL+x*cell,padT); g.lineTo(padL+x*cell,padT+rows*cell); g.stroke();}
  for(let y=0;y<=rows;y++){g.strokeStyle=(y%10===0)?"#333":"#ccc"; g.lineWidth=(y%10===0)?1.4:0.5;
    g.beginPath(); g.moveTo(padL,padT+y*cell); g.lineTo(padL+cols*cell,padT+y*cell); g.stroke();}
  g.fillStyle="#555"; g.font="11px monospace";
  for(let x=0;x<=cols;x+=10) g.fillText(String(x), padL+x*cell, padT-12);
  for(let y=0;y<=rows;y+=10) g.fillText(String(y), padL-22, padT+y*cell);
  let ly=padT+rows*cell+28; g.textAlign="left";
  for(let i=1;i<=palette.threads.length;i++){
    if(!counts[i]) continue;
    const dmc=VY.gen.nearestDMC(palette.threads[i-1]);
    g.fillStyle=palette.threads[i-1]; g.fillRect(padL, ly-9, 18, 18);
    g.strokeStyle="#333"; g.strokeRect(padL, ly-9, 18, 18);
    g.fillStyle="#222"; g.font="14px monospace"; g.textAlign="center";
    g.fillText(CHART_SYMBOLS[(i-1)%CHART_SYMBOLS.length], padL+34, ly);
    g.textAlign="left";
    g.fillText(`DMC ${dmc?dmc.code:"?"} — ${dmc?dmc.name:""}  ×${counts[i]}`, padL+52, ly);
    ly+=24;
  }
  return c;
}

VY.render = { drawGrid, lum, buildTileCanvas, setCtx, renderChart, rasterTile, rasterSeamlessTile };
