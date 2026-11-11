/* Alkyon 1.12.7 · μάσκα στεριάς για όλο τον κόσμο (~3,7 km, global-land-mask / NOAA GLOBE, δημόσιο κτήμα).
   Χρησιμοποιείται όπου δεν υπάρχει η λεπτομερής ακτή (exposure.js) ούτε η μάσκα Μεσογείου (medland.js):
   χωρίς αυτήν το κύμα, τα ρεύματα, η χλωροφύλλη και η θερμοκρασία νερού βάφονταν πάνω στη στεριά έξω από τη Μεσόγειο.
   Φορτώνεται μόνο την πρώτη φορά που χρειάζεται (worldland.bin, ~190 KB). isLand: 1 στεριά, 0 θάλασσα, -1 δεν φορτώθηκε ακόμα. */
(function(){
'use strict';
var R=0, W=0, rows=null, first=null, st=0; /* st: 0 όχι ακόμα, 1 φορτώνει, 2 έτοιμο, 3 απέτυχε */
function load(){ if(st===1||st===2) return; st=1;
  fetch('worldland.bin').then(function(r){ if(!r.ok) throw 0; return r.arrayBuffer(); }).then(function(buf){
    var u=new Uint8Array(buf); if(u[0]!==65||u[1]!==75||u[2]!==87||u[3]!==76) throw 0; R=u[4]|(u[5]<<8); W=360*R; var H=180*R, p=6;
    function vi(){ var x=0, s=0, b; do{ b=u[p++]; x+=(b&127)*Math.pow(2,s); s+=7; }while(b&128); return x; }
    rows=new Array(H); first=new Uint8Array(H);
    for(var y=0;y<H;y++){ first[y]=vi(); var acc=0, b=[]; while(acc<W){ acc+=vi(); if(acc<W) b.push(acc); } rows[y]=Int32Array.from(b); }
    st=2; try{ window.dispatchEvent(new Event('alkyon-worldland')); }catch(e){}
  }).catch(function(){ st=3; setTimeout(function(){ if(st===3) st=0; },60000); }); }
function isLand(lat,lon){ if(st!==2){ load(); return -1; } if(!(lat>-90&&lat<=90)) return -1; lon=((lon+180)%360+360)%360-180;
  var y=Math.min(rows.length-1,Math.floor((90-lat)*R)), x=Math.floor((lon+180)*R), b=rows[y], lo=0, hi=b.length;
  while(lo<hi){ var m=(lo+hi)>>1; if(b[m]<=x) lo=m+1; else hi=m; }
  return (first[y]^(lo&1))?1:0; }
window.AlkyonWorldLand={isLand:isLand,load:load,ready:function(){ return st===2; }};
})();
