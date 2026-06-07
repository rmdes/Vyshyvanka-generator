"use strict";
window.VY = window.VY || {};

/* ===================== render ===================== */
VY.cv = document.getElementById("cv");
VY.ctx = VY.cv.getContext("2d");
const cv = VY.cv, ctx = VY.ctx;
function lum(hex){const n=parseInt(hex.slice(1),16);return(((n>>16)&255)*.299+((n>>8)&255)*.587+(n&255)*.114)/255;}
function drawGrid(model,cell,ox,oy,style){
  const {grid,cols,rows,palette}=model,ins=cell*0.13,lw=Math.max(1,cell*0.26);
  if(cell>=5){ctx.fillStyle=lum(palette.bg)>0.5?"rgba(90,70,40,.06)":"rgba(240,231,214,.05)";
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)ctx.fillRect(ox+x*cell+cell/2-0.5,oy+y*cell+cell/2-0.5,1,1);}
  ctx.lineCap="round";ctx.lineWidth=lw;
  for(let y=0;y<rows;y++){const r=grid[y];for(let x=0;x<cols;x++){const val=r[x];if(!val)continue;
    const col=palette.threads[val-1],X=ox+x*cell,Y=oy+y*cell;
    if(style==="x"){ctx.strokeStyle=col;ctx.beginPath();
      ctx.moveTo(X+ins,Y+ins);ctx.lineTo(X+cell-ins,Y+cell-ins);
      ctx.moveTo(X+cell-ins,Y+ins);ctx.lineTo(X+ins,Y+cell-ins);ctx.stroke();}
    else{ctx.fillStyle=col;ctx.fillRect(X+ins,Y+ins,cell-2*ins,cell-2*ins);}}}
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
