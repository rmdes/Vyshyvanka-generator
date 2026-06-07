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

/* ===================== HERO MOTIFS — documented regional charts =====================
 * Best-effort INTERPRETATIONS of documented Ukrainian vyshyvanka motifs, NOT exact
 * reproductions. Semantic slots: 0=empty, 1=primary, 2=secondary, 3=accent.
 * Each grid is odd-sized & square; symmetric; tagged with region keys ([]=any region).
 * Region keys: poltava, hutsul, borshchiv, bukovyna, polissia, chernihiv. */
VY.HERO_MOTIFS=[
  // Eight-point star / Alatyr — pan-Slavic protective star, common Hutsul/Bukovyna/Polissia.
  // src: https://en.wikipedia.org/wiki/Eight-pointed_star
  { id:"eight-point-star", regions:["hutsul","bukovyna","polissia"], src:"https://en.wikipedia.org/wiki/Eight-pointed_star", grid:[
    [0,0,0,1,0,0,0],
    [1,0,2,1,2,0,1],
    [0,2,0,3,0,2,0],
    [1,1,3,1,3,1,1],
    [0,2,0,3,0,2,0],
    [1,0,2,1,2,0,1],
    [0,0,0,1,0,0,0],
  ]},
  // Ruzha / eight-petal rose — Hutsul polychrome rosette.
  // src: https://www.ukrainian-recipes.com/ukrainian-embroidery-symbols.html
  { id:"ruzha-rose", regions:["hutsul","bukovyna"], src:"https://www.ukrainian-recipes.com/ukrainian-embroidery-symbols.html", grid:[
    [0,0,1,1,1,0,0],
    [0,1,2,2,2,1,0],
    [1,2,3,3,3,2,1],
    [1,2,3,1,3,2,1],
    [1,2,3,3,3,2,1],
    [0,1,2,2,2,1,0],
    [0,0,1,1,1,0,0],
  ]},
  // Berehynia — rhombus-with-hooks, mother/protector goddess, archaic Polissia/Poltava.
  // src: https://en.wikipedia.org/wiki/Berehynia
  { id:"berehynia-rhombus", regions:["polissia","poltava","borshchiv"], src:"https://en.wikipedia.org/wiki/Berehynia", grid:[
    [2,0,0,1,0,0,2],
    [0,2,1,1,1,2,0],
    [0,1,0,3,0,1,0],
    [1,1,3,1,3,1,1],
    [0,1,0,3,0,1,0],
    [0,2,1,1,1,2,0],
    [2,0,0,1,0,0,2],
  ]},
  // Kalyna (guelder-rose) berries — feminine beauty, fate; widespread, esp. Poltava/Chernihiv.
  // src: https://en.wikipedia.org/wiki/Viburnum_opulus#In_Ukrainian_culture
  { id:"kalyna-berries", regions:["poltava","chernihiv","polissia"], src:"https://en.wikipedia.org/wiki/Viburnum_opulus", grid:[
    [0,0,3,1,3,0,0],
    [0,3,1,1,1,3,0],
    [3,1,1,1,1,1,3],
    [1,1,1,2,1,1,1],
    [0,1,1,2,1,1,0],
    [0,0,2,2,2,0,0],
    [0,0,0,2,0,0,0],
  ]},
  // Oak leaves / acorn (dub) — masculine strength, vitality.
  // src: https://www.ukrainian-recipes.com/ukrainian-embroidery-symbols.html
  { id:"oak-leaf", regions:["poltava","chernihiv","hutsul"], src:"https://www.ukrainian-recipes.com/ukrainian-embroidery-symbols.html", grid:[
    [0,0,0,1,0,0,0],
    [0,1,0,1,0,1,0],
    [1,2,1,1,1,2,1],
    [0,1,2,1,2,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,3,0,0,0],
    [0,0,3,3,3,0,0],
  ]},
  // Poppy (mak) — remembrance, beauty; common Poltava/Polissia florals.
  // src: https://en.wikipedia.org/wiki/Vyshyvanka
  { id:"poppy", regions:["poltava","polissia","chernihiv"], src:"https://en.wikipedia.org/wiki/Vyshyvanka", grid:[
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,3,1,3,1,1],
    [1,1,1,3,1,1,1],
    [0,1,3,1,3,1,0],
    [0,0,2,1,2,0,0],
    [0,0,0,2,0,0,0],
  ]},
  // Hutsul polychrome rosette — dense 9x9 layered diamond, high contrast.
  // src: https://en.wikipedia.org/wiki/Hutsuls
  { id:"hutsul-rosette", regions:["hutsul","bukovyna"], src:"https://en.wikipedia.org/wiki/Hutsuls", grid:[
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,2,1,2,0,0,0],
    [0,0,3,2,1,2,3,0,0],
    [0,2,2,3,1,3,2,2,0],
    [1,1,1,1,1,1,1,1,1],
    [0,2,2,3,1,3,2,2,0],
    [0,0,3,2,1,2,3,0,0],
    [0,0,0,2,1,2,0,0,0],
    [0,0,0,0,1,0,0,0,0],
  ]},
  // Bukovyna geometric — fine interlocking diamonds.
  // src: https://en.wikipedia.org/wiki/Bukovina
  { id:"bukovyna-geometric", regions:["bukovyna","borshchiv"], src:"https://en.wikipedia.org/wiki/Bukovina", grid:[
    [1,0,1,0,1,0,1,0,1],
    [0,2,0,2,0,2,0,2,0],
    [1,0,3,0,1,0,3,0,1],
    [0,2,0,1,0,1,0,2,0],
    [1,0,1,0,3,0,1,0,1],
    [0,2,0,1,0,1,0,2,0],
    [1,0,3,0,1,0,3,0,1],
    [0,2,0,2,0,2,0,2,0],
    [1,0,1,0,1,0,1,0,1],
  ]},
  // Borshchiv black cross — black-dominant Podillia, dense cross with red accents.
  // src: https://en.wikipedia.org/wiki/Borshchiv
  { id:"borshchiv-cross", regions:["borshchiv","bukovyna"], src:"https://en.wikipedia.org/wiki/Borshchiv", grid:[
    [1,1,0,1,1,1,0,1,1],
    [1,3,0,1,2,1,0,3,1],
    [0,0,0,2,2,2,0,0,0],
    [1,1,2,1,1,1,2,1,1],
    [1,2,2,1,3,1,2,2,1],
    [1,1,2,1,1,1,2,1,1],
    [0,0,0,2,2,2,0,0,0],
    [1,3,0,1,2,1,0,3,1],
    [1,1,0,1,1,1,0,1,1],
  ]},
  // Wheat / vine of life (vynohrad) — abundance; pan-regional.
  // src: https://en.wikipedia.org/wiki/Tree_of_life
  { id:"tree-of-life", regions:[], src:"https://en.wikipedia.org/wiki/Tree_of_life", grid:[
    [0,0,3,1,3,0,0],
    [0,2,0,1,0,2,0],
    [3,0,2,1,2,0,3],
    [0,2,0,1,0,2,0],
    [0,0,2,1,2,0,0],
    [0,0,0,1,0,0,0],
    [0,1,1,1,1,1,0],
  ]},
  // Cross-in-square — protective amulet; pan-regional simple hero.
  // src: https://en.wikipedia.org/wiki/Solar_symbol
  { id:"solar-cross", regions:[], src:"https://en.wikipedia.org/wiki/Solar_symbol", grid:[
    [1,1,0,0,3,0,0,1,1],
    [1,2,1,0,3,0,1,2,1],
    [0,1,2,1,3,1,2,1,0],
    [0,0,1,2,1,2,1,0,0],
    [3,3,3,1,1,1,3,3,3],
    [0,0,1,2,1,2,1,0,0],
    [0,1,2,1,3,1,2,1,0],
    [1,2,1,0,3,0,1,2,1],
    [1,1,0,0,3,0,0,1,1],
  ]},
  // Rhombus chain diamond — archaic fertility field; pan-regional.
  // src: https://en.wikipedia.org/wiki/Rhombus
  { id:"fertility-diamond", regions:[], src:"https://en.wikipedia.org/wiki/Rhombus", grid:[
    [0,0,0,1,0,0,0],
    [0,0,1,2,1,0,0],
    [0,1,2,3,2,1,0],
    [1,2,3,1,3,2,1],
    [0,1,2,3,2,1,0],
    [0,0,1,2,1,0,0],
    [0,0,0,1,0,0,0],
  ]},
  // Star of Vergina / radiant sun — Poltava restrained radial.
  // src: https://en.wikipedia.org/wiki/Sun_cross
  { id:"radiant-sun", regions:["poltava","chernihiv"], src:"https://en.wikipedia.org/wiki/Sun_cross", grid:[
    [0,0,1,0,1,0,1,0,0],
    [0,0,0,2,1,2,0,0,0],
    [1,0,0,1,1,1,0,0,1],
    [0,2,1,3,3,3,1,2,0],
    [1,1,1,3,1,3,1,1,1],
    [0,2,1,3,3,3,1,2,0],
    [1,0,0,1,1,1,0,0,1],
    [0,0,0,2,1,2,0,0,0],
    [0,0,1,0,1,0,1,0,0],
  ]},
  // Chernihiv delicate cross — sparse white/red, fine geometry.
  // src: https://en.wikipedia.org/wiki/Chernihiv
  { id:"chernihiv-cross", regions:["chernihiv","poltava"], src:"https://en.wikipedia.org/wiki/Chernihiv", grid:[
    [0,0,1,0,0,0,1,0,0],
    [0,2,0,1,0,1,0,2,0],
    [1,0,3,0,1,0,3,0,1],
    [0,1,0,2,1,2,0,1,0],
    [0,0,1,1,3,1,1,0,0],
    [0,1,0,2,1,2,0,1,0],
    [1,0,3,0,1,0,3,0,1],
    [0,2,0,1,0,1,0,2,0],
    [0,0,1,0,0,0,1,0,0],
  ]},
];
