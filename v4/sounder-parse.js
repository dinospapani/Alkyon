/* Alkyon 4 · Ανάγνωση αρχείων βυθομέτρου (1.10.12). Όλα στο κινητό, τίποτα δεν στέλνεται.
   Επιστρέφει σημεία βάθους [{lat, lon, d (m), t (ms ή null), wt (°C ή null)}].
   - Lowrance / Simrad / B&G: .sl2 και .sl3 (καταγραφή sonar). Πεδία όπως στα ανοιχτά εργαλεία (sonarlight, sllib):
     sl2: πλαίσιο 144 bytes, μέγεθος @28, βάθος (ft) @64, θερμοκρασία @104, x/y (Lowrance Mercator) @108/@112, χρόνος (ms) @140
     sl3: πλαίσιο 168 bytes, μέγεθος @8,  βάθος (ft) @48, θερμοκρασία @88,  x/y @92/@96,  χρόνος (ms) @124, ώρα συσκευής @40
   - NMEA 0183 (καταγραφή .nmea/.txt/.log από plotter ή gateway): DPT/DBT/DBS με την τελευταία θέση GGA/RMC/GLL
   - GPX: σημεία διαδρομής ή waypoints με βάθος στα extensions (Garmin gpxx/gpxtpx:Depth, <depth> κ.ά.)
   - CSV: στήλες πλάτος/μήκος/βάθος (Deeper, Humminbird, Garmin, εξαγωγές από Excel), βάθος σε m ή ft
   - Humminbird (1.10.13): καταγραφή sonar = φάκελος με B00x.SON (+ το .DAT δίπλα για την ώρα). Κάθε ping αρχίζει με C0 DE AB 21 και
     ακολουθούν ετικέτες big-endian (≥128 → 4 bytes, αλλιώς 1): 130/131 = x/y σε Mercator διεθνούς ελλειψοειδούς 1924 (6378388),
     135 = βάθος σε δέκατα του μέτρου, 129 = ms από την αρχή, 160 = μήκος δεδομένων, 33 = τέλος κεφαλίδας (όπως στο PING-Mapper / PyHum)
   - Garmin (1.10.13): .RSD (Quickdraw / sonar recording). Από το byte 20480 εγγραφές «μεταβλητής δομής» (varint κλειδί = πεδίο<<3 | μήκος),
     μαγικός αριθμός 0xB7E9DA86· στο σώμα: 1 = βάθος βυθού (mm), 9/10 = lat/lon (×360/2³²), 11 = θερμοκρασία (float) */
(function(root){
'use strict';
var FT=0.3048, R_LOW=6356752.3142;
function okLL(la,lo){ return isFinite(la)&&isFinite(lo)&&Math.abs(la)<=85&&Math.abs(lo)<=180&&!(Math.abs(la)<1e-6&&Math.abs(lo)<1e-6); }
function okD(d){ return isFinite(d)&&d>=0.3&&d<=3000; }

/* ---------- Lowrance sl2 / sl3 ---------- */
function sl(buf,kind){
  var dv=new DataView(buf), n=buf.byteLength, out=[], pos=8, hs=kind==='sl3'?168:144, F=kind==='sl3'?{sz:8,ch:12,hw:40,d:48,wt:88,x:92,y:96,ms:124}:{sz:28,ch:32,hw:60,d:64,wt:104,x:108,y:112,ms:140};
  var last=null, guard=0, hw0=null;
  while(pos+hs<=n&&guard++<5e6){
    var sz=dv.getUint16(pos+F.sz,true); if(sz<hs||pos+sz>n+1) break;
    var ch=dv.getUint16(pos+F.ch,true);
    if(ch===0||ch===2||ch===9){ /* κύριο κανάλι, downscan ή «primary» κάποιων συσκευών: όχι τα πλαϊνά */
      var d=dv.getFloat32(pos+F.d,true)*FT, x=dv.getInt32(pos+F.x,true), y=dv.getInt32(pos+F.y,true);
      var lon=x/R_LOW*180/Math.PI, lat=(2*Math.atan(Math.exp(y/R_LOW))-Math.PI/2)*180/Math.PI;
      if(okD(d)&&okLL(lat,lon)){ var wt=dv.getFloat32(pos+F.wt,true), hw=dv.getUint32(pos+F.hw,true), ms=dv.getUint32(pos+F.ms,true);
        if(hw0==null&&hw>1e9&&hw<4e9) hw0=hw; var t=hw0!=null?hw0*1000+ms:null; /* η ώρα της συσκευής (Unix) στο πρώτο πλαίσιο + ms από την αρχή */
        var key=lat.toFixed(5)+','+lon.toFixed(5)+','+d.toFixed(1);
        if(key!==last){ out.push({lat:lat,lon:lon,d:d,t:t,wt:(wt>-5&&wt<45&&wt!==0)?wt:null}); last=key; } } }
    pos+=sz; }
  return out; }

/* ---------- NMEA 0183 ---------- */
function nmeaLL(v,h){ if(!v) return NaN; var x=parseFloat(v); if(!isFinite(x)) return NaN; var deg=Math.floor(x/100), m=x-deg*100, r=deg+m/60; return (h==='S'||h==='W')?-r:r; }
function nmea(txt){
  var out=[], lat=NaN, lon=NaN, posAt=-1, line=0, day=null, tod=null, wt=null;
  txt.split(/\r?\n/).forEach(function(L){ line++; var i=L.indexOf('$'); if(i<0) i=L.indexOf('!'); if(i<0) return; var s=L.slice(i+1).split('*')[0], f=s.split(','), ty=(f[0]||'').slice(-3);
    if(ty==='GGA'&&f[6]!=='0'){ lat=nmeaLL(f[2],f[3]); lon=nmeaLL(f[4],f[5]); posAt=line; if(f[1]) tod=f[1]; }
    else if(ty==='RMC'&&f[2]==='A'){ lat=nmeaLL(f[3],f[4]); lon=nmeaLL(f[5],f[6]); posAt=line; if(f[1]) tod=f[1]; if(f[9]&&f[9].length===6) day=f[9]; }
    else if(ty==='GLL'&&f[6]!=='V'){ lat=nmeaLL(f[1],f[2]); lon=nmeaLL(f[3],f[4]); posAt=line; if(f[5]) tod=f[5]; }
    else if(ty==='MTW'){ var w=parseFloat(f[1]); if(isFinite(w)) wt=w; }
    else if(ty==='DPT'||ty==='DBT'||ty==='DBS'){ var d=NaN;
      if(ty==='DPT'){ d=parseFloat(f[1]); var off=parseFloat(f[2]); if(isFinite(d)&&isFinite(off)&&off>0) d+=off; } /* θετικό offset = από τον αισθητήρα ως την επιφάνεια */
      else { d=parseFloat(f[3]); if(!isFinite(d)) d=parseFloat(f[1])*FT; if(!isFinite(d)) d=parseFloat(f[5])*1.8288; }
      if(okD(d)&&okLL(lat,lon)&&line-posAt<40){ var t=null; if(day&&tod&&tod.length>=6){ t=Date.UTC(2000+ +day.slice(4,6),+day.slice(2,4)-1,+day.slice(0,2),+tod.slice(0,2),+tod.slice(2,4),+tod.slice(4,6)); }
        out.push({lat:lat,lon:lon,d:d,t:t,wt:wt}); } } });
  return out; }

/* ---------- GPX ---------- */
function gpx(txt){
  var out=[], doc; try{ doc=new DOMParser().parseFromString(txt,'application/xml'); }catch(e){ return out; }
  var pts=[].slice.call(doc.getElementsByTagName('*')).filter(function(e){ var n=e.localName; return n==='trkpt'||n==='wpt'||n==='rtept'; });
  pts.forEach(function(p){ var la=parseFloat(p.getAttribute('lat')), lo=parseFloat(p.getAttribute('lon')), d=NaN, t=null, wt=null;
    [].slice.call(p.getElementsByTagName('*')).forEach(function(c){ var n=c.localName.toLowerCase(), v=parseFloat(c.textContent);
      if(!isFinite(d)&&(n==='depth'||n==='waterdepth')&&isFinite(v)) d=Math.abs(v);
      else if(n==='time'){ var ms=Date.parse(c.textContent); if(isFinite(ms)) t=ms; }
      else if((n==='wtemp'||n==='watertemp'||n==='temperature')&&isFinite(v)) wt=v; });
    if(okD(d)&&okLL(la,lo)) out.push({lat:la,lon:lo,d:d,t:t,wt:wt}); });
  return out; }

/* ---------- CSV ---------- */
function csv(txt){
  var lines=txt.split(/\r?\n/).filter(function(l){ return l.trim(); }); if(lines.length<2) return [];
  var sep=[';','\t',','].sort(function(a,b){ return lines[0].split(b).length-lines[0].split(a).length; })[0];
  var H=lines[0].split(sep).map(function(x){ return x.trim().replace(/^"|"$/g,'').toLowerCase(); });
  function col(re){ for(var i=0;i<H.length;i++) if(re.test(H[i])) return i; return -1; }
  var iLa=col(/^(lat|latitude|πλάτος|y)\b/), iLo=col(/^(lon|lng|long|longitude|μήκος|x)\b/), iD=col(/depth|βάθος|βαθος/), iT=col(/^(time|date|datetime|timestamp|ώρα)/), iW=col(/temp/);
  if(iLa<0||iLo<0||iD<0) return [];
  var ft=/\bft\b|feet|\(f\)/.test(H[iD]), out=[];
  for(var k=1;k<lines.length;k++){ var c=lines[k].split(sep).map(function(x){ return x.trim().replace(/^"|"$/g,''); });
    function n(i){ return i<0?NaN:parseFloat(String(c[i]).replace(',','.')); }
    var la=n(iLa), lo=n(iLo), d=Math.abs(n(iD)); if(ft) d*=FT;
    var t=iT>=0?Date.parse(c[iT]):NaN, w=n(iW);
    if(okD(d)&&okLL(la,lo)) out.push({lat:la,lon:lo,d:d,t:isFinite(t)?t:null,wt:isFinite(w)?w:null}); }
  return out; }

/* ---------- Humminbird .SON / .DAT ---------- */
function humDat(buf){ var dv=new DataView(buf); if(buf.byteLength<28) return null; var le=buf.byteLength!==64, t=dv.getUint32(20,le); return t>1e9&&t<4e9?t*1000:null; }
function humSon(buf,t0){
  var u8=new Uint8Array(buf), dv=new DataView(buf), n=u8.length, out=[], pos=0, last=null, guard=0;
  function next(from){ for(var i=from;i+3<n;i++) if(u8[i]===0xC0&&u8[i+1]===0xDE&&u8[i+2]===0xAB&&u8[i+3]===0x21) return i; return -1; }
  pos=next(0);
  while(pos>=0&&pos<n&&guard++<5e6){
    var i=pos+4, x=null, y=null, d=null, ms=null, cnt=null, ok=false;
    while(i<n&&i<pos+260){ var tag=u8[i++]; if(tag===0x21){ ok=cnt!=null; break; }
      if(tag>=128){ if(i+4>n) break; var v=dv.getUint32(i,false);
        if(tag===130) x=dv.getInt32(i,false); else if(tag===131) y=dv.getInt32(i,false); else if(tag===135) d=v/10; else if(tag===129) ms=v; else if(tag===160) cnt=v; i+=4; }
      else i+=1; }
    if(ok&&x!=null&&y!=null&&d!=null){ var lat=Math.atan(Math.tan(Math.atan(Math.exp(y/6378388))*2-Math.PI/2)*1.0067642927)*180/Math.PI, lon=x*180/Math.PI/6378388;
      if(okD(d)&&okLL(lat,lon)){ var key=lat.toFixed(5)+','+lon.toFixed(5)+','+d.toFixed(1); if(key!==last){ out.push({lat:lat,lon:lon,d:d,t:t0!=null&&ms!=null?t0+ms:null,wt:null}); last=key; } } }
    var nx=ok&&cnt!=null&&cnt<5e6?i+cnt:pos+4; if(nx+3<n&&u8[nx]===0xC0&&u8[nx+1]===0xDE) pos=nx; else pos=next(Math.max(pos+4,Math.min(nx,n)-4)); }
  return out; }

/* ---------- Garmin .RSD ---------- */
function garmin(buf){
  var u8=new Uint8Array(buf), n=u8.length, out=[], last=null, MAGIC=3085556358, p=0;
  function vu(){ var r=0, m=1, b; do{ if(p>=n) throw 0; b=u8[p++]; r+=(b&0x7f)*m; m*=128; }while(b&0x80&&m<Math.pow(2,64)); return r; }
  function vuB(a){ var r=0, m=1; for(var k=0;k<a.length;k++){ r+=(a[k]&0x7f)*m; m*=128; if(!(a[k]&0x80)) return r; } return NaN; }
  function le(a,signed){ var v=0; for(var k=a.length-1;k>=0;k--) v=v*256+a[k]; if(signed&&a.length===4&&v>=2147483648) v-=4294967296; return v; }
  /* βάθος: VarInt32 με zig-zag κατά την περιγραφή· κάποιες συσκευές γράφουν απλό varint. Αποφασίζεται για όλο το αρχείο:
     με zig-zag όλες οι τιμές είναι ζυγές (θετικό βάθος), με απλό varint περίπου οι μισές μονές. */
  function depthOf(a){ var u=vuB(a); return isNaN(u)?(a.length<=4?le(a):NaN):u; }
  function fields(end){ var cnt=vu(), f=[]; for(var k=0;k<cnt;k++){ if(end!=null&&p>=end) break; var key=vu(), num=Math.floor(key/8), len=key%8; if(len===7) len=vu(); if(p+len>(end!=null?end:n)) break; f.push([num,u8.subarray(p,p+len)]); p+=len; } return f; }
  function find(from){ for(var i=Math.max(2,from);i+3<n;i++) if(u8[i]===0x86&&u8[i+1]===0xDA&&u8[i+2]===0xE9&&u8[i+3]===0xB7) return i-2; return n; }
  var i=20480, guard=0;
  while(i<n-8&&guard++<5e6){ var rec;
    try{ p=i; var hf=fields(null), magic=null, state=null, size=null;
      hf.forEach(function(f){ if(f[0]===0&&f[1].length===4) magic=le(f[1]); else if(f[0]===4&&f[1].length===2) size=le(f[1]); else if(f[0]===1){ var q=p; var sub=u8.subarray(0); var save=p; p=f[1].byteOffset-u8.byteOffset; var e=p+f[1].length; try{ fields(e).forEach(function(g){ if(g[0]===0) state=vuB(g[1]); }); }catch(x){} p=save; } });
      if(magic!==MAGIC||size==null){ i=find(i+1); continue; }
      p+=4; var hl=p-i;
      if(state===2&&size>0){ var be=i+hl+size, lat=null, lon=null, d=null, wt=null;
        try{ fields(be).forEach(function(f){ if(f[0]===1) d=depthOf(f[1]); else if(f[0]===9) lat=le(f[1],true)*360/4294967296; else if(f[0]===10) lon=le(f[1],true)*360/4294967296; else if(f[0]===11&&f[1].length===4) wt=new DataView(f[1].buffer,f[1].byteOffset,4).getFloat32(0,true); }); }catch(x){}
        if(lat>180) lat-=360; if(lon>180) lon-=360;
        if(d!=null&&isFinite(d)&&okLL(lat,lon)){ var key=lat.toFixed(5)+','+lon.toFixed(5)+','+d; if(key!==last){ out.push({lat:lat,lon:lon,d:d,t:null,wt:(wt>-5&&wt<45&&wt!==0)?Math.round(wt*10)/10:null}); last=key; } } }
      var nx=i+hl+(state===2?size:0)+12; if(nx+6<=n&&u8[nx]===6&&le(u8.subarray(nx+2,nx+6))===MAGIC) i=nx; else i=find(Math.max(i+1,nx-16)); }
    catch(e){ i=find(i+1); } }
  var odd=out.filter(function(q){ return q.d%2===1; }).length, zz=odd<=out.length*0.1;
  return out.map(function(q){ q.d=(zz?(q.d%2?-(q.d+1)/2:q.d/2):q.d)/1000; return q; }).filter(function(q){ return okD(q.d); }); }

function kindOf(name,head){ var n=(name||'').toLowerCase();
  if(/\.son$/.test(n)) return 'son'; if(/\.dat$/.test(n)) return 'hdat'; if(/\.rsd$/.test(n)) return 'rsd';
  if(/\.sl2$/.test(n)) return 'sl2'; if(/\.sl3$/.test(n)) return 'sl3';
  if(/\.gpx$/.test(n)) return 'gpx'; if(/\.csv$/.test(n)) return 'csv';
  if(/\.(nmea|n0183|log|txt|nma)$/.test(n)) return 'nmea';
  if(head&&/<gpx/i.test(head)) return 'gpx'; if(head&&/^\s*[$!][A-Z]{5},/m.test(head)) return 'nmea'; return null; }
/* f: File ή {name, buf (ArrayBuffer)} */
function parse(name,buf){ var k=kindOf(name,null);
  if(k==='sl2'||k==='sl3') return {kind:k,pts:sl(buf,k)};
  if(k==='son') return {kind:k,pts:humSon(buf,null)}; if(k==='rsd') return {kind:k,pts:garmin(buf)}; if(k==='hdat') return {kind:k,pts:[],t0:humDat(buf)};
  var txt=new TextDecoder('utf-8').decode(new Uint8Array(buf)); if(!k) k=kindOf('',txt.slice(0,4000));
  if(k==='gpx') return {kind:k,pts:gpx(txt)}; if(k==='csv') return {kind:k,pts:csv(txt)}; if(k==='nmea') return {kind:k,pts:nmea(txt)};
  var p=csv(txt); if(p.length) return {kind:'csv',pts:p}; p=nmea(txt); if(p.length) return {kind:'nmea',pts:p};
  return {kind:null,pts:[]}; }
/* πολλά αρχεία μαζί (Humminbird: .DAT + B00x.SON): η ώρα από το .DAT περνά στα .SON */
function parseMany(files){ var t0=null; files.forEach(function(f){ if(kindOf(f.name)==='hdat') t0=humDat(f.buf); });
  var pts=[], kinds=[]; files.forEach(function(f){ var k=kindOf(f.name,null), r=k==='son'?{kind:k,pts:humSon(f.buf,t0)}:k==='hdat'?{kind:k,pts:[]}:parse(f.name,f.buf); if(r.kind&&kinds.indexOf(r.kind)<0) kinds.push(r.kind); pts=pts.concat(r.pts); });
  return {kind:kinds.join('+')||null,pts:pts}; }
var API={parse:parse,parseMany:parseMany,sl:sl,nmea:nmea,gpx:gpx,csv:csv,humSon:humSon,humDat:humDat,garmin:garmin,kindOf:kindOf};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.AlkSounderParse=API;
})(typeof window!=='undefined'?window:this);
