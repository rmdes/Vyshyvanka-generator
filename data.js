"use strict";
window.VY = window.VY || {};

/* ===================== regional palettes ===================== */
VY.REGIONS={
  poltava  :{name:"Poltava — red on white, open",        bg:"#f3ece0",
             threads:["#b3271e","#7a1a16","#5c5c5c"], colorBias:[0,0,0,1,2], densityBias:-1,
             note:"Sparse, restrained; red on light linen."},
  hutsul   :{name:"Hutsul — dense polychrome geometric",  bg:"#efe7d6",
             threads:["#c0271f","#141414","#e0a92e","#2f7d4f","#d9762b"], colorBias:[0,1,2,3,4], densityBias:+1,
             note:"Dense, high-contrast; red+black+gold+green+orange."},
  borshchiv:{name:"Borshchiv / Podillia — black-dominant", bg:"#efe8d9",
             threads:["#161616","#0c0c0c","#a02620","#3a3a3a"], colorBias:[0,0,1,0,2], densityBias:+1,
             note:"Heavy black grounds with red accents."},
  bukovyna :{name:"Bukovyna — geometric, lilac & bronze",  bg:"#f0e9da",
             threads:["#b0241d","#161616","#7a5cab","#b08a2e","#2c6e63"], colorBias:[0,1,2,3,4], densityBias:0,
             note:"Fine geometry; red+black, lilac, metallic bronze."},
  polissia :{name:"Polissia — bold red, archaic",          bg:"#f4eee2",
             threads:["#bf2118","#7a140f","#3a3a3a"], colorBias:[0,0,0,1,2], densityBias:0,
             note:"Bold red; archaic geometric banding."},
  chernihiv:{name:"Chernihiv — sparse white/red",          bg:"#f6f1e7",
             threads:["#b8281f","#9c9c9c","#5c5c5c"], colorBias:[0,0,1,2], densityBias:-1,
             note:"Sparse, delicate; red with grey."},
};
VY.applyBg=function applyBg(P,bg){
  if(bg==="linen") return {...P};
  const dark={charcoal:"#241d16", black:"#0d0b09", indigo:"#141d33"}[bg];
  const light="#f0e7d6", accent=P.threads[0];
  return {...P, bg:dark, threads:[light,accent,...P.threads.slice(1)], colorBias:[0,0,0,1,0,1]};
};
