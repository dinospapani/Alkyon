/* Alkyon 4 · 1.14.29: «Με αυτόν τον άνεμο τα καλύτερά σου»
   Μόνο από τα δικά σου ψάρια, στη συσκευή σου (τίποτα δεν στέλνεται): ομαδοποιεί τα ψάρια σε σημεία (~500 m)
   και κρατά όσα πιάστηκαν με παρόμοιο άνεμο (κατεύθυνση ±45°, ένταση ±6 kn). Ονομάζει το σημείο από τα αποθηκευμένα σημεία σου (≤ 1,5 km). */
(function(){
var B=window.AK, T=B.T;
var DIRS=B.EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function km(a,b,c,d){ var r=Math.PI/180, x=(d-b)*r*Math.cos((a+c)/2*r), y=(c-a)*r; return Math.sqrt(x*x+y*y)*6371; }
function adiff(a,b){ var d=Math.abs(((a-b)%360+360)%360); return d>180?360-d:d; }
function dirName(deg){ return DIRS[Math.round((((deg%360)+360)%360)/45)%8]; }
function raw(k){ try{ return (B.store.raw(k)||[]).filter(function(x){ return x&&!x.deleted; }); }catch(e){ return []; } }
/* dir: από πού φυσά (μοίρες), kn: ένταση. Επιστρέφει τα 2 καλύτερα σημεία ή [] */
function find(dir,kn){ if(typeof dir!=='number') return [];
  var bs=raw('bites').filter(function(b){ return !b.miss&&typeof b.lat==='number'&&typeof b.lon==='number'&&typeof b.wdeg==='number'; });
  var cl=[]; bs.forEach(function(b){ var c=null; for(var i=0;i<cl.length;i++){ if(km(cl[i].lat,cl[i].lon,b.lat,b.lon)<=0.5){ c=cl[i]; break; } }
    if(!c){ c={lat:b.lat,lon:b.lon,all:0,n:0,days:{},sp:{},k:0}; cl.push(c); } c.k++; c.lat+=(b.lat-c.lat)/c.k; c.lon+=(b.lon-c.lon)/c.k;
    var w=Math.max(1,Math.min(20,b.cnt||1)); c.all+=w;
    if(adiff(b.wdeg,dir)<=45&&(typeof b.wind!=='number'||typeof kn!=='number'||Math.abs(b.wind-kn)<=6)){ c.n+=w; c.days[b.date||'?']=1; var s=b.species||''; if(s) c.sp[s]=(c.sp[s]||0)+w; } });
  var spots=raw('spots');
  return cl.filter(function(c){ return c.n>=3&&Object.keys(c.days).length>=2; }).sort(function(a,b){ return b.n-a.n; }).slice(0,2).map(function(c){
    var nm=null, best=1.5; spots.forEach(function(p){ if(typeof p.lat!=='number') return; var d=km(c.lat,c.lon,p.lat,p.lon); if(d<best&&p.name){ best=d; nm=p.name; } });
    var top=Object.keys(c.sp).sort(function(a,b){ return c.sp[b]-c.sp[a]; })[0];
    return {lat:c.lat,lon:c.lon,name:nm,n:Math.round(c.n),days:Object.keys(c.days).length,sp:top||null}; }); }
/* μέσος άνεμος (διανυσματικά) για ώρες με dir/wind */
function meanWind(hours){ var x=0,y=0,s=0,n=0; (hours||[]).forEach(function(h){ if(typeof h.dir!=='number'||typeof h.wind!=='number') return; var r=h.dir*Math.PI/180; x+=Math.sin(r)*h.wind; y+=Math.cos(r)*h.wind; s+=h.wind; n++; });
  if(!n||s/n<3) return null; return {dir:Math.round((Math.atan2(x,y)*180/Math.PI+360)%360),kn:Math.round(s/n)}; }
function box(hours){ var w=meanWind(hours); if(!w) return null; var r=find(w.dir,w.kn); if(!r.length) return null;
  var el=B.h('div',{class:'myspots'},B.h('b',{text:'📍 '+T('Με ','With ')+dirName(w.dir)+' '+w.kn+T(' kn τα καλύτερά σου:',' kn your best:')}));
  r.forEach(function(s){ el.append(B.h('button',{class:'chip sm',type:'button',text:(s.name||T('Σημείο ','Spot ')+s.lat.toFixed(3)+', '+s.lon.toFixed(3))+' · '+s.n+T(' ψάρια σε ',' fish on ')+s.days+T(' μέρες',' days'),onclick:function(){ if(B.mapGo) B.mapGo(s.lat,s.lon,14,null,{lab:s.name||T('Σημείο σου','Your spot')}); else location.hash='#map'; }})); });
  el.append(B.h('small',{class:'sub',text:T('Από τα δικά σου ψάρια με παρόμοιο άνεμο. Μένουν μόνο στη συσκευή σου.','From your own catches in similar wind. They stay on your device only.')}));
  return el; }
B.mySpots={find:find,box:box,meanWind:meanWind,dirName:dirName};
})();
