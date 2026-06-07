"use strict";
window.VY = window.VY || {};

/* ===================== render ===================== */
VY.cv = document.getElementById("cv");
VY.ctx = VY.cv.getContext("2d");
const cv = VY.cv, ctx = VY.ctx;
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
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
      const cx = ox+x*cell, cy = oy+y*cell, hole = Math.max(1, cell*0.16);
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
let LAST={W:0,H:0};
function fitPreview(W,H){
  LAST={W,H};
  const stage=document.querySelector(".stage");
  const maxW=Math.max(140,(stage.clientWidth||860)-26), maxH=Math.max(140,(stage.clientHeight||600)-26);
  const s=Math.min(maxW/W,maxH/H,1);
  cv.style.width=Math.round(W*s)+"px";cv.style.height=Math.round(H*s)+"px";
}
let resizeT; window.addEventListener("resize",()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>{if(LAST.W)fitPreview(LAST.W,LAST.H);},120);});

VY.render = { drawGrid, fitPreview, lum };
