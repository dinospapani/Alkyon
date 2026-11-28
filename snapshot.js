/* Alkyon 1.14.93 · snapshot: το «παγωμένο στιγμιότυπο» μιας πρόβλεψης (ML Data Foundation).
   Τι είναι: για κάθε ώρα της πρόγνωσης, οι ΕΙΣΟΔΟΙ που είχε μπροστά του ο βαθμός τη στιγμή που υπολογίστηκε (το data contract του score-core:
   τιμή, ποιότητα, πηγή), μαζί με το πότε πάρθηκε, την έκδοση της εφαρμογής και την έκδοση των κανόνων του βαθμού.
   Γιατί: για να μπορεί ΑΡΓΟΤΕΡΑ να αξιολογηθεί ο βαθμός (ή ένα μοντέλο) μόνο με ό,τι ήταν γνωστό ΠΡΙΝ από το αποτέλεσμα. Οι συνθήκες που συμπληρώνονται
   εκ των υστέρων (condH, cond.e του server) δείχνουν τι έγινε, όχι τι προβλεπόταν, και δεν μπαίνουν ποτέ εδώ.

   ΔΕΝ υπολογίζει και ΔΕΝ αλλάζει βαθμό: διαβάζει μόνο το «input» που ήδη επιστρέφει το PF.scoreHour. Δεν περιέχει ML, flag ή πρόβλεψη.
   Δεν περιέχει θέση, όνομα ή άλλο στοιχείο του χρήστη. Καθαρές συναρτήσεις, χωρίς DOM και χωρίς αποθήκευση (τα κάνει το v4/trip-extra.js).

   Μορφή (v = έκδοση της μορφής· αλλάζει αν αλλάξει οτιδήποτε παρακάτω, ώστε παλιά και νέα στιγμιότυπα να μη μπερδεύονται):
     { v:1, at:<ms που πάρθηκε η πρόγνωση>, app:'1.14.93', pf:'android'|'ios'|'web', cfg:'2026.11-1', prof:'boat', sp:'Καλαμάρι'|null,
       cols:['wind','gust',…],            η σειρά των στηλών (όπως τις δίνει το contract)
       src:{wind:'open-meteo',…},         πηγή κάθε στήλης
       h:[[ώρα UTC (ms/3600000), τιμή…, 'oomdx…'], …] }   τελευταίο στοιχείο: ποιότητα ανά στήλη, ένα γράμμα η καθεμία
   Ποιότητα: m μέτρηση · o μοντέλο · e εκτίμηση · d προεπιλογή του config · x λείπει. */
(function(g){
'use strict';
var V=1, QC={meas:'m',model:'o',est:'e','default':'d',missing:'x'}, LATE_MIN=10;
function val(v){ if(typeof v==='number') return isFinite(v)?Math.round(v*100)/100:null; if(typeof v==='string') return v.slice(0,16); return null; }
function build(fc,lat,lon,PF,meta){ meta=meta||{};
  if(!fc||!Array.isArray(fc.days)||!PF||typeof PF.scoreHour!=='function'||typeof PF.sunMoon!=='function') return null;
  var cols=null, src={}, H=[];
  fc.days.forEach(function(d,di){ var sm=null; try{ sm=PF.sunMoon(d.date,+lat,+lon,fc.tz); }catch(e){} if(!sm) return;
    (d.hours||[]).forEach(function(x){ if(!x||x.score==null) return; var e=null; try{ e=PF.scoreHour(sm,x,{dayOffset:di,unc:d.unc}); }catch(er){} if(!e||!e.input) return;
      var inp=e.input; if(!cols) cols=Object.keys(inp);
      var row=[Math.floor((Date.parse(x.t+':00Z')-fc.tz*60000)/3600000)], q='';
      for(var i=0;i<cols.length;i++){ var c=inp[cols[i]]||{}; row.push(val(c.v)); q+=QC[c.q]||'x'; if(c.src&&!src[cols[i]]) src[cols[i]]=String(c.src).slice(0,40); }
      row.push(q); H.push(row); }); });
  if(!cols||!H.length) return null;
  var at=+meta.at; return {v:V,at:at>0?Math.round(at):null,app:meta.app?String(meta.app).slice(0,16):null,pf:meta.pf?String(meta.pf).slice(0,12):null,
    cfg:PF.scoreConfig||null,prof:meta.prof?String(meta.prof).slice(0,12):null,sp:meta.sp?String(meta.sp).slice(0,60):null,cols:cols,src:src,h:H}; }
/* μόνο οι ώρες της εξόδου (ίδιος κανόνας με το scoreH) */
function trim(s,startMs,endMs){ if(!s||!Array.isArray(s.h)||!(startMs>0)||!(endMs>=startMs)) return null;
  var lo=Math.floor(startMs/3600000), hi=Math.floor(endMs/3600000), hs=s.h.filter(function(r){ return Array.isArray(r)&&r[0]>=lo&&r[0]<=hi; });
  if(!hs.length) return null; var o={}; for(var k in s) if(Object.prototype.hasOwnProperty.call(s,k)) o[k]=s[k]; o.h=hs; return o; }
/* «αργό» στιγμιότυπο: πάρθηκε πάνω από LATE_MIN λεπτά μετά την έναρξη (π.χ. χωρίς δίκτυο στην αρχή) ή χωρίς ώρα. Μένει εκτός εκπαίδευσης/αξιολόγησης. */
function late(s,startMs,maxMin){ var m=maxMin!=null?maxMin:LATE_MIN; if(!s||!(s.at>0)||!(startMs>0)) return true; return s.at-startMs>m*60000; }
/* γραμμή → {στήλη:{v,q}} για όποιον το διαβάζει αργότερα (εργαλεία αξιολόγησης) */
function row(s,i){ var r=s&&s.h&&s.h[i]; if(!r) return null; var o={hour:r[0]}, q=String(r[r.length-1]||''); for(var c=0;c<s.cols.length;c++) o[s.cols[c]]={v:r[c+1],q:q.charAt(c)||'x'}; return o; }
function valid(s){ if(!s||s.v!==V||!Array.isArray(s.cols)||!Array.isArray(s.h)||!s.h.length) return false;
  for(var i=0;i<s.h.length;i++){ var r=s.h[i]; if(!Array.isArray(r)||r.length!==s.cols.length+2||typeof r[0]!=='number'||typeof r[r.length-1]!=='string'||r[r.length-1].length!==s.cols.length) return false; }
  return true; }
/* ---------- ουρά ανεβάσματος (καθαρές συναρτήσεις· την αποθήκευση και το δίκτυο τα κάνει το v4/trip-extra.js) ----------
   Το στιγμιότυπο ΔΕΝ μπαίνει στην έξοδο: η έξοδος μοιράζεται με φίλους. Ανεβαίνει σε δικό του πίνακα (trip_snaps), που τον διαβάζει μόνο ο ιδιοκτήτης.
   Στοιχείο ουράς: {id:<κωδικός εξόδου>, snap, uid:<λογαριασμός τη στιγμή που μπήκε ή null>, n:<αποτυχημένες προσπάθειες>}. */
var QMAX=40, QTRIES=8;
function qAdd(q,item,max){ q=Array.isArray(q)?q.slice():[]; if(!item||item.id==null||!valid(item.snap)) return q;
  for(var i=0;i<q.length;i++) if(q[i]&&q[i].id===item.id) return q;                     /* γράφεται μία φορά: δεύτερο στιγμιότυπο για την ίδια έξοδο αγνοείται */
  q.push({id:String(item.id).slice(0,80),snap:item.snap,uid:item.uid||null,n:0}); var m=max||QMAX; while(q.length>m) q.shift(); return q; }
/* τι ανεβαίνει τώρα για αυτόν τον λογαριασμό· ό,τι μπήκε από ΑΛΛΟΝ λογαριασμό δεν ανεβαίνει ποτέ */
function qPick(q,uid){ if(!uid||!Array.isArray(q)) return []; return q.filter(function(x){ return x&&x.id!=null&&valid(x.snap)&&(x.uid==null||x.uid===uid); }); }
/* μετά από προσπάθεια: ok → φεύγουν· αποτυχία → μετρά, και μετά από QTRIES φεύγουν για να μη μένουν για πάντα· ξένου λογαριασμού → φεύγουν */
function qAfter(q,uid,ids,ok){ if(!Array.isArray(q)) return []; var S={}; (ids||[]).forEach(function(i){ S[i]=1; });
  return q.filter(function(x){ return x&&x.id!=null&&(x.uid==null||!uid||x.uid===uid); }).map(function(x){ if(!S[x.id]) return x; if(ok) return null; var y={id:x.id,snap:x.snap,uid:x.uid,n:(x.n||0)+1}; return y.n>=QTRIES?null:y; }).filter(Boolean); }
function qRows(items,uid){ return (items||[]).map(function(x){ return {user_id:uid,trip_id:x.id,snap:x.snap}; }); }
g.AlkyonSnapshot={VERSION:V,LATE_MIN:LATE_MIN,QMAX:QMAX,QTRIES:QTRIES,build:build,trim:trim,late:late,row:row,valid:valid,qAdd:qAdd,qPick:qPick,qAfter:qAfter,qRows:qRows};
})(typeof self!=='undefined'?self:this);
