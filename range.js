/* Φίλτρο περιόδου «Από – Έως». Ξεχωριστό για Ημερολόγιο ('log') και Προφίλ ('prof'). */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-rng-';
function today(){ var d=new Date(Date.now()+(window.AlkyonCore&&window.AlkyonCore.utcMin?window.AlkyonCore.utcMin():120)*60000); return d.toISOString().slice(0,10); }
function addDays(iso,n){ var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function load(k){ try{ var v=JSON.parse(localStorage.getItem(KEY+k)||'null'); if(v&&typeof v==='object') return {f:v.f||'',t:v.t||''}; }catch(e){} return {f:'',t:''}; }
function save(k,v){ try{ localStorage.setItem(KEY+k,JSON.stringify(v)); }catch(e){} }
function get(k){ return load(k); }
function active(k){ var r=load(k); return !!(r.f||r.t); }
function inR(k,item){ var r=load(k); if(!r.f&&!r.t) return true; var d=(item&&item.date)||''; if(!d) return false; if(r.f&&d<r.f) return false; if(r.t&&d>r.t) return false; return true; }
function label(k){ var r=load(k); if(!r.f&&!r.t) return ''; var f=function(s){ return s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(2,4):'…'; }; return f(r.f)+' – '+f(r.t); }
function set(k,f,t){ if(f&&t&&f>t){ var x=f; f=t; t=x; } save(k,{f:f||'',t:t||''}); window.dispatchEvent(new CustomEvent('alkyon-range',{detail:{key:k}})); }
/* UI: Από / Έως + (προαιρετικά) έτοιμα κουμπιά */
function ui(k,box,presets){
  box.replaceChildren(); box.classList.add('rngbar');
  var row=document.createElement('div'); row.className='rngrow';
  function mk(lab){ var l=document.createElement('label'); l.className='f rngf'; l.append(document.createTextNode(lab)); var i=document.createElement('input'); i.type='date'; l.append(i); row.append(l); return i; }
  var a=mk(T('Από','From')), b=mk(T('Έως','To'));
  var more=document.createElement('details'); more.className='rngmore'; var sm=document.createElement('summary'); sm.textContent=T('Άλλες ημερομηνίες','Custom dates'); more.append(sm,row); box.append(more);
  var chips=null;
  if(presets){
    chips=document.createElement('div'); chips.className='rngchips';
    [[T('7 ημέρες','7 days'),7],[T('28 ημέρες','28 days'),28],[T('Έτος','Year'),'y'],[T('Όλα','All'),0]].forEach(function(p){
      var c=document.createElement('button'); c.type='button'; c.className='btn ghost sm'; c.textContent=p[0];
      c.addEventListener('click',function(){ var t=today(); if(p[1]===0) set(k,'',''); else if(p[1]==='y') set(k,t.slice(0,4)+'-01-01',''); else set(k,addDays(t,-(p[1]-1)),''); });
      chips.append(c);
    });
    box.append(chips);
  }
  function sync(){ var r=load(k); a.value=r.f; b.value=r.t; box.classList.toggle('on',!!(r.f||r.t)); if(r.f||r.t) more.open=true; }
  a.addEventListener('change',function(){ set(k,a.value,b.value); });
  b.addEventListener('change',function(){ set(k,a.value,b.value); });
  window.addEventListener('alkyon-range',function(e){ if(e.detail&&e.detail.key===k) sync(); });
  sync();
}
window.AlkyonRange={get:get,set:set,active:active,inR:inR,label:label,ui:ui,today:today,addDays:addDays};
})();
