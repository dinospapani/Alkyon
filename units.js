/* Μονάδες μέτρησης: αποθηκεύονται σε alkyon-units. Οι εσωτερικές τιμές μένουν kn, °C, hPa, m, km. */
(function(){
'use strict';
var K='alkyon-units', D={wind:'bft',temp:'c',press:'hpa',wave:'m',depth:'m',dist:'km',coord:'dm'}, EN=(function(){ try{ return (localStorage.getItem('alkyon-lang')||'en')==='en'; }catch(e){ return false; } })(), FA=1.83;
var OPT={
  wind:[['kn','kn'],['bft','Bft'],['kmh','km/h'],['ms','m/s'],['mph','mph']],
  temp:[['c','°C'],['f','°F']],
  press:[['hpa','hPa'],['inhg','inHg'],['mmhg','mmHg']],
  wave:[['m','m'],['ft','ft']],
  depth:[['m','m'],['fa',EN?'fathoms':'οργιές'],['ft','ft']], /* 1.6.9: βάθος σε μέτρα, οργιές (1 οργιά = 1,83 m) ή πόδια */
  dist:[['km','km'],['nm','nm'],['mi','mi']],
  coord:[['dm','35°26.052′'],['dd','35.43419°'],['dms','35°26′3.1″']]
};
var U={};
function load(){ var o={}; try{ o=JSON.parse(localStorage.getItem(K)||'{}')||{}; }catch(e){} var r={}; Object.keys(D).forEach(function(k){ r[k]=OPT[k].some(function(x){ return x[0]===o[k]; })?o[k]:D[k]; }); return r; }
U.cfg=load();
function bft(w){ return [1,4,7,11,17,22,28,34,41,48,56,64].filter(function(x){ return x<=w; }).length; }
function lab(k){ var c=U.cfg[k]; for(var i=0;i<OPT[k].length;i++) if(OPT[k][i][0]===c) return OPT[k][i][1]; return ''; }
function r1(v){ return Math.round(v*10)/10; }
/* num: [αριθμός ως κείμενο, μονάδα] */
U.windP=function(kn){ if(kn==null||isNaN(kn)) return null; var c=U.cfg.wind;
  if(c==='bft') return [String(bft(kn)),'Bft'];
  if(c==='kmh') return [String(Math.round(kn*1.852)),'km/h'];
  if(c==='ms') return [r1(kn*0.514444).toFixed(1),'m/s'];
  if(c==='mph') return [String(Math.round(kn*1.15078)),'mph'];
  return [String(Math.round(kn)),'kn']; };
U.tempP=function(c,dec){ if(c==null||isNaN(c)) return null; var f=U.cfg.temp==='f', v=f?c*9/5+32:c; return [dec?v.toFixed(dec):String(Math.round(v)),f?'°F':'°C']; };
U.pressP=function(h){ if(h==null||isNaN(h)) return null; var c=U.cfg.press;
  if(c==='inhg') return [(h*0.0295300).toFixed(2),'inHg'];
  if(c==='mmhg') return [String(Math.round(h*0.750062)),'mmHg'];
  return [String(Math.round(h*10)/10).replace(/\.0$/,''),'hPa']; };
U.waveP=function(m,dec){ if(m==null||isNaN(m)) return null; var ft=U.cfg.wave==='ft', v=ft?m*3.28084:m; return [v.toFixed(dec==null?1:dec),ft?'ft':'m']; };
U.distP=function(km,dec){ if(km==null||isNaN(km)) return null; var c=U.cfg.dist, v=c==='nm'?km/1.852:c==='mi'?km*0.621371:km; return [v.toFixed(dec==null?1:dec),c==='nm'?'nm':c==='mi'?'mi':'km']; };
U.depthP=function(m){ if(m==null||m===''||isNaN(m)) return null; m=+m; var c=U.cfg.depth;
  if(c==='fa') return [String(Math.round(m/FA)),EN?'fm':'οργ.'];
  if(c==='ft') return [String(Math.round(m*3.28084)),'ft'];
  return [String(Math.round(m*10)/10).replace(/\.0$/,''),'m']; };
U.depthUnit=function(){ var c=U.cfg.depth; return c==='fa'?(EN?'fm':'οργ.'):c==='ft'?'ft':'m'; };
/* για τα πεδία: τιμή στη μονάδα του χρήστη ↔ μέτρα */
U.depthOut=function(m){ if(m==null||m===''||isNaN(m)) return ''; m=+m; var c=U.cfg.depth; return c==='fa'?String(Math.round(m/FA*10)/10):c==='ft'?String(Math.round(m*3.28084)):String(m); };
U.depthIn=function(v){ if(v==null||v===''||isNaN(v)) return null; v=+v; var c=U.cfg.depth; return Math.round((c==='fa'?v*FA:c==='ft'?v/3.28084:v)*10)/10; };
U.depthRange=function(a,b){ var p=U.depthP(a), q=U.depthP(b); if(!p) return ''; if(!q||p[0]===q[0]) return p[0]+' '+p[1]; return p[0]+'–'+q[0]+' '+q[1]; };
function s(p,sep){ return p?p[0]+(sep==null?' ':sep)+p[1]:''; }
U.wind=function(kn){ return s(U.windP(kn)); };
U.temp=function(c,d){ return s(U.tempP(c,d),''); };
U.press=function(h){ return s(U.pressP(h)); };
U.wave=function(m,d){ return s(U.waveP(m,d)); };
U.depth=function(m){ return s(U.depthP(m)); };
U.dist=function(km,d){ return s(U.distP(km,d)); };
U.label=lab; U.options=OPT; U.bft=bft;
U.set=function(k,v){ if(!OPT[k]) return; U.cfg[k]=v; try{ localStorage.setItem(K,JSON.stringify(U.cfg)); }catch(e){} try{ window.dispatchEvent(new Event('alkyon-units')); }catch(e){} };
window.AlkyonUnits=U;
})();
