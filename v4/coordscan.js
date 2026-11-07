/* Alkyon 1.9.18 · Συντεταγμένες από φωτογραφία ή screenshot του plotter.
   Διαβάζει το κείμενο στο κινητό (Tesseract, ανοιχτός κώδικας· ~4 MB, κατεβαίνει μόνο την πρώτη φορά και μένει στον browser),
   βρίσκει ζευγάρια πλάτους/μήκους (π.χ. N 35°03.602′ E 032°23.856′, 35.06003 32.39760, 35°03′36″N) και τα δίνει για έλεγχο.
   Η φωτογραφία δεν ανεβαίνει πουθενά. B.coordScan.pick() → Promise με {lat,lon} ή null. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T;
var CDN='https://cdn.jsdelivr.net/npm/', LIB=CDN+'tesseract.js@6.0.1/dist/', CORE=CDN+'tesseract.js-core@6.0.0', LANG=CDN+'@tesseract.js-data/eng@1.0.0/4.0.0_best_int';
var libP=null, worker=null;
function lib(){ if(window.Tesseract) return Promise.resolve(window.Tesseract); if(libP) return libP;
  libP=new Promise(function(res,rej){ var s=document.createElement('script'); s.src=LIB+'tesseract.min.js'; s.crossOrigin='anonymous'; s.onload=function(){ res(window.Tesseract); }; s.onerror=function(){ libP=null; rej(new Error('lib')); }; document.head.appendChild(s); });
  return libP; }
function getWorker(prog){ if(worker) return Promise.resolve(worker);
  return lib().then(function(Ts){ return Ts.createWorker('eng',1,{workerPath:LIB+'worker.min.js',corePath:CORE,langPath:LANG,logger:function(m){ if(prog&&m&&typeof m.progress==='number') prog(m.status,m.progress); }}); })
    .then(function(w){ worker=w; return w.setParameters({tessedit_char_whitelist:'0123456789NSEWnsew.,:°º\'"′″ -',preserve_interword_spaces:'1'}).then(function(){ return w; }); }); }

/* εικόνα → καμβάς σε γκρι, μεγέθυνση ώστε τα γράμματα να έχουν ~30px, αναστροφή αν το φόντο είναι σκούρο */
function prep(file){ return new Promise(function(res,rej){ var url=URL.createObjectURL(file), im=new Image();
  im.onload=function(){ var w=im.naturalWidth, hh=im.naturalHeight, k=Math.min(3,Math.max(1,1600/Math.max(w,hh))), c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(hh*k);
    var x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url);
    var d=x.getImageData(0,0,c.width,c.height), p=d.data, sum=0, n=p.length/4, i;
    for(i=0;i<p.length;i+=4){ var g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]; p[i]=p[i+1]=p[i+2]=g; sum+=g; }
    var dark=sum/n<110; if(dark) for(i=0;i<p.length;i+=4){ p[i]=p[i+1]=p[i+2]=255-p[i]; }
    /* αύξηση αντίθεσης */ for(i=0;i<p.length;i+=4){ var v=(p[i]-128)*1.6+128; v=v<0?0:v>255?255:v; p[i]=p[i+1]=p[i+2]=v; }
    x.putImageData(d,0,0); res(c); };
  im.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('img')); }; im.src=url; }); }

/* --------- κείμενο → ζευγάρια --------- */
function clean(t){ return String(t||'').toUpperCase().replace(/[º˚o](?=\s*\d)/g,'°').replace(/[’`´]/g,"'").replace(/[″”]/g,'"').replace(/,(?=\d)/g,'.').replace(/[|]/g,'1'); }
/* «35°03.602» ή «35 03.602» ή «3503.602» (ο αριθμός μοιρών είναι όσα ψηφία μένουν πριν από τα 2 των λεπτών) */
function ddm(degS,minS,maxDeg){ var dg=degS.replace(/\D/g,''), mn=parseFloat(minS); if(!dg||isNaN(mn)||mn>=60) return NaN;
  var maxLen=maxDeg>90?3:2; if(dg.length>maxLen) dg=dg.slice(0,maxLen); /* το ° διαβάστηκε ως ψηφίο */
  var d=+dg; if(d>maxDeg) return NaN; return d+mn/60; }
function axisVal(seg,ax){ /* seg: κείμενο μετά (ή πριν) το N/S/E/W */
  var max=ax==='lat'?90:180, m;
  if((m=seg.match(/^\s*(\d{1,3})\s*[°\s]\s*(\d{1,2})\s*['\s]\s*(\d{1,2}(?:\.\d+)?)\s*"/))){ var mi=+m[2], se=+m[3]; if(mi<60&&se<60&&+m[1]<=max) return +m[1]+mi/60+se/3600; }
  if((m=seg.match(/^\s*(\d{1,4})\s*[°'\s]?\s*(\d{2}\.\d{1,4})/))){ var v=ddm(m[1],m[2],max); if(!isNaN(v)) return v; }
  if((m=seg.match(/^\s*(\d{3,5})(\d{2}\.\d{2,4})/))){ var v2=ddm(m[1],m[2],max); if(!isNaN(v2)) return v2; }
  if((m=seg.match(/^\s*(\d{1,3}\.\d{3,7})\s*°?/))){ var dd=+m[1]; if(dd<=max) return dd; }
  return NaN; }
function find(text){
  var s=clean(text), out=[], seen={};
  function add(a,b,src){ if(isNaN(a)||isNaN(b)) return; var k=a.toFixed(4)+','+b.toFixed(4); if(seen[k]) return; seen[k]=1; out.push({lat:+a.toFixed(6),lon:+b.toFixed(6),src:src}); }
  /* 1) γράμμα μπροστά: N 35°03.602 E 032°23.856 (και σε δύο γραμμές) */
  var re=/([NS])\s*([0-9°'".\s]{4,16})[\s\S]{0,40}?([EW])\s*([0-9°'".\s]{4,17})/g, m;
  while((m=re.exec(s))){ var a=axisVal(m[2],'lat'), b=axisVal(m[4],'lon'); if(m[1]==='S') a=-a; if(m[3]==='W') b=-b; if(isNaN(a)||isNaN(b)){ re.lastIndex=m.index+1; continue; } add(a,b,m[0].replace(/\s+/g,' ').trim()); }
  /* 2) γράμμα πίσω: 35°03.602N 032°23.856E */
  var re2=/(\d[0-9°'".\s]{3,15}?)\s*([NS])\b[\s\S]{0,40}?(\d[0-9°'".\s]{3,16}?)\s*([EW])\b/g;
  if(!out.length) while((m=re2.exec(s))){ var a2=axisVal(m[1],'lat'), b2=axisVal(m[3],'lon'); if(m[2]==='S') a2=-a2; if(m[4]==='W') b2=-b2; if(isNaN(a2)||isNaN(b2)){ re2.lastIndex=m.index+1; continue; } add(a2,b2,m[0].replace(/\s+/g,' ').trim()); }
  /* 3) χωρίς γράμματα: δύο δεκαδικοί στη σειρά, π.χ. 35.06003, 32.39760 */
  if(!out.length){ var re3=/(-?\d{1,2}\.\d{4,7})[^\d.-]{1,12}(-?\d{1,3}\.\d{4,7})/g; while((m=re3.exec(s))) add(+m[1],+m[2],m[0]); }
  /* και με το έτοιμο parser της εφαρμογής, γραμμή-γραμμή */
  if(!out.length&&window.AlkyonCoord&&AlkyonCoord.parsePair){ s.split(/\n/).forEach(function(l){ var p=AlkyonCoord.parsePair(l); if(p) add(p[0],p[1],l.trim()); }); }
  return out.filter(function(p){ return Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180&&!(p.lat===0&&p.lon===0); });
}

function read(file,prog){ return Promise.all([prep(file),getWorker(prog)]).then(function(r){ return r[1].recognize(r[0]); }).then(function(res){ var t=res&&res.data&&res.data.text||''; return {text:t,found:find(t)}; }); }

/* --------- ροή: διάλεξε εικόνα → διάβασε → επιβεβαίωσε --------- */
function pick(){ return new Promise(function(done){
  var inp=h('input',{type:'file',accept:'image/*',style:{display:'none'}}); document.body.append(inp);
  inp.onchange=function(){ var f=inp.files&&inp.files[0]; inp.remove(); if(!f){ done(null); return; } run(f,done); };
  inp.click(); }); }
function run(f,done){
  var bar=h('i',{style:{width:'4%'}}), st=h('small',{class:'csst',text:T('Ετοιμάζω την ανάγνωση…','Getting the reader ready…')}), url=URL.createObjectURL(f), ended=false;
  var body=h('div',{class:'cscan'},h('img',{class:'csimg',src:url,alt:''}),h('div',{class:'csbar'},bar),st), sh;
  function fin(v){ if(ended) return; ended=true; URL.revokeObjectURL(url); done(v); }
  sh=B.sheet({title:T('Συντεταγμένες από εικόνα','Coordinates from image'),body:body,stack:true,onclose:function(){ fin(null); }});
  var first=!worker;
  read(f,function(s,p){ var pc=Math.round(p*100); if(/load|init/i.test(s)){ st.textContent=(first?T('Κατεβάζω τον αναγνώστη (μία φορά, ~4 MB)… ','Downloading the reader (once, ~4 MB)… '):T('Φορτώνω… ','Loading… '))+pc+'%'; bar.style.width=Math.max(4,pc/2)+'%'; } else if(/recogn/i.test(s)){ st.textContent=T('Διαβάζω… ','Reading… ')+pc+'%'; bar.style.width=(50+pc/2)+'%'; } })
    .then(function(r){ if(ended) return; bar.style.width='100%'; var PC=window.AlkyonCoord;
      if(!r.found.length){ st.textContent=''; body.append(h('p',{class:'wn',text:T('Δεν βρήκα συντεταγμένες. Δοκίμασε screenshot όπου φαίνονται καθαρά (π.χ. N 35°03.602′ E 032°23.856′), ή κόψε την εικόνα γύρω από τις συντεταγμένες.','No coordinates found. Try a screenshot where they are clear (e.g. N 35°03.602′ E 032°23.856′), or crop the image around them.')}),
          r.text.trim()?h('details',{class:'csraw'},h('summary',{text:T('Τι διάβασα','What I read')}),h('pre',{text:r.text.trim().slice(0,600)})):null); return; }
      st.textContent=r.found.length>1?T('Βρήκα '+r.found.length+' θέσεις. Διάλεξε τη σωστή:','Found '+r.found.length+' positions. Pick the right one:'):T('Βρήκα αυτή τη θέση. Έλεγξέ τη:','Found this position. Check it:');
      body.append(h('div',{class:'cslist'},r.found.slice(0,6).map(function(p){ return h('button',{type:'button',class:'csopt',onclick:function(){ fin({lat:p.lat,lon:p.lon}); sh.close(true); }},h('b',{text:PC?PC.fmt(p.lat,p.lon):p.lat.toFixed(5)+', '+p.lon.toFixed(5)}),h('small',{text:T('διάβασα: ','read: ')+p.src.slice(0,60)})); })),
        h('p',{class:'foot',text:T('Έλεγξε ότι ταιριάζει με το plotter πριν το αποθηκεύσεις. Η εικόνα δεν ανεβαίνει πουθενά.','Check it matches the plotter before saving. The image is not uploaded anywhere.')})); })
    .catch(function(e){ if(ended) return; st.textContent=''; body.append(h('p',{class:'wn',text:/lib|Failed to fetch|NetworkError|load/i.test(String(e&&e.message||e))?T('Χρειάζεται σύνδεση την πρώτη φορά, για να κατέβει ο αναγνώστης.','A connection is needed the first time, to download the reader.'):T('Δεν διαβάστηκε η εικόνα.','The image could not be read.')})); });
}
B.coordScan={pick:pick,find:find,read:read};
})();
