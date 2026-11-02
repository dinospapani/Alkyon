/* Εισαγωγή καταδύσεων από ρολόι (FIT / UDDF) — ψαροτούφεκο. Τοπικά στο κινητό, χωρίς server. */
(function(){
  var T=function(a,b){return window.LANG==='en'?b:a;};
  var KEY='alkyon-dives';
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return [];}}
  function save(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  var prof=function(){try{return localStorage.getItem('alkyon-fprof')||'boat';}catch(e){return 'boat';}};

  /* ---- Εντοπισμός καταδύσεων από σειρά (χρόνος s, βάθος m) ---- */
  function detect(s){
    var out=[], inD=false, st=0, mx=0, lastEnd=null, i, p;
    for(i=0;i<s.length;i++){
      p=s[i];
      if(!inD&&p.d>=1.5){ inD=true; st=i>0?s[i-1].t:p.t; mx=p.d; }
      else if(inD){
        if(p.d>mx) mx=p.d;
        if(p.d<1.0){ inD=false; push(st,p.t,mx); }
      }
    }
    if(inD) push(st,s[s.length-1].t,mx);
    function push(a,b,m){
      if(m<2||b-a<5) return;
      out.push({t:a,dur:Math.round(b-a),max:Math.round(m*10)/10,si:lastEnd==null?null:Math.round(a-lastEnd)});
      lastEnd=b;
    }
    return out;
  }

  /* ---- FIT ---- */
  var BT={0:[1,0],1:[1,1],2:[1,0],3:[2,1],4:[2,0],5:[4,1],6:[4,0],8:[4,2],9:[8,2],10:[1,0],11:[2,0],12:[4,0]};
  function parseFit(buf){
    var dv=new DataView(buf), u8=new Uint8Array(buf);
    var hs=u8[0]; if(hs<12||String.fromCharCode(u8[8],u8[9],u8[10],u8[11])!=='.FIT') throw new Error('not fit');
    var end=hs+dv.getUint32(4,true), pos=hs, defs={}, lastTs=0, recs=[], summ=[];
    function rd(def,pos0,ts){
      var o={}, p=pos0, f, k, bt, info, sz, v;
      for(k=0;k<def.f.length;k++){
        f=def.f[k]; bt=f.type&0x1f; info=BT[bt]; sz=f.size; v=null;
        if(info&&sz===info[0]){
          if(sz===1) v=info[1]?dv.getInt8(p):dv.getUint8(p);
          else if(sz===2) v=info[1]?dv.getInt16(p,def.le):dv.getUint16(p,def.le);
          else if(info[1]===2) v=dv.getFloat32(p,def.le);
          else v=info[1]?dv.getInt32(p,def.le):dv.getUint32(p,def.le);
          var inv=(sz===1?0xFF:sz===2?0xFFFF:0xFFFFFFFF);
          if(info[1]===0&&v===inv) v=null; else if(info[1]===1&&((sz===1&&v===0x7F)||(sz===2&&v===0x7FFF)||(sz===4&&v===0x7FFFFFFF))) v=null;
        }
        o[f.num]=v; p+=sz;
      }
      if(ts!=null) o[253]=ts;
      return o;
    }
    while(pos<end){
      var h=u8[pos++], def, local, o;
      if(h&0x80){
        local=(h>>5)&3; def=defs[local]; if(!def) break;
        var off=h&0x1f, ts=(lastTs&~0x1f)|off; if(off<(lastTs&0x1f)) ts+=32; lastTs=ts;
        o=rd(def,pos,ts); pos+=def.size; add(def.gm,o);
      } else if(h&0x40){
        local=h&15; pos++; var le=u8[pos++]===0, gm=dv.getUint16(pos,le); pos+=2;
        var nf=u8[pos++], fl=[], size=0, i;
        for(i=0;i<nf;i++){ fl.push({num:u8[pos],size:u8[pos+1],type:u8[pos+2]}); size+=u8[pos+1]; pos+=3; }
        if(h&0x20){ var nd=u8[pos++]; for(i=0;i<nd;i++){ size+=u8[pos+1]; pos+=3; } }
        defs[local]={gm:gm,le:le,f:fl,size:size};
      } else {
        local=h&15; def=defs[local]; if(!def) break;
        o=rd(def,pos,null); pos+=def.size; if(o[253]!=null) lastTs=o[253]; add(def.gm,o);
      }
    }
    function add(gm,o){ if(gm===20) recs.push(o); else if(gm===268) summ.push(o); }
    var samples=[], lat=null, lon=null, t0=null;
    recs.forEach(function(r){
      if(r[253]==null) return;
      if(lat==null&&r[0]!=null&&r[1]!=null){ lat=r[0]*180/2147483648; lon=r[1]*180/2147483648; }
      if(r[92]!=null){ if(t0==null) t0=r[253]; samples.push({t:r[253],d:r[92]/1000}); }
    });
    var dives=detect(samples);
    if(!dives.length&&summ.length){ /* εφεδρικά: από τα summaries των καταδύσεων */
      dives=summ.filter(function(s){return s[3]!=null;}).map(function(s,i){ return {t:s[253]||0,dur:s[11]!=null?Math.round(s[11]/1000):0,max:Math.round(s[3]/100)/10,si:s[4]!=null?s[4]:null}; });
      if(dives.length&&samples.length===0&&summ[0][253]) t0=summ[0][253];
    }
    if(!dives.length) throw new Error('nodives');
    var first=dives[0].t, startUnix=(t0!=null?first:(summ[0]&&summ[0][253])||first)+631065600;
    return {start:startUnix*1000,dives:dives.map(function(d){return {t:Math.round(d.t-first),dur:d.dur,max:d.max,si:d.si};}),lat:lat,lon:lon};
  }

  /* ---- UDDF ---- */
  function parseUddf(txt){
    var x=new DOMParser().parseFromString(txt,'text/xml');
    if(x.getElementsByTagName('parsererror').length) throw new Error('xml');
    var ds=x.getElementsByTagName('dive'), all=[], start=null, lat=null, lon=null, i;
    function tx(el,n){ var e=el.getElementsByTagName(n)[0]; return e?e.textContent.trim():null; }
    for(i=0;i<ds.length;i++){
      var d=ds[i], dt=tx(d,'datetime'), base=dt?Date.parse(dt):NaN;
      var wps=d.getElementsByTagName('waypoint'), s=[], k;
      for(k=0;k<wps.length;k++){ var dp=parseFloat(tx(wps[k],'depth')), tm=parseFloat(tx(wps[k],'divetime')); if(!isNaN(dp)&&!isNaN(tm)) s.push({t:tm,d:dp}); }
      var det=detect(s);
      if(!det.length){ var g=parseFloat(tx(d,'greatestdepth')), du=parseFloat(tx(d,'diveduration')); if(g>=2&&du>=5) det=[{t:0,dur:Math.round(du),max:Math.round(g*10)/10,si:null}]; }
      if(isNaN(base)) base=0;
      if(start==null&&base) start=base;
      det.forEach(function(q){ all.push({abs:base+q.t*1000,dur:q.dur,max:q.max,si:q.si}); });
    }
    if(!all.length) throw new Error('nodives');
    all.sort(function(a,b){return a.abs-b.abs;});
    var f=all[0].abs; if(start==null) start=f;
    var gl=x.getElementsByTagName('latitude')[0], go=x.getElementsByTagName('longitude')[0];
    if(gl&&go){ lat=parseFloat(gl.textContent); lon=parseFloat(go.textContent); }
    return {start:start,dives:all.map(function(q,j){ return {t:Math.round((q.abs-f)/1000),dur:q.dur,max:q.max,si:j?Math.round((q.abs-all[j-1].abs)/1000-all[j-1].dur):null}; }),lat:isNaN(lat)?null:lat,lon:isNaN(lon)?null:lon};
  }

  function fmt(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);}
  function day(ms){var d=new Date(ms+2*3600000);return d.toISOString().slice(0,10);}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function render(){
    var host=document.getElementById('l-trips'), card=document.getElementById('ndDives');
    if(!host) return;
    if(prof()!=='spear'){ if(card) card.remove(); return; }
    if(!card){
      card=document.createElement('div'); card.id='ndDives'; card.className='card';
      var list=document.getElementById('tripList'); host.insertBefore(card,list);
    }
    var a=load(), h='<b>'+T('Καταδύσεις από ρολόι','Dives from watch')+'</b>';
    h+='<p class="note">'+T('Εισαγωγή αρχείου .fit ή .uddf από την εφαρμογή του ρολογιού σου. Μένει μόνο σε αυτό το κινητό.','Import a .fit or .uddf file from your watch app. It stays on this phone only.')+'</p>';
    h+='<div class="row"><button class="btn acc" id="ndDvImp" type="button">'+T('Εισαγωγή αρχείου','Import file')+'</button></div><input type="file" id="ndDvFile" accept=".fit,.uddf,.xml,application/xml,text/xml" hidden><p class="note" id="ndDvMsg" role="status"></p>';
    var bites=[]; try{ bites=window.AlkyonCore.Store.get('bites'); }catch(e){}
    a.slice().sort(function(x,y){return y.start-x.start;}).forEach(function(s){
      var n=s.dives.length, mx=0, sum=0, lg=0; s.dives.forEach(function(d){ if(d.max>mx) mx=d.max; sum+=d.dur; if(d.dur>lg) lg=d.dur; });
      var dd=day(s.start), fish=0; bites.forEach(function(b){ if(b.date===dd) fish+=window.AlkyonCore.bc?window.AlkyonCore.bc(b):1; });
      h+='<details style="border-top:1px solid var(--line,#8884);padding:8px 0"><summary style="cursor:pointer"><b>'+esc(dd)+'</b> · '+n+' '+T('καταδύσεις','dives')+' · '+T('μέγ. ','max ')+mx+' m · '+T('μέσος ','avg ')+fmt(sum/n)+' · '+fish+' '+T('ψάρια','fish')+'</summary>';
      h+='<div style="font-size:13px;margin-top:6px">';
      s.dives.forEach(function(d,i){ h+='<div style="display:flex;justify-content:space-between;padding:2px 0"><span>#'+(i+1)+'</span><span>'+d.max+' m · '+fmt(d.dur)+(d.si!=null?' · '+T('ανάπ. ','rest ')+fmt(d.si):'')+'</span></div>'; });
      h+='<p class="note">'+T('Μακρύτερη: ','Longest: ')+fmt(lg)+'</p><button class="btn ghost sm" data-del="'+s.id+'" type="button">'+T('Διαγραφή','Delete')+'</button></div></details>';
    });
    card.innerHTML=h;
    var fi=card.querySelector('#ndDvFile'), msg=card.querySelector('#ndDvMsg');
    card.querySelector('#ndDvImp').onclick=function(){ fi.click(); };
    fi.onchange=function(){ var f=fi.files&&fi.files[0]; if(!f) return; importFile(f,msg); fi.value=''; };
    Array.prototype.forEach.call(card.querySelectorAll('[data-del]'),function(b){ b.onclick=function(){ var id=b.getAttribute('data-del'); var go=function(){ save(load().filter(function(s){return s.id!==id;})); render(); }; if(window.AlkyonAsk) window.AlkyonAsk(T('Διαγραφή αυτής της εισαγωγής;','Delete this import?'),{ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel')}).then(function(y){ if(y) go(); }); else go(); }; });
  }

  function importFile(f,msg){
    var r=new FileReader(), name=f.name||'', isFit=/\.fit$/i.test(name);
    r.onerror=function(){ msg.textContent=T('Δεν διαβάστηκε το αρχείο.','Could not read the file.'); };
    r.onload=function(){
      try{
        var res=isFit?parseFit(r.result):parseUddf(r.result);
        var a=load(), id=String(res.start)+'-'+res.dives.length;
        if(a.some(function(s){return s.id===id;})){ msg.textContent=T('Αυτό το αρχείο έχει ήδη εισαχθεί.','This file was already imported.'); return; }
        res.id=id; res.src=isFit?'fit':'uddf'; res.name=name.slice(0,60); a.push(res); save(a); render();
        var m=document.getElementById('ndDvMsg'); if(m) m.textContent=T('Εισήχθησαν ','Imported ')+res.dives.length+T(' καταδύσεις.',' dives.');
      }catch(e){
        msg.textContent=(e&&e.message==='nodives')?T('Δεν βρέθηκαν καταδύσεις στο αρχείο (χρειάζεται δεδομένα βάθους). Αν είναι από ρολόι ελεύθερης κατάδυσης, στείλε το αρχείο να προσαρμόσουμε την ανάγνωση.','No dives found in the file (depth data needed).'):T('Το αρχείο δεν αναγνωρίστηκε ως FIT ή UDDF.','The file was not recognised as FIT or UDDF.');
      }
    };
    if(isFit) r.readAsArrayBuffer(f); else r.readAsText(f);
  }

  window.AlkyonDiveLog={parseFit:parseFit,parseUddf:parseUddf,detect:detect,render:render};
  window.addEventListener('alkyon-fprof',function(){ setTimeout(render,100); });
  var n=0, iv=setInterval(function(){ n++; if(document.getElementById('tripList')){ clearInterval(iv); render(); } else if(n>40) clearInterval(iv); },500);
})();
