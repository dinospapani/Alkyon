/* BiteCast 4 · εργαλεία δεδομένων (όπως η κλασική):
   - αναγνώριση ψαριού από φωτογραφία με AI (δικό σου κλειδί API, psaro-akey, μένει μόνο στη συσκευή)
   - εξαγωγή CSV ψαριών και εξόδων
   - έλεγχος δεδομένων: ασυνέπειες σε ψάρια και εξόδους, με διόρθωση */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;

/* ---------- AI ---------- */
var AI_PROMPT='You are helping an angler in Cyprus (eastern Mediterranean). Identify the fish in the photo. Reply with ONLY a JSON array of up to 3 candidates, best first: [{"el":"Greek common name or null","en":"English common name","latin":"Latin name","confidence":0.0-1.0}]. If the photo does not show a fish, reply []. Be honest about uncertainty.';
function b64(blob){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result).split(',')[1]); }; r.onerror=rej; r.readAsDataURL(blob); }); }
function identify(blob){
  var key=ls.get('psaro-akey',''); if(!key) return Promise.reject(new Error('nokey'));
  return b64(blob).then(function(data){ var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },45000);
    return fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:4000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:blob.type||'image/jpeg',data:data}},{type:'text',text:AI_PROMPT}]}]})})
    .then(function(r){ if(!r.ok){ var e=new Error('http'); e.status=r.status; return r.json().catch(function(){ return {}; }).then(function(jj){ e.api=(jj&&jj.error&&jj.error.message)||''; throw e; }); } return r.json(); })
    .then(function(j){ var txt=(j.content||[]).filter(function(x){ return x.type==='text'; }).map(function(x){ return x.text; }).join(''), arr=null, m=/\[[\s\S]*\]/.exec(txt);
      if(m){ try{ arr=JSON.parse(m[0]); }catch(e){ arr=null; } }
      if(!arr){ arr=[]; (txt.match(/\{[^{}]*\}/g)||[]).forEach(function(o){ try{ var x=JSON.parse(o); if(x&&x.latin) arr.push(x); }catch(e){} }); if(!arr.length){ var e2=new Error('parse'); throw e2; } }
      return arr.filter(function(x){ return x&&x.latin; }).slice(0,3); })
    .finally(function(){ clearTimeout(tm); }); });
}
function aiErr(e){ var st=e.status, am=(e.api||'').slice(0,160), t;
  if(e.message==='nokey') t=T('Λείπει το κλειδί API. Βάλ’ το στο Προφίλ › Αναγνώριση ψαριού με AI.','API key missing. Add it in Profile › AI fish identification.');
  else if(st===401) t=T('Το κλειδί API δεν έγινε δεκτό.','The API key was not accepted.');
  else if(/credit balance|billing/i.test(am)) t=T('Δεν υπάρχει υπόλοιπο στον λογαριασμό API. Πρόσθεσε πίστωση στο console.anthropic.com → Plans & Billing.','No credit on the API account. Add credit at console.anthropic.com → Plans & Billing.');
  else if(st===429||st===402) t=T('Όριο χρήσης ή υπόλοιπο λογαριασμού: έλεγξε το console.anthropic.com.','Usage limit or account balance: check console.anthropic.com.');
  else if(st===404) t=T('Το μοντέλο δεν βρέθηκε για αυτό το κλειδί.','Model not found for this key.');
  else if(st>=500) t=T('Η υπηρεσία AI είναι φορτωμένη. Δοκίμασε ξανά σε λίγο.','The AI service is busy. Try again in a minute.');
  else if(e.name==='AbortError') t=T('Η αναγνώριση άργησε. Δοκίμασε ξανά.','Identification took too long. Try again.');
  else if(e.message==='parse') t=T('Δεν διαβάστηκε η απάντηση. Δοκίμασε ξανά.','The answer could not be read. Try again.');
  else if(!st) t=T('Δεν έφτασε στο api.anthropic.com (δίκτυο, VPN/adblock ή browser).','Could not reach api.anthropic.com (network, VPN/ad-blocker or browser).');
  else t=T('Η αναγνώριση δεν δούλεψε.','Identification failed.');
  return t+(st?' ['+st+(am?': '+am:'')+']':''); }
function nameFor(x){ var db=window.SPECIES_DB||[], r=db.filter(function(d){ return d[2]&&d[2].toLowerCase()===String(x.latin).toLowerCase(); })[0];
  if(r) return EN?(r[1]||(r[0]||'').split('/')[0].trim()):((r[0]||'').split('/')[0].trim()||r[1]); return EN?(x.en||x.latin):(x.el||x.en||x.latin); }
/* κουμπί για τη φόρμα ψαριού: getBlob() δίνει την πρώτη φωτογραφία, pick(name) γράφει το είδος */
B.aiButton=function(getBlob,pick){
  var out=h('div',{class:'chips aiout'}), msg=h('small',{class:'wn'});
  var b=h('button',{class:'btn',type:'button',text:'🔍 '+T('Αναγνώριση με AI','Identify with AI'),onclick:function(){ var bl=getBlob(); out.replaceChildren(); msg.textContent='';
    if(!bl){ msg.textContent=T('Πρόσθεσε πρώτα φωτογραφία του ψαριού.','Add a photo of the fish first.'); return; }
    b.disabled=true; b.textContent=T('Αναγνώριση…','Identifying…');
    identify(bl).then(function(res){ if(!res.length){ msg.textContent=T('Δεν αναγνωρίστηκε ψάρι στη φωτογραφία.','No fish recognised in the photo.'); return; }
      res.forEach(function(x){ var nm=nameFor(x), pct=typeof x.confidence==='number'?' '+Math.round(x.confidence*100)+'%':''; out.append(h('button',{type:'button',class:'chip',text:nm+' ('+x.latin+')'+pct,onclick:function(){ pick(nm); }})); });
      msg.textContent=T('Πρόταση AI, μπορεί να είναι λάθος. Μη βασίζεσαι σε αυτήν για το αν επιτρέπεται ή αν τρώγεται ένα ψάρι.','AI suggestion, it may be wrong. Do not rely on it for whether a fish is legal or edible.'); })
    .catch(function(e){ msg.textContent=aiErr(e); }).then(function(){ b.disabled=false; b.textContent='🔍 '+T('Αναγνώριση με AI','Identify with AI'); }); }});
  return h('div',{class:'fld aibox'},b,out,msg);
};
B.aiOn=function(){ return !!ls.get('psaro-akey',''); };
function aiCard(){
  var c=h('section',{class:'card'},h('h2',{text:T('Αναγνώριση ψαριού με AI','AI fish identification')}),h('p',{class:'sub',text:T('Με δικό σου κλειδί Anthropic API (sk-ant-…). Το κλειδί μένει μόνο σε αυτή τη συσκευή και η φωτογραφία στέλνεται απευθείας στο api.anthropic.com. Η χρέωση γίνεται στον λογαριασμό σου.','With your own Anthropic API key (sk-ant-…). The key stays on this device only and the photo goes straight to api.anthropic.com. Usage is billed to your account.')}));
  var inp=h('input',{type:'password',autocomplete:'off',placeholder:'sk-ant-…','aria-label':T('Κλειδί API','API key')}), msg=h('p',{class:'sub',text:ls.get('psaro-akey','')?T('Υπάρχει αποθηκευμένο κλειδί.','A key is saved.'):''});
  c.append(h('div',{class:'inrow'},inp,h('button',{class:'btn',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var k=inp.value.trim(); if(!/^sk-ant-/.test(k)){ msg.textContent=T('Το κλειδί πρέπει να ξεκινά με sk-ant-.','The key must start with sk-ant-.'); return; } ls.set('psaro-akey',k); inp.value=''; msg.textContent=T('Το κλειδί αποθηκεύτηκε σε αυτή τη συσκευή.','The key was saved on this device.'); }})),
    msg,ls.get('psaro-akey','')?h('button',{class:'btn full',type:'button',text:T('Διαγραφή κλειδιού','Delete key'),onclick:function(){ try{ localStorage.removeItem('psaro-akey'); }catch(e){} msg.textContent=T('Το κλειδί διαγράφηκε.','The key was deleted.'); }}):null);
  return c;
}

/* ---------- CSV ---------- */
var PT=EN?{slow:'Falling slowly',stable:'Steady',rise:'Rising',fast:'Falling fast'}:{slow:'Πέφτει αργά',stable:'Σταθερή',rise:'Ανεβαίνει',fast:'Πέφτει απότομα'};
var MOON=EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']:['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function bft(w){ return [1,4,7,11,17,22,28,34,41,48,56,64].filter(function(x){ return x<=w; }).length; }
function bc(b){ return Math.max(1,Math.floor(+b.cnt)||1); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function moonIdx(b){ var SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14), a=((B.biteMs(b)-REF)/86400000)%SYN; if(a<0) a+=SYN; return Math.floor(a/SYN*8+0.5)%8; }
function csv(name,head,rows){ var q=function(v){ v=v==null?'':String(v); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  var txt='﻿'+[head].concat(rows).map(function(r){ return r.map(q).join(';'); }).join('\r\n'), a=h('a',{href:URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})),download:name}); document.body.append(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500); }
B.csvBites=function(){ var L=B.store.raw('bites').filter(function(b){ return !b.deleted; }).sort(function(a,b){ return B.biteMs(a)-B.biteMs(b); });
  csv('bitecast-bites-'+today()+'.csv',EN?['Date','Time','Species','Latin','Lost','Bait','Technique','Depth m','Count','Weight kg','Length cm','Pressure hPa','Pressure trend','Wind Bft','Wind dir','Wave m','Sea °C','Air °C','Moon','Location','Latitude','Longitude','Released','Notes']:['Ημερομηνία','Ώρα','Είδος','Λατινικό','Χάθηκε','Δόλωμα','Τεχνική','Βάθος m','Πλήθος','Βάρος kg','Μήκος cm','Πίεση hPa','Τάση πίεσης','Άνεμος Bft','Διεύθ. ανέμου','Κύμα m','Θάλασσα °C','Αέρας °C','Σελήνη','Τοποθεσία','Πλάτος','Μήκος','Ελευθερώθηκε','Σημειώσεις'],
    L.map(function(b){ return [b.date,b.time,b.species,b.latin,b.miss?'✓':'',b.bait,b.tech,b.depth,bc(b),b.kg,b.len,b.press,b.ptrend?PT[b.ptrend]:'',b.wind==null?'':bft(b.wind),b.wdeg==null?'':COMP[Math.round((((b.wdeg%360)+360)%360)/45)%8],b.wave,b.sst!=null?Math.round(b.sst*10)/10:'',b.temp!=null?Math.round(b.temp*10)/10:'',MOON[moonIdx(b)],b.place,b.lat,b.lon,b.rel?'✓':'',b.notes]; })); };
B.csvTrips=function(){ var L=B.store.raw('trips').filter(function(t){ return !t.deleted; }).sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
  csv('bitecast-trips-'+today()+'.csv',EN?['Date','Spot','Hours','Species','Fish','Lost','Weight kg','Distance km','Cost €','Notes']:['Ημερομηνία','Σημείο','Ώρες','Είδος','Ψάρια','Χάθηκαν','Βάρος kg','Απόσταση km','Κόστος €','Σημειώσεις'],
    L.map(function(t){ var c=t.cost?(+t.cost.fuel||0)+(+t.cost.bait||0)+(+t.cost.other||0):''; return [t.date,t.spot,t.startMs&&t.endMs?Math.round((t.endMs-t.startMs-(t.pauseMs||0))/360000)/10:'',t.species,t.count,t.miss,t.kg,t.km,c,t.notes]; })); };

/* ---------- έλεγχος δεδομένων ---------- */
function issues(){
  var out=[], bites=B.store.raw('bites').filter(function(b){ return !b.deleted; }), trips=B.store.raw('trips').filter(function(t){ return !t.deleted; }), now=Date.now(), sids={};
  trips.forEach(function(t){ if(t.sid) sids[t.sid]=t; });
  bites.forEach(function(b){
    if(b.trip&&!sids[b.trip]&&!(ls.get('psaro-safe',{})||{}).active) out.push({t:T('Ψάρι συνδεδεμένο με έξοδο που δεν υπάρχει','Catch linked to a missing trip'),b:b,fix:function(){ var x=Object.assign({},b); delete x.trip; delete x.n; B.store.save('bites',x); }});
    if(b.date&&B.biteMs(b)>now+3600000) out.push({t:T('Ψάρι με ημερομηνία στο μέλλον','Catch dated in the future'),b:b});
    if(+b.kg>150) out.push({t:T('Πολύ μεγάλο βάρος (πάνω από 150 kg)','Very large weight (over 150 kg)'),b:b});
    if(+b.len>400) out.push({t:T('Πολύ μεγάλο μήκος (πάνω από 4 m)','Very large length (over 4 m)'),b:b});
    if(typeof b.lat==='number'&&(Math.abs(b.lat)>90||Math.abs(b.lon)>180)) out.push({t:T('Λάθος συντεταγμένες','Invalid coordinates'),b:b,fix:function(){ var x=Object.assign({},b); x.lat=null; x.lon=null; B.store.save('bites',x); }});
    if(!b.miss&&!(b.species||'').trim()&&!b.gear) out.push({t:T('Ψάρι χωρίς είδος','Catch without species'),b:b});
  });
  trips.forEach(function(t){ if(t.sid){ var bs=bites.filter(function(b){ return b.trip===t.sid&&!b.miss; }), n=bs.reduce(function(s,b){ return s+bc(b); },0);
      if(bs.length&&+t.count!==n) out.push({t:T('Η έξοδος μετρά ','The trip counts ')+(+t.count||0)+T(' ψάρια αλλά έχει ',' catches but has ')+n,tr:t,fix:function(){ var kg=Math.round(bs.reduce(function(s,b){ return s+(b.rel?0:(+b.kg||0)); },0)*10)/10; B.store.save('trips',Object.assign({},t,{count:n,kg:kg})); }}); }
    if(t.startMs&&t.endMs&&t.endMs<t.startMs) out.push({t:T('Η έξοδος τελειώνει πριν ξεκινήσει','The trip ends before it starts'),tr:t}); });
  return out;
}
function diagCard(){
  var c=h('section',{class:'card'},h('h2',{text:T('Έλεγχος δεδομένων','Data check')}),h('p',{class:'sub',text:T('Βρίσκει ασυνέπειες στα ψάρια και στις εξόδους και προσφέρει διόρθωση με ένα πάτημα.','Finds inconsistencies in catches and trips and offers a one-tap fix.')})), box=h('div');
  function run(){ var L=issues(); box.replaceChildren(); if(!L.length){ box.append(h('p',{class:'sub',text:'✓ '+T('Δεν βρέθηκε κάποιο πρόβλημα.','No problems found.')})); return; }
    L.slice(0,40).forEach(function(x){ var w=x.b?(x.b.date||'')+' '+(x.b.time||'')+(x.b.species?' · '+x.b.species:''):(x.tr.date||'')+(x.tr.spot?' · '+x.tr.spot:'');
      box.append(h('div',{class:'dgrow'},h('div',{class:'tx'},h('b',{text:x.t}),h('small',{text:w})),x.fix?h('button',{class:'btn',type:'button',text:T('Διόρθωση','Fix'),onclick:function(){ x.fix(); B.toast(T('Διορθώθηκε.','Fixed.')); run(); }}):x.b?h('button',{class:'btn',type:'button',text:T('Άνοιγμα','Open'),onclick:function(){ B.biteForm(x.b); }}):null)); }); }
  c.append(h('button',{class:'btn full',type:'button',text:T('Έλεγχος τώρα','Check now'),onclick:run}),box); return c;
}
function csvCard(){ return h('section',{class:'card'},h('h2',{text:T('Εξαγωγή σε Excel (CSV)','Export to Excel (CSV)')}),h('p',{class:'sub',text:T('Όλα τα ψάρια ή όλες οι έξοδοι σε αρχείο που ανοίγει στο Excel.','All catches or all trips in a file that opens in Excel.')}),
  h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Ψάρια','Catches'),onclick:B.csvBites}),h('button',{class:'btn',type:'button',text:T('Έξοδοι','Trips'),onclick:B.csvTrips}))); }
B.dataCards=function(){ return [csvCard(),aiCard(),diagCard()]; };
/* ---------- επιλογή είδους ανά θαλάσσια περιοχή (όπως η κλασική speciespick.js) ---------- */
function strip(x){ return (x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[̀-ͯ]/g,''); }
var SDB=null;
function sdb(){ if(SDB) return SDB; SDB=(window.SPECIES_DB||[]).map(function(r){ return {el:r[0]?String(r[0]).split('/')[0].trim():null,alt:r[0]||'',en:r[1]||'',la:r[2]||''}; }).filter(function(x){ return x.la; }); return SDB; }
function spName(sp){ return EN?(sp.en||sp.el):(sp.el||sp.en); }
B.speciesPick=function(cb){
  var REG=window.SPECIES_REG||{}, REGS=window.SPECIES_REGIONS||[], tags=function(sp){ return REG[(sp.la||'').toLowerCase()]||'m'; };
  var p=B.lastPos()||{lat:34.75,lon:32.42}, auto=window.regionAt?window.regionAt(p.lat,p.lon):'m', cur=B.prof()==='lake'?'f':auto, q='';
  var mi=new Date().getMonth(), K={}; (window.SPKB||[]).forEach(function(x){ if(x.l&&x.m) K[x.l.toLowerCase()]=x.m[mi]||0; });
  var H={}; B.store.bites().forEach(function(b){ var k=(b.latin||'').toLowerCase(); if(k) H[k]=(H[k]||0)+1; });
  var body=h('div',{class:'sppick'}), chips=h('div',{class:'chips'}), inp=h('input',{type:'search',class:'search-in',placeholder:T('Αναζήτηση (όνομα ή λατινικό)','Search (name or Latin)'),autocomplete:'off'}), list=h('div',{class:'list'}), sh;
  function item(sp,sub){ return h('button',{class:'li',type:'button',onclick:function(){ sh.close(); cb(spName(sp),sp); }},h('span',{class:'tx'},h('b',{text:spName(sp)}),h('small',{text:(sp.el&&sp.en&&!EN?sp.en+' · ':'')+sp.la+(sub?' · '+sub:'')}))); }
  function fill(){ list.replaceChildren(); var db=sdb(), qq=strip(q.trim());
    if(qq){ db.filter(function(sp){ return strip((sp.alt||'')+' '+sp.en+' '+sp.la).indexOf(qq)>=0; }).slice(0,60).forEach(function(sp){ list.append(item(sp)); }); if(!list.children.length) list.append(h('p',{class:'sub',text:T('Δεν βρέθηκε στη λίστα. Μπορείς να γράψεις το όνομα ελεύθερα στη φόρμα.','Not in the list. You can type the name freely in the form.')})); return; }
    var sg=[]; db.forEach(function(sp){ var k=sp.la.toLowerCase(); if(cur!=='*'&&tags(sp).indexOf(cur)<0) return; var hh=H[k]||0, kb=K[k]!=null?K[k]:null, sc=(hh?Math.min(hh,6)*0.5:0)+(kb!=null&&kb>=2?kb:0); if(sc>0) sg.push({sp:sp,sc:sc,h:hh,kb:kb}); });
    sg.sort(function(a,b){ return b.sc-a.sc; });
    if(sg.length){ list.append(h('h3',{class:'h3',text:T('Προτεινόμενα τώρα','Suggested now')})); sg.slice(0,8).forEach(function(x){ var t=[]; if(x.h) t.push(x.h+'×'); if(x.kb!=null&&x.kb>=2) t.push(x.kb>=3?T('εποχή: κορυφή','season: peak'):T('εποχή: καλή','season: good')); list.append(item(x.sp,t.join(' · '))); }); }
    var all=db.filter(function(sp){ return cur==='*'||tags(sp).indexOf(cur)>=0; }).sort(function(a,b){ return strip(spName(a)).localeCompare(strip(spName(b))); });
    list.append(h('h3',{class:'h3',text:(cur==='*'?T('Όλα τα είδη','All species'):((REGS.filter(function(r){ return r[0]===cur; })[0]||[])[EN?2:1]||''))+' · '+all.length}));
    all.forEach(function(sp){ list.append(item(sp)); });
    list.append(h('p',{class:'foot',text:T('Οι περιοχές είναι ενδεικτικές. Δεν σημαίνει ότι επιτρέπεται η αλιεία του είδους εκεί.','Regions are indicative. It does not mean fishing the species is allowed there.')})); }
  function drawChips(){ chips.replaceChildren(); [['*',T('Όλα','All')]].concat(REGS.map(function(r){ return [r[0],EN?r[2]:r[1]]; })).forEach(function(r){ chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(cur===r[0]),text:(r[0]===auto?'📍 ':'')+r[1],onclick:function(){ cur=r[0]; q=''; inp.value=''; drawChips(); fill(); }})); }); }
  inp.addEventListener('input',function(){ q=inp.value; fill(); });
  drawChips(); fill(); body.append(chips,inp,list);
  sh=B.sheet({title:T('Είδη ψαριών','Fish species'),body:body,stack:true});
};
/* ---------- συντεταγμένες από φωτογραφία plotter ή χαρτιού (όπως η κλασική plotterscan.js, με το ίδιο κλειδί AI) ---------- */
var SCAN_PROMPT='This photo shows a marine chartplotter / GPS screen, a waypoint list, or a paper note with geographic coordinates. '+
 'Read every coordinate pair exactly as printed. Reply with ONLY a JSON array: [{"name":"waypoint name or null","lat":"latitude exactly as shown, including N/S","lon":"longitude exactly as shown, including E/W","depth":number or null}]. '+
 'Copy digits, degree/minute symbols and decimals exactly; do not convert formats. If a hemisphere letter is missing, leave it out. If no coordinates are readable, reply [].';
function scanRead(blob){ var key=ls.get('psaro-akey',''), P=window.PsaroCoord; if(!key) return Promise.reject(new Error('nokey'));
  return b64(blob).then(function(data){ var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },45000);
    return fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:2000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:blob.type||'image/jpeg',data:data}},{type:'text',text:SCAN_PROMPT}]}]})})
    .then(function(r){ if(!r.ok){ var e=new Error('http'); e.status=r.status; return r.json().catch(function(){ return {}; }).then(function(jj){ e.api=(jj&&jj.error&&jj.error.message)||''; throw e; }); } return r.json(); })
    .then(function(j){ var txt=(j.content||[]).filter(function(x){ return x.type==='text'; }).map(function(x){ return x.text; }).join(''), m=/\[[\s\S]*\]/.exec(txt), arr=[]; try{ arr=m?JSON.parse(m[0]):[]; }catch(x){ arr=[]; }
      return (Array.isArray(arr)?arr:[]).map(function(o){ var la=P.parse(String(o.lat||''),'lat'), lo=P.parse(String(o.lon||''),'lon');
        return {name:o.name?String(o.name).slice(0,40):'',rawLat:String(o.lat||''),rawLon:String(o.lon||''),lat:la,lon:lo,depth:(typeof o.depth==='number'&&o.depth>0&&o.depth<3000)?Math.round(o.depth):null,ok:!isNaN(la)&&!isNaN(lo)&&Math.abs(la)<=90&&Math.abs(lo)<=180}; }); })
    .finally(function(){ clearTimeout(tm); }); }); }
B.plotterScan=function(){
  if(!window.PsaroCoord){ B.toast(T('Δεν φορτώθηκαν οι συντεταγμένες.','Coordinates module not loaded.')); return; }
  var file=h('input',{type:'file',accept:'image/*',capture:'environment',hidden:true}); document.body.append(file);
  file.addEventListener('change',function(){ var f=file.files&&file.files[0]; file.remove(); if(!f) return; var P=window.PsaroCoord, thumb=URL.createObjectURL(f);
    var wait=B.sheet({title:T('Διαβάζω τις συντεταγμένες…','Reading the coordinates…'),body:h('div',null,h('img',{class:'cdimg',src:thumb,alt:''}),h('div',{class:'sk',style:{height:'60px'}}))});
    (B.store.resize?B.store.resize(f):Promise.resolve(f)).catch(function(){ return f; }).then(scanRead).then(function(list){
      var body=h('div',{class:'bform'}), rows=[], d=new Date(), base=B.pad(d.getHours())+':'+B.pad(d.getMinutes());
      if(!list.length){ body.append(h('p',{class:'sub',text:T('Δεν διαβάστηκαν συντεταγμένες. Δοκίμασε πιο κοντινή, καθαρή φωτογραφία χωρίς αντανάκλαση.','No coordinates could be read. Try a closer, sharper photo without glare.')}),h('button',{class:'btn full',type:'button',text:T('Νέα φωτογραφία','New photo'),onclick:function(){ sh.close(true); B.plotterScan(); }})); }
      else { body.append(h('p',{class:'sub',text:T('Έλεγξε ότι οι αριθμοί είναι ίδιοι με την οθόνη. Μπορείς να τους διορθώσεις πριν την αποθήκευση.','Check the numbers match the screen. You can fix them before saving.')}));
        list.forEach(function(it,i){ var cb=h('input',{type:'checkbox',checked:it.ok}), nm=h('input',{type:'text',maxlength:'40',value:it.name||(T('Σημείο ','Spot ')+base+(list.length>1?' #'+(i+1):''))}),
            la=h('input',{type:'text',value:it.ok?P.fmtOne(it.lat,'lat'):it.rawLat}), lo=h('input',{type:'text',value:it.ok?P.fmtOne(it.lon,'lon'):it.rawLon}), dp=h('input',{type:'number',inputmode:'numeric',min:'0',placeholder:T('βάθος m','depth m'),value:it.depth!=null?String(it.depth):''});
          rows.push({cb:cb,nm:nm,la:la,lo:lo,dp:dp});
          body.append(h('div',{class:'card psrow'+(it.ok?'':' bad')},h('label',{class:'tg'},cb,nm),h('div',{class:'g3'},la,lo,dp))); });
        body.append(h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση σημείων','Save spots'),onclick:function(){ var n=0, bad=0;
          rows.forEach(function(r){ if(!r.cb.checked) return; var a=P.parse(r.la.value,'lat'), o=P.parse(r.lo.value,'lon'); if(isNaN(a)||isNaN(o)||Math.abs(a)>90||Math.abs(o)>180){ bad++; return; }
            B.store.save('spots',{name:r.nm.value.trim()||T('Σημείο','Spot'),type:'',lat:+a.toFixed(6),lon:+o.toFixed(6),depth:r.dp.value===''?null:+r.dp.value,notes:T('Από φωτογραφία plotter','From a plotter photo')}); n++; });
          if(bad){ B.toast(T('Κάποιες συντεταγμένες δεν διαβάζονται. Διόρθωσέ τες ή ξετσέκαρέ τες.','Some coordinates cannot be read. Fix or untick them.')); return; }
          sh.close(); B.toast(n+T(' σημεία αποθηκεύτηκαν.',' spots saved.')); B.emit('store','psaro-spots'); var f0=rows.filter(function(r){ return r.cb.checked; })[0]; if(f0&&B.mapGo) B.mapGo(P.parse(f0.la.value,'lat'),P.parse(f0.lo.value,'lon'),13); }})); }
      wait.close(true); var sh=B.sheet({title:T('Βρέθηκαν συντεταγμένες','Coordinates found'),body:body});
    }).catch(function(e){ wait.close(true); B.toast(aiErr(e)); }); });
  file.click();
};
})();
