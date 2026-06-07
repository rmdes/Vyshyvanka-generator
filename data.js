"use strict";
window.VY = window.VY || {};

/* ===================== DMC floss table =====================
 * Common DMC stranded-cotton colours spanning the gamut used by the regional
 * palettes (reds, golds, greens, oranges, violets, blacks, greys, beiges/whites,
 * dark browns/charcoals/indigos). Hex values are reasonable approximations of the
 * real flosses, intended for nearest-colour matching, NOT colour-accurate proofing.
 * Each entry: {code, name, hex}. */
VY.DMC = [
  {code:"blanc", name:"White",              hex:"#ffffff"},
  {code:"B5200", name:"Snow White",         hex:"#fbfbfb"},
  {code:"712",   name:"Cream",              hex:"#f3ecd9"},
  {code:"822",   name:"Lt Beige Grey",      hex:"#e8e0cf"},
  {code:"3865",  name:"Winter White",       hex:"#f1ebdd"},
  {code:"739",   name:"Ultra Vy Lt Tan",    hex:"#e6cfae"},
  {code:"738",   name:"Vy Lt Tan",          hex:"#d6b48d"},
  {code:"437",   name:"Lt Tan",             hex:"#c39a6b"},
  {code:"436",   name:"Tan",                hex:"#b08a52"},
  {code:"434",   name:"Lt Brown",           hex:"#925c30"},
  {code:"433",   name:"Med Brown",          hex:"#7a4a22"},
  {code:"801",   name:"Dk Coffee Brown",    hex:"#5a3318"},
  {code:"898",   name:"Vy Dk Coffee Brown", hex:"#42250f"},
  {code:"938",   name:"Ultra Dk Coffee",    hex:"#311a0c"},
  {code:"3371",  name:"Black Brown",        hex:"#1e1208"},
  {code:"310",   name:"Black",              hex:"#000000"},
  {code:"413",   name:"Dk Pewter Grey",     hex:"#565656"},
  {code:"414",   name:"Dk Steel Grey",      hex:"#6e6e6e"},
  {code:"317",   name:"Pewter Grey",        hex:"#787878"},
  {code:"318",   name:"Lt Steel Grey",      hex:"#999999"},
  {code:"415",   name:"Pearl Grey",         hex:"#bcbec0"},
  {code:"762",   name:"Vy Lt Pearl Grey",   hex:"#dcdedf"},
  {code:"535",   name:"Vy Lt Ash Grey",     hex:"#494a4a"},
  {code:"3799",  name:"Vy Dk Pewter Grey",  hex:"#3b3b3b"},
  {code:"844",   name:"Ultra Dk Beaver Grey", hex:"#48474a"},
  {code:"645",   name:"Vy Dk Beaver Grey",  hex:"#5b5750"},
  {code:"648",   name:"Lt Beaver Grey",     hex:"#a7a097"},
  {code:"321",   name:"Red",                hex:"#c72b3b"},
  {code:"304",   name:"Med Red",            hex:"#b51b2d"},
  {code:"498",   name:"Dk Red",             hex:"#a7283a"},
  {code:"816",   name:"Garnet",             hex:"#971236"},
  {code:"815",   name:"Med Garnet",         hex:"#871230"},
  {code:"814",   name:"Dk Garnet",          hex:"#70112b"},
  {code:"666",   name:"Bright Red",         hex:"#e31d42"},
  {code:"349",   name:"Dk Coral",           hex:"#d21a37"},
  {code:"347",   name:"Vy Dk Salmon",       hex:"#bc3a3a"},
  {code:"3777",  name:"Vy Dk Terra Cotta",  hex:"#893831"},
  {code:"355",   name:"Dk Terra Cotta",     hex:"#9c5036"},
  {code:"3830",  name:"Terra Cotta",        hex:"#b96a4f"},
  {code:"760",   name:"Salmon",             hex:"#d99089"},
  {code:"3328",  name:"Dk Salmon",          hex:"#c45f5d"},
  {code:"606",   name:"Bright Orange Red",  hex:"#f43d19"},
  {code:"608",   name:"Bright Orange",      hex:"#fa6e1e"},
  {code:"947",   name:"Burnt Orange",       hex:"#f06e34"},
  {code:"720",   name:"Dk Orange Spice",    hex:"#ca5a23"},
  {code:"721",   name:"Med Orange Spice",   hex:"#e07535"},
  {code:"922",   name:"Lt Copper",          hex:"#cf6f3f"},
  {code:"301",   name:"Med Mahogany",       hex:"#9a4a28"},
  {code:"400",   name:"Dk Mahogany",        hex:"#7d3a1d"},
  {code:"402",   name:"Vy Lt Mahogany",     hex:"#e9956b"},
  {code:"977",   name:"Lt Golden Brown",    hex:"#c98330"},
  {code:"976",   name:"Med Golden Brown",   hex:"#bb7339"},
  {code:"975",   name:"Dk Golden Brown",    hex:"#8c4a16"},
  {code:"783",   name:"Med Topaz",          hex:"#cc9900"},
  {code:"782",   name:"Dk Topaz",           hex:"#b07d12"},
  {code:"780",   name:"Ultra Dk Topaz",     hex:"#8e5e0c"},
  {code:"725",   name:"Med Lt Topaz",       hex:"#f2c12e"},
  {code:"726",   name:"Lt Topaz",           hex:"#f7d04a"},
  {code:"728",   name:"Topaz",              hex:"#e6b24a"},
  {code:"729",   name:"Med Old Gold",       hex:"#c9a356"},
  {code:"680",   name:"Dk Old Gold",        hex:"#b88a2a"},
  {code:"676",   name:"Lt Old Gold",        hex:"#e0c47e"},
  {code:"3852",  name:"Vy Dk Straw",        hex:"#e0a92e"},
  {code:"742",   name:"Lt Tangerine",       hex:"#ffbf4a"},
  {code:"972",   name:"Deep Canary",        hex:"#ffc11e"},
  {code:"444",   name:"Dk Lemon",           hex:"#ffd200"},
  {code:"307",   name:"Lemon",              hex:"#fde23a"},
  {code:"3819",  name:"Lt Moss Green",      hex:"#cdd13a"},
  {code:"581",   name:"Moss Green",         hex:"#a7ad2e"},
  {code:"907",   name:"Lt Parrot Green",    hex:"#9bcb3a"},
  {code:"906",   name:"Med Parrot Green",   hex:"#6fa82c"},
  {code:"905",   name:"Dk Parrot Green",    hex:"#5a8a1e"},
  {code:"703",   name:"Chartreuse",         hex:"#73bf44"},
  {code:"702",   name:"Kelly Green",        hex:"#4caa3f"},
  {code:"701",   name:"Lt Green",           hex:"#3d9a3a"},
  {code:"700",   name:"Bright Green",       hex:"#1f8c34"},
  {code:"699",   name:"Green",              hex:"#13702a"},
  {code:"909",   name:"Emerald",            hex:"#2b7a4b"},
  {code:"911",   name:"Med Emerald",        hex:"#338a55"},
  {code:"912",   name:"Lt Emerald",         hex:"#3fa869"},
  {code:"3818",  name:"Ultra Vy Dk Emerald",hex:"#1c5e36"},
  {code:"986",   name:"Vy Dk Forest Green", hex:"#2f5d34"},
  {code:"987",   name:"Dk Forest Green",    hex:"#4a7a45"},
  {code:"3345",  name:"Dk Hunter Green",    hex:"#3b5d2a"},
  {code:"895",   name:"Vy Dk Hunter Green", hex:"#23451f"},
  {code:"890",   name:"Ultra Dk Pistachio", hex:"#1b4a2b"},
  {code:"991",   name:"Dk Aquamarine",      hex:"#2c6e63"},
  {code:"3815",  name:"Dk Celadon Green",   hex:"#4a7d6e"},
  {code:"3768",  name:"Dk Grey Green",      hex:"#566c69"},
  {code:"924",   name:"Vy Dk Grey Green",   hex:"#3a504e"},
  {code:"311",   name:"Med Navy Blue",      hex:"#1c5374"},
  {code:"312",   name:"Vy Dk Baby Blue",    hex:"#3c6e92"},
  {code:"322",   name:"Dk Baby Blue",       hex:"#5a8bb0"},
  {code:"336",   name:"Navy Blue",          hex:"#1b3a5b"},
  {code:"823",   name:"Dk Navy Blue",       hex:"#15233f"},
  {code:"939",   name:"Vy Dk Navy Blue",    hex:"#101a30"},
  {code:"824",   name:"Vy Dk Blue",         hex:"#2c6593"},
  {code:"796",   name:"Dk Royal Blue",      hex:"#1d4f93"},
  {code:"797",   name:"Royal Blue",         hex:"#1f5aa6"},
  {code:"820",   name:"Vy Dk Royal Blue",   hex:"#173f7a"},
  {code:"791",   name:"Vy Dk Cornflower",   hex:"#414b86"},
  {code:"792",   name:"Dk Cornflower Blue", hex:"#54608f"},
  {code:"333",   name:"Blue Violet",        hex:"#5c5096"},
  {code:"3746",  name:"Dk Blue Violet",     hex:"#7166a8"},
  {code:"340",   name:"Med Blue Violet",    hex:"#9590c4"},
  {code:"327",   name:"Dk Violet",          hex:"#6e4a8e"},
  {code:"550",   name:"Vy Dk Violet",       hex:"#5a2e6e"},
  {code:"552",   name:"Med Violet",         hex:"#7a3f8e"},
  {code:"553",   name:"Violet",             hex:"#9657a0"},
  {code:"3837",  name:"Ultra Dk Lavender",  hex:"#6d4a8e"},
  {code:"209",   name:"Dk Lavender",        hex:"#a585bd"},
  {code:"208",   name:"Vy Dk Lavender",     hex:"#8a5ca8"},
  {code:"718",   name:"Plum",               hex:"#9c2f7a"},
  {code:"915",   name:"Dk Plum",            hex:"#7a1556"},
  {code:"3607",  name:"Lt Plum",            hex:"#c63d8e"},
  {code:"602",   name:"Med Cranberry",      hex:"#d6457f"},
  {code:"600",   name:"Vy Dk Cranberry",    hex:"#c52066"},
  {code:"326",   name:"Vy Dk Rose",         hex:"#b23456"},
  {code:"309",   name:"Dk Rose",            hex:"#a83a55"},
  {code:"3685",  name:"Vy Dk Mauve",        hex:"#8a2b46"},
  {code:"315",   name:"Md Dk Antique Mauve",hex:"#7a4a55"},
];

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
