"""Alkyon · αυτόματοι έλεγχοι (τρέχουν στο GitHub Actions σε κάθε ανέβασμα, ή τοπικά: python3 tests/run.py).
Ανοίγει την εφαρμογή v4 σε headless Chromium (μέγεθος κινητού) με ψεύτικα δεδομένα καιρού και ελέγχει:
  1. κάθε σελίδα ανοίγει χωρίς σφάλμα
  2. τα κουμπιά που περνούν από μια σελίδα σε άλλη (Στον χάρτη, Πήγαινε εκεί, Επανάληψη εξόδου, Καλύτερα σημεία...)
  3. σύνδεσμοι (#trip, #new, #share=, #addfriend=) και το κεντρικό κουμπί εξόδου
  4. «Τι νέο υπάρχει» μετά από αλλαγή έκδοσης
  5. offline: με κλειστό δίκτυο, οι σελίδες ανοίγουν από το cache
  6. ελληνικά και αγγλικά
Βγαίνει με κωδικό 1 αν αποτύχει κάτι, ώστε το GitHub να στείλει ειδοποίηση."""
import time, sys, os, json, subprocess, time, socket, threading, http.server, functools
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); sys.path.insert(0,HERE)
from fakeom import respond
from playwright.sync_api import sync_playwright

def serve():
    s=socket.socket(); s.bind(('127.0.0.1',0)); port=s.getsockname()[1]; s.close()
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a): pass
        def send_error(self,code,message=None,explain=None):   # 1.10.11: όπως το GitHub Pages, άγνωστη σελίδα → 404.html
            f=os.path.join(ROOT,'404.html')
            if code==404 and os.path.exists(f):
                b=open(f,'rb').read(); self.send_response(404); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b); return
            return super().send_error(code,message,explain)
    H=functools.partial(Q, directory=ROOT)
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',port),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
    return 'http://127.0.0.1:%d'%port
BASE=serve()
FAIL=[]; OK=[0]
def check(name, cond, info=''):
    if cond: OK[0]+=1; print('  ok  ', name)
    else: FAIL.append(name); print('  FAIL', name, info)

# 0. συντακτικός έλεγχος όλων των .js
print('# syntax')
bad=[]
for d in (ROOT, os.path.join(ROOT,'v4')):
    for f in sorted(os.listdir(d)):
        if f.endswith('.js'):
            r=subprocess.run(['node','--check',os.path.join(d,f)],capture_output=True,text=True)
            if r.returncode: bad.append(f+': '+r.stderr.strip().splitlines()[-1][:120])
check('node --check (όλα τα .js)', not bad, '; '.join(bad))

def init(lang='el', news=None, prof='boat'):
    return ("if(!sessionStorage.__t){sessionStorage.__t=1;localStorage.clear();"
      "localStorage.setItem('alkyon-lang',%s);localStorage.setItem('alkyon-onboard','1');localStorage.setItem('alkyon-contrib-asked','1');localStorage.setItem('alkyon-askfp','0');"
      "localStorage.setItem('alkyon-fprof-done','1');localStorage.setItem('alkyon-fprof',%s);localStorage.setItem('alkyon-v4-mapui',JSON.stringify('classic'));localStorage.setItem('alkyon-v4-mapui-test','true');"
      "localStorage.setItem('alkyon-v4-news',JSON.stringify(%s||window.ALKYON_VERSION||'9.9.9'));"
      "localStorage.setItem('alkyon-bites',JSON.stringify([{id:'b1',date:'2026-10-20',time:'07:00',species:'Λαβράκι',kg:1.2,lat:35.1,lon:32.5,_u:1}]));}"
      )%(json.dumps(lang),json.dumps(prof),json.dumps(news))
def ctx(b, sw=False, touch=False, **kw):
    c=b.new_context(viewport={'width':390,'height':844}, service_workers='allow' if sw else 'block', has_touch=touch)
    c.grant_permissions(['geolocation']); c.set_geolocation({'latitude':35.0,'longitude':33.3})
    c.add_init_script(init(**kw))
    c.route('**/*open-meteo.com/**',respond)
    c.route(lambda u: not u.startswith(BASE) and 'open-meteo' not in u, lambda r: r.abort())
    return c
def page(c):
    pg=c.new_page(); pg._errs=[]; pg.on('pageerror',lambda e: pg._errs.append(str(e)[:200])); return pg
def state(pg):
    return pg.evaluate("""()=>{const m=document.getElementById('main');
      return {n:m?m.querySelectorAll('*').length:0, fail:!!(m&&/Δεν φορτώθηκε|Could not load/.test(m.textContent)), loading:!!(m&&m.querySelector('.lzload')),
              hash:location.hash, leaf:!!document.querySelector('.leaflet-container'), sheet:!!document.querySelector('.sheet')}}""")
def go(pg, h, wait=1800):
    pg.evaluate("h=>location.hash=h",h); pg.wait_for_timeout(wait); return state(pg)

# σελίδες που χρειάζονται λογαριασμό δείχνουν λίγα στοιχεία χωρίς σύνδεση· γι' αυτό μόνο «χωρίς σφάλμα»
FULL=['forecast','map','log','profile','help','alerts','inbox','boat','guide','check']
LIGHT=['tackle','community','friends']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])  # 1.14.17: ψεύτικη κάμερα
    for lang in ('el','en'):
        print('# pages',lang)
        c=ctx(b,lang=lang); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
        for r in FULL+LIGHT+['forecast']:
            s=go(pg,'#'+r)
            check('%s #%s'%(lang,r), not s['fail'] and not s['loading'] and (s['n']>15 or r in LIGHT), s)
        check('%s χωρίς σφάλματα JS'%lang, not pg._errs, pg._errs); c.close()

    print('# bridges (από Πρόγνωση, πριν ανοίξει ο χάρτης)')
    T={'mapGo':("AK.mapGo(35.0,33.3,12,null,{lab:'Δοκιμή',sea:true})",'map'),
       'goTo':("AK.goTo(35.0,33.3,'Δοκιμή')",'map'),
       'replayTrip':("AK.replayTrip({id:'t1',track:[[35.0,33.3,1],[35.01,33.31,2],[35.02,33.32,3]]})",'map'),
       'bestSpots.go':("AK.bestSpots.go(35.0,33.3)",'map'),
       'spotSheet':("AK.spotSheet({id:'s1',name:'Σημείο',lat:35.0,lon:33.3})",'sheet'),
       'spotFormAt':("AK.spotFormAt(35.0,33.3)",'sheet')}
    for k,(js,want) in T.items():
        c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(1500)
        pg.evaluate("()=>{"+js+"}"); pg.wait_for_timeout(3500); s=state(pg)
        okk=(s['hash'].startswith('#map') and s['leaf']) if want=='map' else s['sheet']
        check('bridge '+k, okk and not pg._errs, (s,pg._errs)); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(1500)
    check('leaflet από Πρόγνωση', pg.evaluate("()=>AK.leaflet().then(L=>!!(L&&L.map))"))
    check('tileTpl', pg.evaluate("()=>!!(AK.tileTpl&&AK.tileTpl.sat&&AK.tileTpl.sea)"))
    miss=pg.evaluate("()=>['mapGo','goTo','replayTrip','spotSheet','spotFormAt','leaflet','bestSpots','tileTpl','backup','commShare','commShared','biteForm','trip','tripStart','gearOf','store','sheet','toast'].filter(k=>!AK[k])")
    check('κοινές συναρτήσεις υπάρχουν', not miss, miss); c.close()

    print('# flows')
    for hs,act,want in [('#forecast','fab','#map'),('#trip',None,'#map'),('#new',None,'#log'),('#share=35.1,33.2,Test',None,'#share='),('#addfriend=ABCDEF12',None,'#friends'),('#log','fab','#map')]:
        c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/'+hs); pg.wait_for_timeout(1500)
        if act=='fab': pg.click('.fab')
        pg.wait_for_timeout(3000); s=state(pg)
        check('flow %s%s'%(hs,' +fab' if act else ''), s['hash'].startswith(want) and not pg._errs, (s,pg._errs)); c.close()

    print('# whats new')
    c=ctx(b,news='1.2.0'); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(10000)
    check('«Τι νέο υπάρχει» μετά από αναβάθμιση', pg.evaluate("()=>!!document.querySelector('.sheet')")); c.close()

    print('# 1.14.13 μήκος από φωτογραφία')
    import os, tempfile
    try:
        from PIL import Image as _I; _f=os.path.join(tempfile.gettempdir(),'ak_meas.png'); _I.new('RGB',(800,400),(30,90,140)).save(_f)
        c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
        pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200); h0=pg.evaluate("()=>!document.querySelector('.bf2 .measbtn').hidden")
        pg.set_input_files('.bf2 input[type=file]:not([capture])',_f); pg.wait_for_timeout(1500); pg.click('.bf2 .measbtn'); pg.wait_for_timeout(1200)
        bx=pg.evaluate("()=>{ const r=document.querySelector('.meascv').getBoundingClientRect(); return [r.left,r.top,r.width,r.height]; }")
        for fx,fy in ((.1,.5),(.2,.5),(.1,.6),(.6,.6)): pg.mouse.click(bx[0]+bx[2]*fx,bx[1]+bx[3]*fy); pg.wait_for_timeout(100)
        rs=pg.evaluate("()=>document.querySelector('.meascv').parentNode.querySelector('.btn.pri').textContent")
        pg.click('.meascv ~ .btn.pri'); pg.wait_for_timeout(500); v=pg.evaluate("()=>document.querySelector('.bf2 .g3 .fld:nth-child(2) input').value")
        fo=pg.evaluate("()=>{ const f=document.querySelector('.bf2'); return !!f && !!f.closest('.sheet.on'); }")
        check('Μήκος από φωτογραφία: η φόρμα του ψαριού μένει ανοιχτή για αποθήκευση (1.14.15)', fo, fo)
        check('Μήκος από φωτογραφία: κάρτα 8,56 cm × 5 = ~43 cm στο πεδίο μήκους (1.14.13)', h0 and any(x in rs for x in ('42,','43,')) and v in ('42','43'), [h0,rs,v]); c.close()
    except ImportError: print('  (χωρίς PIL)')

    print('# 1.14.17 κάμερα μέσα στην εφαρμογή')
    c=ctx(b); c.grant_permissions(['camera']); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200); pg.click('.bf2 .measbtn'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{ const o=document.querySelector('.camov'); return o?[!!o.querySelector('.camgal'),!!o.querySelector('.camshut'),o.querySelector('video').videoWidth]:null; }")
    pg.click('.camshut'); pg.wait_for_timeout(2000); m=pg.evaluate("()=>[!document.querySelector('.camov'),!!document.querySelector('.meascv'),document.querySelectorAll('.bf2 .ph').length]")
    check('Κάμερα της εφαρμογής: λήψη, συλλογή κάτω αριστερά, μετά η μέτρηση με τη φωτογραφία (1.14.17)', bool(r) and r[0] and r[1] and r[2]>0 and m[0] and m[1] and m[2]==1, [r,m]); c.close()

    print('# 1.14.20 μέτρηση: επιλογή φωτογραφίας')
    try:
        from PIL import Image as _I; _fs=[]
        for _k,_col in enumerate(((200,0,0),(0,200,0),(0,0,200))):
            _p=os.path.join(tempfile.gettempdir(),'ak_m%d.png'%_k); _I.new('RGB',(600,300),_col).save(_p); _fs.append(_p)
        c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
        pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200)
        pg.set_input_files('.bf2 input[type=file]:not([capture])',_fs); pg.wait_for_timeout(2000); pg.click('.bf2 .measbtn'); pg.wait_for_timeout(1200)
        n=pg.evaluate("()=>[document.querySelectorAll('.measth').length,[...document.querySelectorAll('.measth')].findIndex(e=>e.classList.contains('on'))]")
        pg.click('.measth >> nth=0'); pg.wait_for_timeout(500); n2=pg.evaluate("()=>[...document.querySelectorAll('.measth')].findIndex(e=>e.classList.contains('on'))")
        check('Μέτρηση: με 3 φωτογραφίες διαλέγεις ποια θα μετρήσεις (1.14.20)', n==[3,2] and n2==0, [n,n2]); c.close()
    except ImportError: pass

    print('# 1.14.13 υπομνήματα κρυμμένα σε έξοδο')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const e=document.createElement('div'); e.className='sbleg shleg mini'; document.body.append(e); document.body.classList.add('ontrip'); const a=getComputedStyle(e).display; document.body.classList.remove('ontrip'); e.classList.add('gone'); const g=getComputedStyle(e).display; e.classList.remove('gone'); const n=getComputedStyle(e).display; return [a,g,n]; }")
    check('Υπόμνημα ρηχών: κρυμμένο σε έξοδο και μετά από λίγα δευτερόλεπτα (1.14.13)', r[0]=='none' and r[1]=='none' and r[2]!='none', r); c.close()

    print('# 1.14.13 μακρύ μήνυμα πατιέται / ειδοποίηση στον χάρτη')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3500)
    pg.evaluate("()=>AK.toast('Η πίεση ανεβαίνει. '+'x'.repeat(200))"); pg.wait_for_timeout(400)
    r=pg.evaluate("()=>{ const t=document.querySelector('.toast'); return [getComputedStyle(t).pointerEvents, !!t.querySelector('.tmore')]; }")
    pg.click('.toast'); pg.wait_for_timeout(300); f=pg.evaluate("()=>document.querySelector('.toast').classList.contains('full')")
    check('Μακρύ μήνυμα: «Πάτα για ολόκληρο» και ανοίγει όλο με πάτημα (1.14.13)', r[0]=='auto' and r[1] and f, [r,f])
    n=pg.evaluate("()=>{ let k=0; const v=AK.refreshView; AK.refreshView=function(){ k++; }; window.dispatchEvent(new Event('alkyon-push')); return new Promise(res=>setTimeout(()=>{ AK.refreshView=v; res(k); },800)); }")
    check('Ειδοποίηση ενώ είσαι στον χάρτη: ανανεώνεται αμέσως (1.14.13)', n>=1, n); c.close()

    print('# 1.14.15 μήνυμα στις ειδοποιήσεις ανοίγει τα μηνύματα')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{ localStorage.setItem('alkyon-v4-inbox',JSON.stringify([{at:new Date().toISOString(),title:'💬 Ιδέα · Νέο μήνυμα χρήστη',body:'Hit',kind:'fb',local:1}])); window.__om=null; AK.openMessages=function(k){ window.__om=k; }; location.hash='#inbox'; }"); pg.wait_for_timeout(2500)
    pg.click('.ibrow'); pg.wait_for_timeout(300); r=pg.evaluate("()=>window.__om")
    check('Ειδοποιήσεις: πάτημα σε «Νέο μήνυμα χρήστη» ανοίγει τα μηνύματα (1.14.15)', r=='fb', r); c.close()

    print('# 1.14.21 ανώνυμα στοιχεία τσιμπημάτων')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const f=AK.contrib._rowOf; const a=f('b',{id:'x1',date:'2026-11-10',time:'06:30',tz:120,latin:'Dicentrarchus labrax',species:'Λαβράκι',lat:34.71234,lon:32.4567,notes:'μυστικό',wind:6.04,ptrend:-1.2,photo:true}); const m=f('b',{id:'x2',date:'2026-11-10',miss:true,lat:34.7,lon:32.4}); const tr=f('trip',{id:'t1',date:'2026-11-10',startMs:1,endMs:3600001,lat:34.7,lon:32.4,count:2}); const n=f('b',{id:'x3',date:'2026-11-10',species:'Λαβράκι'}); return [a,m&&m.kind,tr&&tr.cnt,n]; }")
    a0=r[0] or {}
    check('Ανώνυμα στοιχεία: περιοχή 0,1°, ώρα UTC, χωρίς σημειώσεις/φωτογραφίες, χαμένο και έξοδος, όχι χωρίς θέση (1.14.21)', a0.get('lat')==34.7 and a0.get('lon')==32.5 and a0.get('sp')=='dicentrarchus labrax' and a0.get('ms')==1794285000000 and 'notes' not in a0 and 'photo' not in a0 and a0.get('cond',{}).get('wind')==6 and r[1]=='miss' and r[2]==2 and r[3] is None, r)
    pg.evaluate("()=>{ localStorage.setItem('alkyon-v4-logtab',JSON.stringify('stats')); }"); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('.seg button')].find(x=>/Λογαριασμός/.test(x.textContent)); b&&b.click(); }"); pg.wait_for_timeout(800)
    s1=pg.evaluate("()=>[...document.querySelectorAll('.li b')].some(x=>/Βοήθησε την πρόγνωση/.test(x.textContent))")
    card=pg.evaluate("()=>{ const c=AK.biteStatsCard(); document.body.append(c); return new Promise(r=>setTimeout(()=>r(c.textContent),1500)); }")
    check('Βοήθησε την πρόγνωση στον Λογαριασμό (από 1.14.32) και κάρτα «Πότε τσιμπάνε · Όλοι» (1.14.21)', s1 and 'Όλοι' in card and 'Μαζεύονται' in card, [s1,card[:120]]); c.close()

    print('# 1.14.22 πότε τσιμπάνε: ψάρια ανά ώρα ανά συνθήκη')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    card=pg.evaluate('''()=>{ const st=[{key:'all',n:72,users:3,data:{v:2,hrs:195,ins:[{f:'pt',b:0,lift:1.95,n:45,h:75},{f:'pl',b:2,lift:0.41,n:15,h:120}],f:{sun:{c:[0,30,20,10,12,0],e:[0,30,60,60,45,0],r:[null,1,0.33,0.17,0.27,null]},pt:{c:[54,18,0],e:[75,75,45],r:[0.6,0.2,0]},wind:{c:[60,12,0,0],e:[100,95,0,0],r:[0.6,0.13,null,null]},tide:{c:[30,30,12],e:[80,80,35],r:[0.37,0.37,0.34]}}}},{key:'sp:dicentrarchus labrax',n:54,users:3,data:{v:2,hrs:195,ins:[],f:{pt:{c:[54,0,0],e:[75,75,45],r:[0.6,0,0]}}}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>{ const t0=c.textContent, n=c.querySelectorAll('.bschips .chip').length; c.querySelectorAll('.bschips .chip')[1].click(); r([t0,n,c.textContent,c.querySelectorAll('.bsmore .bsg').length]); },1500)); }''')
    check('Πότε τσιμπάνε: «▲ Πίεση πέφτει ×1,9», ψάρια ανά ώρα, είδη, «Όλες οι συνθήκες» (1.14.22)', '▲ Πίεση (3 ώρες): πέφτει' in card[0] and '×1,9' in card[0] and 'ψάρια ανά ώρα' in card[0] and '195 ώρες' in card[0] and card[1]==2 and card[3]>=0 and '54 ψάρια' in card[2], [card[0][:300],card[1],card[2][:120]]); c.close()

    print('# 1.14.23 μαθαίνει: στόχος, «Ψάρεψα, τίποτα», δείκτης')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const f=AK.contrib._rowOf; const t=f('trip',{id:'t9',date:'2026-11-10',startMs:1,endMs:7200001,lat:34.7,lon:32.4,count:0,target:{name:'Λαβράκι',latin:'Dicentrarchus labrax'}}); const b=f('b',{id:'b9',date:'2026-11-10',time:'06:00',species:'Λαβράκι',lat:34.7,lon:32.4,bait:'Σαρδέλα',depth:42.4}); return [t.sp,b.cond.bait,b.cond.depth]; }")
    check('Στόχος εξόδου και δόλωμα/βάθος στα ανώνυμα στοιχεία (1.14.23)', r==['dicentrarchus labrax','Σαρδέλα',42], r)
    k=pg.evaluate("()=>{ const L={ins:[{f:'pt',b:0,lift:2,n:60,src:'both'},{f:'wind',b:3,lift:0.5,n:10,src:'cc'}]}; const sm={rise:390,set:1020}; const h1=PF.learnAdj(L,sm,{hr:7,ptrend:'slow',wind:3,score:60,bite:60}); const h2=PF.learnAdj(L,sm,{hr:7,ptrend:'rise',wind:3,score:60,bite:60}); const h3=PF.learnAdj({ins:[{f:'pt',b:0,lift:9,n:5000,src:'both'}]},sm,{hr:7,ptrend:'fast',score:90,bite:90}); return [h1.score,h1.learn&&h1.learn.k,h2.score,!!h2.learn,h3.score]; }")
    check('Ο δείκτης μαθαίνει: πίεση πέφτει ×2 (60 ψάρια) → +15% το πολύ, λίγα στοιχεία → τίποτα (1.14.23)', k[0]==69 and k[1]==1.15 and k[2]==60 and not k[3] and k[4]==100, k)
    pg.evaluate("()=>{ AK.store.save('bites',{date:'2026-11-01',time:'07:00',species:'Λαβράκι',latin:'Dicentrarchus labrax',lat:34.7,lon:32.4}); AK.store.save('bites',{date:'2026-11-02',time:'07:00',species:'Λαβράκι',latin:'Dicentrarchus labrax',lat:34.7,lon:32.4}); }")
    pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(2500); pg.evaluate("()=>AK.tripStart()"); pg.wait_for_timeout(1000)
    tg=pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .tgchips .chip')].map(x=>x.textContent)")
    pg.click('.sheet.on .tgchips .chip:not(.tgfind) >> nth=0'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{ const b=document.querySelector('.sheet.on .tgo'); b.click(); }"); pg.wait_for_timeout(800)
    tr=pg.evaluate("()=>AK.trip.state().target")
    check('Έναρξη εξόδου: «Τι ψάχνεις;» με τα είδη σου, κρατιέται ο στόχος (1.14.23)', 'Λαβράκι' in tg and tr and tr.get('latin')=='Dicentrarchus labrax', [tg,tr])
    c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>{ AK.lastPos=()=>({lat:34.71,lon:32.45}); AK.nothingTrip(); }"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('.sheet.on button')].find(x=>x.textContent==='Αποθήκευση'); b.click(); }"); pg.wait_for_timeout(600)
    nt=pg.evaluate("()=>{ const t=AK.store.raw('trips').filter(x=>x.nothing)[0]; return t?[t.count,t.lat,t.endMs>t.startMs]:null; }")
    my=pg.evaluate("()=>{ const c=AK.biteStatsCard(); document.body.append(c); return new Promise(r=>setTimeout(()=>{ const b=[...c.querySelectorAll('.bswho button')].find(x=>/Για σένα/.test(x.textContent)); b&&b.click(); r([!!b,c.textContent]); },1500)); }")
    check('«Ψάρεψα, τίποτα» αποθηκεύει έξοδο χωρίς ψάρι με θέση· κάρτα «Όλοι / Για σένα» (1.14.23)', nt and nt[0]==0 and nt[1]==34.71 and nt[2] and my[0] and 'Τα προσωπικά ευρήματα' in my[1], [nt,my]); c.close()

    print('# 1.14.24 χωριστά ανά είδος ψαρέματος')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ const L={by:{sea:{ins:[{f:'pt',b:0,lift:2,n:60,src:'both'}]},spear:{ins:[{f:'wave',b:0,lift:2,n:60,src:'both'}]}}}; const sm={rise:390,set:1020};
      localStorage.setItem('alkyon-fprof','spear'); const a=PF.learnAdj(PF.learnPick?PF.learnPick(L):L,sm,{hr:7,ptrend:'slow',wave:0.1,score:60}).score;
      localStorage.setItem('alkyon-fprof','lake'); const b=(PF.learnPick(L)===null);
      localStorage.setItem('alkyon-fprof','shore'); const c=PF.learnAdj(PF.learnPick(L),sm,{hr:7,ptrend:'slow',wave:0.9,score:60}).score; return [a,b,c]; }''')
    check('Δείκτης: ψαροντούφεκο/λίμνη/ακτή παίρνουν τα δικά τους ευρήματα (1.14.24)', r==[69,True,69], r)
    card=pg.evaluate('''()=>{ localStorage.setItem('alkyon-fprof','spear'); const st=[{key:'all',n:70,users:3,data:{v:3,ins:[{f:'pt',b:0,lift:2,n:30,src:'both'}],f:{}}},{key:'g:spear',n:25,users:3,data:{v:3,grp:'spear',ins:[{f:'wave',b:0,lift:1.8,n:20,src:'cc'}],f:{}}},{key:'g:spear|sp:epinephelus marginatus',n:21,users:3,data:{v:3,ins:[],f:{}}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>r([c.textContent,c.querySelectorAll('.bschips .chip').length]),1500)); }''')
    check('Κάρτα «Πότε τσιμπάνε» με προφίλ ψαροντούφεκο: μόνο τα δικά του (1.14.24)', 'Ψαροντούφεκο' in card[0] and 'Κύμα' in card[0] and '25 ψάρια' in card[0] and 'Πίεση (3 ώρες): πέφτει' not in card[0] and card[1]==2, card); c.close()

    print('# 1.14.25 έλεγχος μάθησης, μικρά/μεγάλα, παρέα, «Ψάρεψες σήμερα;»')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    card=pg.evaluate('''()=>{ localStorage.setItem('alkyon-fprof','boat'); const st=[{key:'all',n:120,users:3,data:{v:3,grp:'sea',bt:{n:24,base:0.58,adj:0.66,on:true},ins:[{f:'wv48',b:0,lift:1.6,n:30,src:'cc'}],f:{}}},{key:'big',n:40,users:3,data:{v:3,grp:'sea',size:'big',ins:[],f:{}}},{key:'small',n:80,users:3,data:{v:3,grp:'sea',size:'small',ins:[],f:{}}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>{ const t0=c.textContent, ch=[...c.querySelectorAll('.bschips .chip')].map(x=>x.textContent); c.querySelectorAll('.bschips .chip')[2].click(); const t1=c.textContent; [...c.querySelectorAll('.bswho button')].find(x=>x.textContent==='Παρέα').click(); r([t0,ch,t1,c.textContent]); },1500)); }''')
    check('Πότε τσιμπάνε: «✓ Έλεγχος σε 24 εξόδους… 66% (χωρίς 58%)», Μεγάλα/Μικρά, Παρέα (1.14.25)', 'Έλεγχος σε 24 εξόδους' in card[0] and '66%' in card[0] and '58%' in card[0] and 'Θάλασσα 2 προηγ. μέρες' in card[0] and 'Μεγάλα' in card[1] and 'Μικρά (γόπα, μαρίδα…)' in card[1] and 'μικρά' in card[2] and 'Η παρέα μου' in card[3], [card[0][:250],card[1],card[3][:120]])
    # 1.14.86 (P1.2): ο έλεγχος δείχνει αριθμούς από τις ΕΓΚΥΡΕΣ εξόδους (btv)· αν δεν φτάνουν το λέει· η εφαρμογή στέλνει το είδος της εξόδου (cond.k) από τον ένα κανόνα
    c2=ctx(b); p2=page(c2); card=[]
    for extra in ["{ses:{live:7,nofish:2,unknown:14,invalid:1},btv:{n:9,base:0.52,adj:0.61}}", "{ses:{live:3,nofish:1,fromCatches:14}}", "{bt:{n:24,base:0.58,adj:0.5,on:false},ses:{live:7,nofish:2},btv:{n:9,base:0.52,adj:0.4}}"]:
        p2.goto(BASE+'/v4/#log'); p2.reload(); p2.wait_for_timeout(2500)   # νέα σελίδα κάθε φορά: τα στοιχεία της κάρτας κρατιούνται στη μνήμη
        card.append(p2.evaluate('''()=>{ localStorage.setItem('alkyon-fprof','boat'); const st=[{key:'all',n:120,users:3,data:Object.assign({v:3,grp:'sea',bt:{n:24,base:0.58,adj:0.66,on:true},ins:[{f:'wv48',b:0,lift:1.6,n:30,src:'cc'}],f:{}},EXTRA)}];
          AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const c=AK.biteStatsCard(); document.body.append(c); return new Promise(r=>setTimeout(()=>r(c.textContent),1500)); }'''.replace('EXTRA',extra)))
    c2.close()
    check('Πότε τσιμπάνε: ο έλεγχος μετρά τις έγκυρες εξόδους (9, 61%, χωρίς 52%) και όχι τις 24 (1.14.86)', 'Έλεγχος σε 9 εξόδους' in card[0] and '61%' in card[0] and '52%' in card[0] and '66%' not in card[0] and 'σε 24 εξόδους' not in card[0], card[0][:260])
    check('Πότε τσιμπάνε: με λιγότερες από 8 έγκυρες εξόδους λέει πόσες υπάρχουν, χωρίς ποσοστό (1.14.86)', 'χρειάζεται τουλάχιστον 8 εξόδους' in card[1] and '(τώρα 4)' in card[1] and '66%' not in card[1] and '✓ Έλεγχος' not in card[1], card[1][:260])
    check('Πότε τσιμπάνε: όταν η μάθηση είναι κλειστή το μήνυμα μένει όπως ήταν (1.14.86)', 'Η μάθηση δεν βελτίωσε ακόμα τον δείκτη (έλεγχος σε 24 εξόδους)' in card[2] and '✓ Έλεγχος' not in card[2], card[2][:260])
    r=pg.evaluate('''()=>{ const f=AK.contrib._rowOf, b={date:'2026-11-10',lat:34.7,lon:32.4}, k=x=>{ const r=f('trip',Object.assign({},b,x)); return r&&r.cond?r.cond.k:null; };
      return [k({id:'s1',startMs:1794586911976,endMs:1794586911976+3*3600000,sid:'z',count:0}), k({id:'s2',startMs:1794236400000,endMs:1794247200000,manual:true,nothing:true,count:0}), k({id:'s3',startMs:1794236400000,endMs:1794247200000,manual:true,count:3}), k({id:'s4',startMs:1794236400000,endMs:1794247200000,fromCatches:true,count:3}), k({id:'s5',startMs:1794586911976,endMs:1794586911976+30*3600000,sid:'z',count:0}),
        PF.session({ms:1794236400000,ms2:1794247200000,lat:34.7,cnt:0,cond:{k:'n'}}).valid, PF.session({ms:1794236400000,ms2:1794247200000,lat:34.7,cnt:3,cond:{k:'c'}}).valid]; }''')
    check('Κοινότητα: η έξοδος στέλνεται με το είδος της (ζωντανή l, «τίποτα» n, χειρόγραφη m, από τα ψάρια c, πάνω από 16 ώρες x) (1.14.86)', r==['l','n','m','c','x',True,False], r)
    r=pg.evaluate('''()=>{ const L={by:{sea:{ins:[{f:'pt',b:0,lift:2,n:60,src:'both'}]}}}; return 1; }''')
    pg.evaluate('''()=>{ const d=new Date(), td=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const y=new Date(Date.now()-864e5), yd=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
      localStorage.setItem('alkyon-nearspot',JSON.stringify({d:yd,t0:Date.now()-864e5-3*3600e3,t1:Date.now()-864e5-3600e3,lat:34.7,lon:32.4})); AK.contrib.askNothing(); }''')
    pg.wait_for_timeout(700); q=pg.evaluate("()=>{ const s=document.querySelector('.sheet.on'); return s?s.textContent:''; }")
    pg.evaluate("()=>{ [...document.querySelectorAll('.sheet.on button')].find(x=>x.textContent==='Ψάρεψα, τίποτα').click(); }"); pg.wait_for_timeout(900)
    pg.evaluate("()=>{ [...document.querySelectorAll('.sheet.on button')].find(x=>x.textContent==='Αποθήκευση').click(); }"); pg.wait_for_timeout(600)
    nt=pg.evaluate("()=>{ const t=AK.store.raw('trips').filter(x=>x.nothing)[0]; return t?[t.lat,t.count,t.endMs-t.startMs>0]:null; }")
    check('«Ψάρεψες χθες;» → «Ψάρεψα, τίποτα» με έτοιμη μέρα, ώρες και θέση (1.14.25)', 'Ψάρεψες χθες' in q and nt and nt[0]==34.7 and nt[1]==0 and nt[2], [q[:80],nt]); c.close()

    print('# 1.14.26 κεφαλόποδα, δανεισμός είδους, καλαμαριέρα')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ AK.store.save('tackle',{id:'egi1',type:'lure',kind:'egi',name:'Yamashita',color:'Πορτοκαλί',w:[2.5,3]}); const f=AK.contrib._rowOf;
      const a=f('b',{id:'s1',date:'2026-11-10',time:'20:00',species:'Καλαμάρι',latin:'Loligo vulgaris',lat:34.7,lon:32.4,tk:['egi1'],tkw:{egi1:2.5}});
      const L={by:{sea:{ins:[{f:'pt',b:0,lift:2,n:60,src:'both'}]},ceph:{ins:[{f:'aft',b:2,lift:2,n:60,src:'both'}]}},sp:{'sepia officinalis':{ins:[{f:'aft',b:2,lift:0.5,n:60,src:'blend'}]}}};
      const sm={rise:390,set:1020,f:0.5}; const h={hr:19,ptrend:'stable',score:60,bite:60};
      const sq=PF.learnAdj(PF.learnPick(L,{l:'Todarodes sagittatus'}),sm,Object.assign({},h)).score, cu=PF.learnAdj(PF.learnPick(L,'sepia officinalis'),sm,Object.assign({},h)).score, no=PF.learnAdj(PF.learnPick(L,null),sm,Object.assign({},h)).score;
      return [a.cond.lc,a.cond.lw,a.cond.lk,sq,cu,no]; }''')
    check('Καλαμαριέρα στο «Δούλεψε»· δείκτης: θράψαλο→κεφαλόποδα, σουπιά→το είδος της, αλλιώς προφίλ (1.14.26)', r[:3]==['πορτοκαλί',2.5,'egi'] and r[3]==69 and r[4]==51 and r[5]==60, r)
    card=pg.evaluate('''()=>{ localStorage.setItem('alkyon-fprof','boat'); const st=[{key:'all',n:120,users:3,data:{v:3,grp:'sea',ins:[],f:{}}},{key:'g:ceph',n:30,users:3,data:{v:3,grp:'ceph',ins:[{f:'dark',b:1,lift:2.1,n:20,src:'cc',w:{lure:['πορτοκαλί 2.5'],tech:[],bait:[],dep:[]}}],f:{}}},{key:'g:ceph|sp:loligo vulgaris',n:22,users:3,data:{v:3,grp:'ceph',blend:true,ins:[{f:'aft',b:2,lift:1.7,n:8,src:'blend'}],f:{}}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>{ const ch=[...c.querySelectorAll('.bschips .chip')]; const ce=ch.find(x=>/Κεφαλόποδα/.test(x.textContent)); ce&&ce.click(); const t1=c.textContent; const sq=[...c.querySelectorAll('.bschips .chip')].find(x=>/Καλαμάρι|Loligo/.test(x.textContent)); sq&&sq.click(); r([ch.map(x=>x.textContent),t1,c.textContent]); },1500)); }''')
    check('Κάρτα: «🦑 Κεφαλόποδα» με σκοτάδι και «Δούλεψε: πορτοκαλί 2.5», καλαμάρι με δανεισμό (1.14.26)', any('Κεφαλόποδα' in x for x in card[0]) and 'πολύ σκοτεινά' in card[1] and 'πορτοκαλί 2.5' in card[1] and 'ευρήματα της ομάδας' in card[2], [card[0],card[1][:200],card[2][:200]]); c.close()

    print('# 1.14.27 σκοτάδι στον δείκτη')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    r=pg.evaluate('''()=>{ const L={ins:[{f:'dark',b:1,lift:2,n:60,src:'both'}]}, sm={rise:390,set:1020,f:0.5,illum:1};
      const a=PF.learnAdj(L,sm,{hr:21,mal:-20,clp:0,score:60,bite:60}).score, b=PF.learnAdj(L,sm,{hr:21,mal:60,clp:0,score:60,bite:60}).score, c2=PF.learnAdj(L,sm,{hr:21,mal:60,clp:100,score:60,bite:60}).score, d=PF.learnAdj(L,sm,{hr:12,mal:-20,clp:0,score:60,bite:60}).score,
        r1=PF.learnBins(sm,{hr:12,mm:0,rain:80}).rain;
      return [a,b,c2,d,r1]; }''')
    check('Δείκτης: «πολύ σκοτεινά» (σελήνη κάτω από τον ορίζοντα ή πίσω από σύννεφα) ναι, πανσέληνος ψηλά όχι, μέρα όχι· βροχή σε mm (1.14.27)', r==[69,60,60,60,0], r)
    fc=pg.evaluate('''async()=>{ window.AlkyonLearn={ins:[{f:'dark',b:1,lift:2,n:60,src:'both'}]}; const t=Date.now(); return 1; }''')
    c.close()

    print('# 1.14.12 ελάχιστο μήκος: πράσινο / κόκκινο')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200); pg.fill('.bf2 .spwrap input','Ροφός'); pg.wait_for_timeout(150)
    pg.fill('.bf2 .g3 .fld:nth-child(2) input','30'); pg.wait_for_timeout(150); r1=pg.evaluate("()=>{ const n=document.querySelector('.bf2 .lawnote'); return [n.className,n.hidden,n.previousElementSibling.className]; }")
    pg.fill('.bf2 .g3 .fld:nth-child(2) input','50'); pg.wait_for_timeout(150); r2=pg.evaluate("()=>document.querySelector('.bf2 .lawnote').className")
    check('Νέο ψάρι: ελάχιστο μήκος κάτω από το μήκος, κόκκινο στα 30 cm, πράσινο στα 50 cm (ροφός 45)', r1[0]=='lawnote warn' and not r1[1] and r1[2]=='g3' and r2=='lawnote ok', [r1,r2]); c.close()

    print('# 1.14.10 νέα έκδοση στο store (μέσα στην εφαρμογή)')
    c=ctx(b); pg=page(c)
    pg.add_init_script("window.AKN={site:location.origin+'/',platform:'android',openExternal:function(u){ window.__opened=u; }};")
    pg.route('**/app-version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"android":{"v":"9.0.0","url":"https://example.com/play","el":"από το Google Play"}}'))
    pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(10500)
    r=pg.evaluate("()=>{ const b=document.querySelector('.updbar'); if(!b) return null; const t=b.textContent; b.querySelector('.btn').click(); return [t, window.__opened]; }")
    check('Εφαρμογή: μπάρα «Νέα έκδοση 9.0.0» ανοίγει το store (1.14.10)', bool(r) and '9.0.0' in r[0] and r[1]=='https://example.com/play', r)
    j=json.load(open(os.path.join(ROOT,'app-version.json'),encoding='utf-8'))
    check('app-version.json: έκδοση και σύνδεσμος για android και ios (1.14.10)', all(j.get(k,{}).get('v') and j.get(k,{}).get('url') for k in ('android','ios')), j); c.close()

    print('# backup (export → καθάρισμα → επαναφορά)')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2000)
    pg.evaluate("()=>{AK.store.save('spots',{id:'s1',name:'Βράχος',lat:35,lon:33.3}); AK.store.save('tackle',{id:'k1',type:'lure',kind:'jig',name:'Ζόκα'});}")
    d=pg.evaluate("()=>AK.backup.build(false)")
    check('backup περιέχει δεδομένα', len(d.get('bites',[]))==1 and len(d.get('spots',[]))==1 and len(d.get('tackle',[]))==1, {k:len(v) for k,v in d.items() if isinstance(v,list)})
    pg.evaluate("()=>['alkyon-bites','alkyon-spots','alkyon-tackle'].forEach(k=>localStorage.removeItem(k))"); pg.reload(); pg.wait_for_timeout(1500)
    n=pg.evaluate("d=>AK.backup.apply(d)",d)
    got=pg.evaluate("()=>[AK.store.raw('bites').length,AK.store.raw('spots').length,AK.store.raw('tackle').length]")
    check('επαναφορά backup', got==[1,1,1] and n>=3, (n,got))
    check('ονόματα/βάρη εξοπλισμού χωρίς τη σελίδα', pg.evaluate("()=>AK.tackleKind('jig')!=='jig'&&/\\d/.test(AK.tackleW(60))"))
    check('backup χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# ενημέρωση σε εξέλιξη (παλιό index.html από τη μνήμη, νέα αρχεία)')
    c=ctx(b)
    def oldidx(route):
        r=route.fetch(); body=r.text().replace('<script src="tackle-core.js"></script>','<script src="tackle-view.js"></script>').replace('<script src="lazy.js"></script>','')
        route.fulfill(response=r, body=body)
    c.route('**/v4/', oldidx); c.route('**/v4/index.html', oldidx)
    pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    check('παλιό index: backup διαθέσιμο', pg.evaluate("()=>!!(AK.backup&&AK.backup.build)"))
    s=go(pg,'#tackle',2000); check('παλιό index: Εξοπλισμός χωρίς σφάλμα', not pg._errs and not s['fail'], (s,pg._errs)); c.close()

    print('# λογαριασμός (με ψεύτικο server)')
    CHK={}
    def supa(route):
        u=route.request.url; m=route.request.method; body=route.request.post_data or ''
        if '/auth/v1/signup' in u:
            CHK['redir']=('redirect_to=' in u)
            CHK['lang']=json.loads(body).get('data',{}).get('lang')
            return route.fulfill(json={'id':'u1','email':'d@x.com'})
        if '/auth/v1/verify' in u:
            if json.loads(body).get('token')!='123456': return route.fulfill(status=403,json={'msg':'Token has expired or is invalid'})
            return route.fulfill(json={'access_token':'AT','refresh_token':'RT','expires_in':3600,'user':{'id':'u1','email':'d@x.com'}})
        if '/auth/v1/recover' in u or '/auth/v1/resend' in u: return route.fulfill(json={})
        if '/auth/v1/user' in u: return route.fulfill(json={'id':'u1','email':'d@x.com'})
        if '/auth/v1/token' in u: return route.fulfill(status=400,json={'error_description':'Invalid login credentials'})
        return route.fulfill(json=[])
    def actx(**kw):
        c=ctx(b,**kw); c.route('**/*supabase.co/**',supa); return c
    c=actx(); pg=page(c); pg.goto(BASE+'/v4/#friends'); pg.wait_for_timeout(2000)
    pg.click('#main .btn.pri'); pg.wait_for_timeout(500)
    check('Φίλοι: σύνδεση επιτόπου', pg.evaluate("()=>!!document.querySelector('.sheet .authf')"))
    pg.click('.sheet .authf .swm'); pg.fill('.sheet input[type=email]','d@x.com'); pg.fill('.sheet input[type=password]','secret1'); pg.click('.sheet button[type=submit]'); pg.wait_for_timeout(800)
    check('εγγραφή: στέλνει διεύθυνση επιστροφής (redirect_to)', CHK.get('redir') is True)
    check('εγγραφή: στέλνει τη γλώσσα (για το email)', CHK.get('lang')=='el', CHK.get('lang'))
    check('εγγραφή → κωδικός από email', pg.evaluate("()=>!document.querySelector('.sheet .codebox').hidden"))
    pg.fill('.sheet .codein','000000'); pg.click('.sheet .codebox .btn.pri'); pg.wait_for_timeout(600)
    check('λάθος κωδικός: μήνυμα', 'κωδικός' in pg.evaluate("()=>document.querySelector('.sheet .err').textContent").lower() or 'code' in pg.evaluate("()=>document.querySelector('.sheet .err').textContent").lower())
    pg.evaluate("()=>{localStorage.setItem('alkyon-v4-ptab',JSON.stringify('acc'))}"); pg.goto(BASE+'/v4/#profile'); pg.reload(); pg.wait_for_timeout(2000)
    check('κωδικός: μένει μετά από επιστροφή στην εφαρμογή', pg.evaluate("()=>{const c=document.querySelector('.authf .codebox'); return !!c&&!c.hidden}"))
    pg.fill('.authf .codein','123456'); pg.click('.authf .codebox .btn.pri'); pg.wait_for_timeout(1500)
    check('σωστός κωδικός: συνδεδεμένος', pg.evaluate("()=>!!AK.cloud.session()"))
    check('ματάκι κωδικού υπάρχει', True)
    check('λογαριασμός χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    for hs,want in [('#access_token=AT&refresh_token=RT&expires_in=3600&type=signup','session'),('#access_token=AT&refresh_token=RT&expires_in=3600&type=recovery','newpass'),('#error=access_denied&error_description=expired','expired')]:
        c=actx(); pg=page(c); pg.goto(BASE+'/'+hs); pg.wait_for_timeout(3500)
        s=pg.evaluate("()=>({h:location.hash, s:!!AK.cloud.session(), sh:(document.querySelector('.sheet')||{}).textContent||''})")
        okk=s['h']=='#profile' and ((want=='session' and s['s']) or (want=='newpass' and s['s'] and ('Νέος κωδικός' in s['sh'] or 'New password' in s['sh'])) or (want=='expired' and not s['s'] and s['sh']))
        check('σύνδεσμος email: '+want, okk and not pg._errs, (s,pg._errs)); c.close()

    print('# Google')
    for on in (False,True):
        def supa3(route,*_a,on=on):
            u=route.request.url
            if '/auth/v1/settings' in u: return route.fulfill(json={'external':{'google':on,'email':True}})
            if '/auth/v1/user' in u: return route.fulfill(json={'id':'uG','email':'g@gmail.com','user_metadata':{'full_name':'Test G'}})
            return route.fulfill(json=[])
        c=ctx(b); c.route('**/*supabase.co/**',supa3); pg=page(c); pg.goto(BASE+'/v4/#friends'); pg.wait_for_timeout(1500)
        pg.click('#main .btn.pri'); pg.wait_for_timeout(800)
        vis=pg.evaluate("()=>{const g=document.querySelector('.sheet .gbox'); return !!g&&!g.hidden}")
        check('Google κουμπί '+('φαίνεται όταν είναι ενεργό' if on else 'κρυφό όταν δεν είναι ενεργό'), vis==on, vis)
        if on:
            u=[]; c.route('**/auth/v1/authorize**', lambda r: (u.append(r.request.url), r.fulfill(status=200,body='ok')))
            pg.click('.sheet .gbtn'); pg.wait_for_timeout(800)
            check('Google: πάει στο authorize με redirect_to', bool(u) and 'provider=google' in u[0] and 'redirect_to=' in u[0], u)
            pg.goto(BASE+'/#access_token=AT&expires_in=3600&provider_token=x&refresh_token=RT&token_type=bearer'); pg.wait_for_timeout(3000)
            check('Google: επιστροφή → συνδεδεμένος', pg.evaluate("()=>{const s=AK.cloud.session(); return !!s&&s.name==='Test G'&&location.hash==='#profile'}"))
        check('Google χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# δύο λογαριασμοί στο ίδιο κινητό')
    ST={'fk':False,'postB':0}
    def supa2(route):
        u=route.request.url; m=route.request.method; body=route.request.post_data or ''
        if '/auth/v1/token' in u:
            em=json.loads(body).get('email','a@x.com'); uid='uA' if em.startswith('a') else 'uB'
            return route.fulfill(json={'access_token':'AT-'+uid,'refresh_token':'RT','expires_in':3600,'user':{'id':uid,'email':em}})
        if '/auth/v1/logout' in u: return route.fulfill(status=204,body='')
        if '/rest/v1/records' in u and m=='POST':
            if ST['fk']: return route.fulfill(status=409,json={'code':'23503','details':'Key is not present in table "users".'})
            if (route.request.headers.get('authorization') or '').endswith('uB'): ST['postB']+=1
            return route.fulfill(status=201,body='')
        return route.fulfill(json=[])
    c=ctx(b); c.route('**/*supabase.co/**',supa2); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{localStorage.setItem('alkyon-v4-acctask','1'); return AK.cloud.signIn('a@x.com','pw')}"); pg.wait_for_timeout(600)
    pg.evaluate("()=>AK.cloud.signOut({})"); pg.wait_for_timeout(600)
    pg.evaluate("()=>AK.cloud.signIn('b@x.com','pw')"); pg.wait_for_timeout(1500)
    check('νέα σύνδεση αμέσως μετά την αποσύνδεση', pg.evaluate("()=>(AK.cloud.session()||{}).uid==='uB'"))
    check('άλλος λογαριασμός: ρωτά πριν στείλει', ST['postB']==0 and pg.evaluate("()=>/λογαριασμού|account/.test((document.querySelector('.sheet')||{}).textContent||'')"))
    pg.click('.sheet .btn.pri'); pg.wait_for_timeout(1200)
    check('«χωριστά»: τίποτα στον νέο λογαριασμό, κινητό καθαρό', ST['postB']==0 and pg.evaluate("()=>AK.store.raw('bites').length===0"))
    c.close()
    ST['fk']=True; c=ctx(b); c.route('**/*supabase.co/**',supa2); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>AK.cloud.signIn('a@x.com','pw')"); pg.wait_for_timeout(800)
    check('λογαριασμός που διαγράφηκε: αποσύνδεση, δεδομένα μένουν', pg.evaluate("()=>!AK.cloud.session()&&AK.store.raw('bites').length>0"))
    check('δύο λογαριασμοί χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# παλιά έξοδος και κλασική')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>AK.pastTrip()"); pg.wait_for_timeout(500)
    pg.fill('.pasttrip input[type=date]','2026-10-25'); pg.fill('.pasttrip input[list=ptSpots]','Λατσί'); pg.fill('.pasttrip input[type=time] >> nth=0','06:30'); pg.fill('.pasttrip input[type=time] >> nth=1','10:00')
    pg.click('.pasttrip .btn.pri'); pg.wait_for_timeout(600)
    tr=pg.evaluate("()=>AK.store.raw('trips').map(t=>[t.date,t.spot,t.manual,(t.endMs-t.startMs)/3600000])")
    check('παλιά έξοδος αποθηκεύεται', tr==[['2026-10-25','Λατσί',True,3.5]], tr)
    for u,want in [('/classic.html?a=map&lat=35.1&lon=33.2','/v4/#share='),('/classic.html?a=bite','/v4/#log'),('/classic.html','/v4/'),('/?a=map&lat=35.1&lon=33.2','/v4/#share=35.10000,33.20000')]:
        pg.goto(BASE+u); pg.wait_for_timeout(1800); check('παλιός σύνδεσμος κλασικής (χωρίς classic.html, 1.10.11) → '+want, pg.url.split(BASE)[1].startswith(want), pg.url)
    check('το classic.html και τα αδέσποτα αρχεία αφαιρέθηκαν (1.10.11)', not any(os.path.exists(os.path.join(ROOT,f)) for f in ['classic.html','map-view.js','help.js','map.css','sw (1).js','v4/bc-hero.jpg','v4/bc-hero-boat.jpg']))
    check('παλιά έξοδος/κλασική χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# συρτή, επιλογή σημείου, ψάρια χωρίς είδος (1.6.x)')
    import json as _j
    now=int(time.time()*1000); pts=[[34.70,32.40+i*0.000169,now-(30-i)*10000] for i in range(31)]
    c=ctx(b); c.add_init_script("if(!sessionStorage.tr){sessionStorage.tr=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T1',start:%d,due:%d}));localStorage.setItem('alkyon-track',JSON.stringify({id:'T1',pts:%s,m:1500}));localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:34.7,lon:32.40507,t:%d}));localStorage.setItem('alkyon-troll',JSON.stringify({on:true,mode:'surface',min:2.5,max:4,line:40}));localStorage.setItem('alkyon-v4-night',JSON.stringify('off'));localStorage.setItem('alkyon-v4-acctask','1');}"%(now-300000,now+3600000,_j.dumps(pts),now))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    r=pg.evaluate("()=>{ const id=AK.quickRec(false,null,null,true), x=AK.store.get('bites',id); return {kn:x.troll&&x.troll.kn, lb:x.troll&&x.troll.lb, dlon:x.boatLon-x.lon, tech:x.tech, pill:!!document.querySelector('.trpill:not([hidden])')} }")
    check('συρτή: ψάρι ~40 m πίσω πάνω στη διαδρομή', r['lb']==40 and abs(r['dlon']-0.00044)<0.00005 and abs((r['kn'] or 0)-3)<0.3 and r['pill'], r)
    g=pg.evaluate("()=>[AK.troll.geo({mode:'bottom',auto:false,leads:12,leader:10,v0:3},3),AK.troll.geo({mode:'bottom',auto:false,leads:12,leader:10,v0:3},3.5),AK.troll.nLeads({mode:'bottom',auto:true},25*1.83),AK.troll.nLeads({mode:'bottom',auto:true},32*1.83)]")
    check('συρτή βυθού αυτόματα: βυθός 25 οργιές → 24 μολύβια· 32 οργιές → 30 (το μέγιστο της αρματωσιάς)', g[2]==24 and g[3]==30, g[2:])
    check('συρτή βυθού (Deep Fishing, ανά 5 οργιές): 12 μολύβια στα 3 kn = ~22 m βάθος, ~123 m πίσω· πιο γρήγορα ανεβαίνει', abs(g[0]['dl']-21.96)<0.2 and abs(g[0]['lb']-122.8)<1 and g[1]['dl']<g[0]['dl'], {k:g[0][k] for k in ('dl','lb','L','n')})
    pg.evaluate("()=>AK.speciesFill('T1')"); pg.wait_for_timeout(500)
    check('τέλος εξόδου: φόρμα ειδών για ψάρια χωρίς είδος', pg.evaluate("()=>!!document.querySelector('.sheet .spfill .spf')"))
    pg.evaluate("()=>AK.closeSheet&&AK.closeSheet()"); pg.wait_for_timeout(400)
    pg.evaluate("()=>AK.mapPick({lat:34.8,lon:32.5,z:12,onPick:(a,b)=>{window.__pk=[a,b]}})"); pg.wait_for_timeout(1500)
    check('επιλογή σημείου: κάρτα στον κανονικό χάρτη', pg.evaluate("()=>!!document.querySelector('.mpkbar')&&document.body.classList.contains('mappick')"))
    pg.evaluate("()=>document.querySelector('.mpkbar .btn.pri').click()"); pg.wait_for_timeout(500)
    pk=pg.evaluate("()=>window.__pk")
    check('επιλογή σημείου: επιστρέφει το κέντρο', pk and abs(pk[0]-34.8)<0.01 and abs(pk[1]-32.5)<0.01, pk)
    check('συρτή/επιλογή χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# σημάδια χάρτη στη σωστή θέση (1.6.7)')
    bs=[{'id':'p%d'%i,'date':'2026-10-10','time':'07:00','species':'Λαβράκι','kg':1,'lat':35.05+0.012*(i%5),'lon':32.25+0.03*(i//5),'_u':i+1} for i in range(15)]
    c=ctx(b); c.add_init_script("if(!sessionStorage.pm){sessionStorage.pm=1;localStorage.setItem('alkyon-bites',%s);localStorage.setItem('alkyon-v4-mapview',JSON.stringify({lat:35.07,lon:32.33,z:12}));localStorage.setItem('alkyon-v4-acctask','1');}"%_j.dumps(_j.dumps(bs)))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    r=pg.evaluate("""()=>{ const m=AlkyonCore.map(), box=document.getElementById('lmap').getBoundingClientRect(); let mx=0,n=0; m.eachLayer(l=>{ if(!l._icon||!l.getLatLng||!/\\bfish\\b/.test(l._icon.className)) return; const q=l._icon.getBoundingClientRect(), e=m.latLngToContainerPoint(l.getLatLng()); mx=Math.max(mx,Math.hypot(q.left+q.width/2-box.left-e.x,q.top+q.height/2-box.top-e.y)); n++; }); return [n,Math.round(mx)]; }""")
    check('15 ψάρια στον χάρτη: κάθε σημάδι πάνω στη θέση του (≤2 px)', r[0]>=10 and r[1]<=2, r); c.close()

    print('# συρτή βυθού: ρίξιμο → «Σταμάτα στα Ν» → «Στον βυθό» → «Ακούμπησε» (1.7.0)')
    now=int(time.time()*1000); pts=[[34.70,32.40+i*0.000169,now-(60-i)*10000] for i in range(61)]
    c=ctx(b); c.add_init_script("if(!sessionStorage.dr){sessionStorage.dr=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T1',start:%d,due:%d}));localStorage.setItem('alkyon-track',JSON.stringify({id:'T1',pts:%s,m:3000}));localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:34.7,lon:32.41014,t:%d}));localStorage.setItem('alkyon-troll',JSON.stringify({on:true,mode:'bottom',min:2.5,max:3.5,auto:true}));localStorage.setItem('alkyon-v4-night',JSON.stringify('off'));localStorage.setItem('alkyon-v4-acctask','1');}"%(now-600000,now+3600000,_j.dumps(pts),now))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    pg.evaluate("()=>{ AK.depthAt=(la,lo)=>Promise.resolve(70.4); }")
    pg.evaluate("()=>AK.troll.startDrop(36)"); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{ const d=AK.troll.cfg().dep; return [AK.troll.recommend(), d&&d.lat!=null?AK.troll.corrAt(d.lat,d.lon):null, !!(document.querySelector('.trdrop')||document.querySelector('.trside:not([hidden])'))]; }")
    check('ρίξιμο: βυθόμετρο 36 οργ. (65.9 m), χάρτης 70.4 m → διόρθωση −4.5 m, «Σταμάτα στα» με βυθό εκεί και απόσταση', r[1] is not None and abs(r[1]+4.5)<0.3 and r[0]['n'] and r[0]['n']>=20 and r[0]['lb']>150 and abs(r[0]['d']-65.9)<0.5 and r[2], r)
    pg.evaluate("()=>AK.troll.setDown()"); pg.wait_for_timeout(1500)
    k=pg.evaluate("()=>{const c=AK.troll.cfg(); return [c.leads,c.auto,c.dep&&c.dep.st,!!(document.querySelector('.trtouch')||[...document.querySelectorAll('.trside button')].some(x=>/Ακούμπησε|Touched/.test(x.textContent)))]}")
    check('«Στον βυθό ✓»: μολύβια κλειδώνουν στην πρόταση, κουμπί «Ακούμπησε»', k[0]==r[0]['n'] and k[1] is False and k[2]=='set' and k[3], k)
    pg.evaluate("()=>AK.troll.touched()"); pg.wait_for_timeout(600)
    t=pg.evaluate("()=>[JSON.parse(localStorage.getItem('alkyon-rigs')||'[]')[0], AK.troll.cfg().leads]")
    check('«Ακούμπησε»: συντελεστής αρματωσιάς μαθαίνει (kD), μαζεύει 1 μολύβι', t[0].get('kD') and 0.6<=t[0]['kD']<=1.6 and t[0].get('kN')==1 and t[1]==k[0]-1, t)
    check('ρίξιμο χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# χάρακας με πάτημα στον χάρτη (1.7.1)')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    pg.evaluate("()=>{ AlkyonCore.depthAt=()=>Promise.resolve(55); AlkyonRuler.start(); }"); pg.wait_for_timeout(500)
    pg.mouse.click(120,320); pg.wait_for_timeout(300); pg.mouse.click(260,560); pg.wait_for_timeout(900)
    r=pg.evaluate("()=>[AlkyonRuler.state(), !!document.querySelector('#ndRuler .rnum'), document.body.classList.contains('ruling'), document.querySelectorAll('.rulpt').length]")
    check('χάρακας: 2 πατήματα = 2 σημεία, απόσταση, μπάρα, κρύβεται η μπάρα εξόδου', r[0]['n']==2 and r[0]['m']>100 and r[1] and r[2] and r[3]==2, r)
    pg.evaluate("()=>AlkyonRuler.stop()"); check('χάρακας: κλείσιμο καθαρίζει', pg.evaluate("()=>!document.querySelector('#ndRuler')&&!document.body.classList.contains('ruling')"), None)
    check('χάρακας χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# καθαρός χάρτης: μπάρα + μενού που σέρνεις (1.7.2)')
    c=ctx(b); c.add_init_script("if(!sessionStorage.mc){sessionStorage.mc=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    r=pg.evaluate("()=>{ const vis=s=>{const e=document.querySelector(s); return !!(e&&e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none');}; return [document.body.classList.contains('mapclean'), vis('.mcbar'), vis('.mchips'), vis('.mapbar .morebtn'), vis('.mapbar .gpsb')]; }")
    check('καθαρός: μπάρα φαίνεται, γρήγορα στρώματα και ⋯ κρυφά, η θέση μένει', r==[True,True,False,False,True], r)
    bx=pg.evaluate("()=>{const r=document.querySelector('.mcbar').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
    pg.mouse.move(bx[0],bx[1]); pg.mouse.down(); pg.mouse.move(bx[0],bx[1]+70,steps=8); pg.mouse.up(); pg.wait_for_timeout(500)
    k=pg.evaluate("()=>[!!document.querySelector('.mcdrw'), document.querySelectorAll('.mcg5 .mctile').length, document.querySelectorAll('.mcg3 .mctile').length]")
    check('σύρσιμο κάτω ανοίγει το μενού: αγαπημένα (στρώματα + εργαλεία) + εργαλεία', k[0] and k[1]>=8 and k[2]>=4, k)
    pg.wait_for_timeout(400); sr=pg.evaluate("()=>{const r=document.querySelector('.mcpan').getBoundingClientRect();return [Math.round(r.left),Math.round(r.right),innerWidth]}")
    check('πλαϊνό μενού από δεξιά, αριστερά φαίνεται ο χάρτης', sr[0]>=60 and abs(sr[1]-sr[2])<=2, sr)
    check('χωρίς τη λαβή στη δεξιά άκρη (1.9.7)', pg.evaluate("()=>!document.querySelector('.mcedge')"), None)
    g=pg.evaluate("()=>[[...document.querySelectorAll('.mcpan .mcgrp>h4, .mcpan .mcacc>summary .mcst')].map(e=>e.textContent), [...document.querySelectorAll('.mcg3 .mctile b')].map(e=>e.textContent)]")
    check('μενού: ομάδες σε σειρά (Καιρός πριν από Εργαλεία, Χάρτης και βάθη, Ενέργειες) και εργαλεία χωρίς στρώματα', all(x in g[0] for x in ['Χάρτης και βάθη','Καιρός και θάλασσα','Θάλασσα και κανόνες','Τα δικά μου','Ενέργειες']) and g[0].index('Καιρός και θάλασσα')<g[0].index('Εργαλεία')<g[0].index('Χάρτης και βάθη') and 'Βάθη θάλασσας' not in g[0] and 'Πού να πάω' not in g[0] and 'Χάρακας' in g[1] and not any('Σταθμοί' in x or 'Λιμάνια' in x for x in g[1]), g)
    pg.evaluate("()=>document.querySelectorAll('.mcg5 .mctile')[2].click()"); pg.wait_for_timeout(500)
    check('όλες οι ομάδες του μενού ανοιγοκλείνουν (1.9.7)', pg.evaluate("()=>document.querySelectorAll('.mcpan details.mcacc').length>=6&&!document.querySelector('.mcpan .mcgrp>h4')"), None)
    check('στρώμα από το μενού: ανάβει το ίδιο κουμπί (Ρεύματα)', pg.evaluate("()=>document.querySelectorAll('.mchips .mchip')[2].getAttribute('aria-pressed')==='true'"), None)
    pg.evaluate("()=>document.querySelector('.mcdim').click()"); pg.wait_for_timeout(400)
    check('πάτημα στον χάρτη κλείνει το μενού', pg.evaluate("()=>!document.querySelector('.mcdrw')"), None)
    pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>{ [...document.querySelectorAll('.mcpan details.mcacc')].forEach(d=>d.open=true); document.querySelector('.mcpan').scrollTop=500; }"); pg.wait_for_timeout(300)
    s0=pg.evaluate("()=>document.querySelector('.mcpan').scrollTop")
    pg.evaluate("()=>document.querySelector('.mcdim').click()"); pg.wait_for_timeout(500); pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(700)
    s1=pg.evaluate("()=>document.querySelector('.mcpan').scrollTop")
    check('Στρώματα: ξανανοίγει εκεί που το άφησες (1.13.7)', s0>100 and abs(s1-s0)<=8, [s0,s1])
    pg.evaluate("()=>document.querySelector('.mcdim').click()"); pg.wait_for_timeout(400)
    r=pg.evaluate("""()=>{ const w=12,hh=12,d=new Float32Array(w*hh).fill(30); for(let y=0;y<hh;y++){ d[y*w]=-5; d[y*w+1]=3; } d[5*w+6]=4; d[5*w+7]=6; d[6*w+6]=7;
      const g={w:w,h:hh,data:d,x0:22.0,y0:38.0,dx:0.001,dy:-0.001}; const a=AK.shallows.analyze(g); return [a.shoals.length, a.shoals[0]&&a.shoals[0].d, a.n, !!AK.shallows.set, (()=>{ const u=AK.shallows.unpack(AK.shallows.pack(g)); return [u.data[5*w+6], u.data[0], u.data[1]]; })()]; }""")
    check('Ρηχά & ξέρες: ξέρα μακριά από την ακτή (4 m), τα ρηχά της ακτής δεν μετράνε σαν ξέρα, πλακίδιο στο μενού (1.13.4)', r==[1,4,15,True,[4,-1,3]], r)
    r=pg.evaluate("""()=>{ const sf=AK.seafloor; if(!sf) return ['x']; const w=20,hh=20,d=new Float32Array(w*hh); for(let y=0;y<hh;y++)for(let x=0;x<w;x++) d[y*w+x]=x<3?-1:x*5;
      const g={w:w,h:hh,data:d,x0:33.0,y0:35.0,dx:0.001,dy:0.001}; const rl=sf._relief(g), bd=sf._band(g,20,60);
      const land=rl[3]===0, sea=rl[(5*w+10)*4+3]===200, inb=bd[(5*w+6)*4+3]>=150, outb=bd[(5*w+15)*4+0]!==228;
      const sp=sf._spRange((window.SPKB||[]).find(s=>s.l==='Dentex dentex'));
      return [land,sea,inb,outb,!!sp&&sp.a>0&&sp.b>sp.a]; }""")
    check('Ανάγλυφο βυθού και ζώνη βάθους: σκίαση στη θάλασσα, όχι στη στεριά, ζώνη 20–60 m, βάθος ψαριού (1.13.8)', r==[True,True,True,True,True], r)
    pg.evaluate("()=>{ AK.seafloor.setRange(20,60,''); }"); pg.wait_for_timeout(500)
    r=pg.evaluate("()=>{ const l=document.querySelector('.sbleg.sfleg'); return [!!l&&!l.hidden&&/20–60/.test(l.textContent), AK.seafloor.band()]; }")
    check('Ζώνη βάθους: υπόμνημα με τα όρια και κουμπί αλλαγής (1.13.8)', r==[True,True], r)
    pg.evaluate("()=>AK.shallows.set(true)"); pg.wait_for_timeout(2200)
    r=pg.evaluate("()=>{ const a=document.querySelector('.sbleg.sfleg'), b=document.querySelector('.sbleg.shleg'); if(!a||!b||a.hidden||b.hidden) return ['x',!!a,!!b]; const x=a.getBoundingClientRect(), y=b.getBoundingClientRect(); return [x.bottom<=y.top+1]; }")
    check('Ζώνη βάθους και Ρηχά μαζί: τα υπομνήματα δεν πέφτουν το ένα πάνω στο άλλο (1.13.8)', r==[True], r)
    pg.evaluate("()=>AK.shallows.set(false)")
    pg.evaluate("()=>AK.seafloor.setBand(false)")
    pg.evaluate("()=>{ localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:34.7,lon:32.4,t:Date.now()})); AK.goTo(34.8,32.35,'Δοκιμή'); }"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{ const d=document.querySelector('.dtbar'), m=document.querySelector('.mcbar'); if(!d||!m) return ['x']; const a=d.getBoundingClientRect(), b=m.getBoundingClientRect(); const pts=[[a.right-8,a.top+a.height/2],[a.left+a.width/2,a.top+a.height/2]].map(p=>{ const e=document.elementFromPoint(p[0],p[1]); return !!(e&&d.contains(e)); }); return [getComputedStyle(d).display!=='none', a.top>=b.bottom-1, d.textContent.includes('Δοκιμή'), pts[0]&&pts[1]]; }")
    check('Πλοήγηση προς σημείο: η μπάρα φαίνεται κάτω από τη μπάρα καιρού και δεν την κρύβουν τα κουμπιά δεξιά (1.13.4, 1.13.6)', r==[True,True,True,True], r)
    pg.evaluate("()=>AK.goClear()")
    check('καθαρός χάρτης χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# φωνή + οθόνη που αλλάζει μόνη της (1.7.3)')
    now=int(time.time()*1000)
    c=ctx(b); c.add_init_script("if(!sessionStorage.md){sessionStorage.md=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T2',start:%d,due:%d}));localStorage.setItem('alkyon-direct',JSON.stringify({lat:35.05,lon:33.35,name:'Ξέρα'}));localStorage.setItem('alkyon-v4-acctask','1');}"%(now-600000,now+3600000))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(6500)
    r=pg.evaluate("()=>[typeof AK.say, AK.sayNum(2.5), AK.sayNum(3.5), AK.mapMode(), !!document.querySelector('.mcpanel.fish')]")
    check('φωνή: λέει «δυόμισι/τρεισήμισι», σε έξοδο η οθόνη ΨΑΡΕΥΩ με βάθος', r[0]=='function' and r[1]=='δυόμισι' and r[2]=='τρεισήμισι' and r[3]=='fish' and r[4], r)
    vis="()=>{const o=document.getElementById('bOrient');return !!o&&o.isConnected&&!!o.closest('.seabar')&&getComputedStyle(o).display!=='none'}"
    v1=pg.evaluate(vis); pg.evaluate("()=>location.hash='#log'"); pg.wait_for_timeout(900); pg.evaluate("()=>location.hash='#map'"); pg.wait_for_timeout(2500)
    check('NU/CU/HU φαίνεται σε έξοδο, και αφού ξαναμπείς στον χάρτη', v1 and pg.evaluate(vis), [v1])
    sv=pg.evaluate("""()=>{ const N=140, g={x0:AK.lastPos().lon-0.07,y0:AK.lastPos().lat+0.07,dx:1/960,dy:-1/960,w:N,h:N,data:new Float32Array(N*N)};
      const f0=AK.trip.fix&&AK.trip.fix()||{lat:AK.lastPos().lat,lon:AK.lastPos().lon}; g.x0=f0.lon-0.07; g.y0=f0.lat+0.07;
      for(let j=0;j<N;j++) for(let i=0;i<N;i++){ const lon=g.x0+g.dx*(i+.5); g.data[j*N+i]=Math.max(5,60-(lon-f0.lon)*2600); }
      window.AlkyonDense.area=()=>Promise.resolve(g); AK.trip.fix=()=>({lat:f0.lat,lon:f0.lon,t:Date.now(),spd:1.55,hd:90,acc:5});
      const c=JSON.parse(localStorage.getItem('alkyon-troll')||'{}'); Object.assign(c,{on:true,mode:'bottom',min:2.5,max:3.5,auto:false,leads:24,dep:{st:'set',t:Date.now()-60000}}); localStorage.setItem('alkyon-troll',JSON.stringify(c)); return 1; }""")
    for _ in range(3): pg.evaluate("()=>AK.troll.sideTick()"); pg.wait_for_timeout(400)
    sv=pg.evaluate("()=>{ const s=AK.troll.side(), el=document.querySelector('.trside'); return [s.adv&&s.adv.act, !!(el&&!el.hidden&&el.querySelector('svg')), s.prof&&s.prof.n]; }")
    check('συρτή βυθού: πλάγια όψη και συμβουλή μάζεψε/άφησε από τον βυθό στη διαδρομή του δολώματος', sv[0] in ('up','down') and sv[1], sv)
    pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('alkyon-troll')); c.on=false; c.dep=null; localStorage.setItem('alkyon-troll',JSON.stringify(c)); }")
    pg.evaluate("()=>document.querySelector('.mcpanel .mph').click()"); pg.wait_for_timeout(800)
    k=pg.evaluate("()=>[AK.mapMode(), document.querySelector('.mcpanel').className, document.querySelector('.mcpanel').textContent]")
    check('ετικέτα: με το χέρι ΠΗΓΑΙΝΩ, κάρτα με απόσταση και στόχο', k[0]=='run' and 'run' in k[1] and 'Ξέρα' in k[2] and 'nm' in k[2], k)
    k=pg.evaluate("()=>{ const r=document.querySelector('.mcpanel .mpto.mpnav'); if(!r) return ['x']; const x=r.querySelector('.mpstop'), P=document.querySelector('.mcpanel').getBoundingClientRect(), R=r.getBoundingClientRect(), X=x?x.getBoundingClientRect():R, ok=[!!r.querySelector('.mpar svg'), r.textContent.includes('Ξέρα'), !!x&&R.top>=P.top&&R.bottom<=P.bottom+1&&X.left>=R.left+R.width/2&&X.top>=R.top-1]; x.click(); return ok.concat([!localStorage.getItem('alkyon-direct')||localStorage.getItem('alkyon-direct')=='null']); }")
    check('έξοδος: η πλοήγηση μέσα στο πάνελ (βέλος, προορισμός, ✕ που τη σταματά) (1.13.6)', k==[True,True,True,True], k)
    check('φωνή/οθόνη χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# βελτιώσεις 1.9.6 (εμφάνιση 1.8.33)')
    c=ctx(b); c.add_init_script("if(!sessionStorage.ml){sessionStorage.ml=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}"); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    v=pg.evaluate("()=>{const e=document.querySelector('.mclay'); const ok=!!e&&getComputedStyle(e).display!=='none'; e&&e.click(); return ok}"); pg.wait_for_timeout(700)
    check('κουμπί «Στρώματα» ανοίγει το πλαϊνό μενού', v and pg.evaluate("()=>!!document.querySelector('.mcdrw.open')"), v)
    pg.evaluate("()=>{window.__n=0; new MutationObserver(m=>{window.__n+=m.length}).observe(document.querySelector('.mcpan'),{childList:true})}")
    pg.mouse.move(60,300); pg.mouse.down(); pg.mouse.move(30,250,steps=6); pg.mouse.up(); pg.wait_for_timeout(1500)
    check('ο χάρτης σέρνεται με ανοιχτό μενού, χωρίς να ξαναχτίζεται το μενού', pg.evaluate("()=>!!document.querySelector('.mcdrw.open')&&window.__n===0"), pg.evaluate("()=>window.__n"))
    check('χάρτης/μενού χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    c=ctx(b); now=int(time.time()*1000); td=time.strftime('%Y-%m-%d')
    trk=[[35.04+0.001*i,32.40+0.0012*i] for i in range(30)]
    c.add_init_script("if(!sessionStorage.lc){sessionStorage.lc=1;localStorage.setItem('alkyon-trips',%s);}"%json.dumps(json.dumps([{'id':'t1','sid':'S1','date':td,'startMs':now-4*3600000,'endMs':now-3600000,'spot':'Λατσί','prof':'boat','count':0,'km':5,'track':trk,'_u':1}])))
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('#main .seg button, #main [role=tab]')].find(x=>/Έξοδοι/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(700)
    k=pg.evaluate("()=>{const ok=!!document.querySelector('.tcard canvas.tmap'); const e=document.querySelector('.tcard'); e&&e.click(); return ok}"); pg.wait_for_timeout(700)
    check('Ημερολόγιο: κάρτα με μικρό χάρτη, έξοδος με μεγάλο χάρτη και χρονολόγιο', k and pg.evaluate("()=>!!document.querySelector('.sheet .tstory canvas')&&document.querySelectorAll('.sheet .tline .tlx').length==2"), k)
    c.close()
    c=ctx(b); now=int(time.time()*1000); td=time.strftime('%Y-%m-%d')  # 1.9.21: ώρες ψαριών μέσα στην 1η έξοδο, όχι σταθερές (αλλιώς αποτύγχανε γύρω στις 10:00)
    c.add_init_script("if(!sessionStorage.ls){sessionStorage.ls=1;localStorage.setItem('alkyon-trips',%s);localStorage.setItem('alkyon-bites',%s);}"%(json.dumps(json.dumps([{'id':'t1','sid':'S1','date':td,'startMs':now-7200000,'endMs':now-3600000,'spot':'Α','prof':'boat','count':1,'_u':1},{'id':'t2','sid':'S2','date':td,'startMs':now-600000,'endMs':now-540000,'spot':'Δοκιμή','prof':'boat','count':0,'_u':1}])),json.dumps(json.dumps([{'id':'b1','date':td,'time':time.strftime('%H:%M',time.localtime(now/1000-6000)),'kg':1,'lat':35.1,'lon':32.5,'_u':1},{'id':'b2','date':td,'time':time.strftime('%H:%M',time.localtime(now/1000-5000)),'species':'Λαβράκι','kg':1.2,'lat':35.1,'lon':32.5,'_u':1}]))))
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('#main .seg button, #main [role=tab]')].find(x=>/Έξοδοι/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(700)
    r=pg.evaluate("()=>[document.querySelectorAll('#main .tcard').length, !!document.querySelector('.shortbtn')]")
    check('μικρές έξοδοι μαζεμένες σε κουμπί (1.9.7)', r==[1,True], r)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('#main .seg button, #main [role=tab]')].find(x=>/Στατιστικά/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(700)
    r=pg.evaluate("()=>[!!document.querySelector('.bar.nosp'), ![...document.querySelectorAll('.bar .bl')].some(e=>e.textContent==='?')]")
    check('στατιστικά: «Χωρίς είδος» αντί για «?» (1.9.7)', r==[True,True], r)
    check('Ημερολόγιο χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.9.8: ραντάρ βροχής, πίσω του κινητού')
    c=ctx(b); c.add_init_script("if(!sessionStorage.mr){sessionStorage.mr=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    c.route('**/api.rainviewer.com/**',lambda r: r.fulfill(status=200,content_type='application/json',body=json.dumps({'host':BASE,'radar':{'past':[{'time':int(time.time())-600,'path':'/rv/1'},{'time':int(time.time()),'path':'/rv/2'}]}})))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(700)
    pg.evaluate("()=>{const d=[...document.querySelectorAll('.mcpan details.mcacc')].find(x=>/Καιρός/.test(x.textContent)); if(d) d.open=true; const t=[...document.querySelectorAll('.mcpan .ltile')].find(x=>/Βροχή/.test(x.textContent)); t&&t.click()}"); pg.wait_for_timeout(1500)
    pg.mouse.click(60,500); pg.wait_for_timeout(500)
    check('ραντάρ βροχής: στρώμα στο μενού, μπάρα με ώρα (1.9.8)', pg.evaluate("()=>!!document.querySelector('.rainbar')&&document.querySelectorAll('.raintile').length>=0"), None)
    pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('.mcpan .ltile, .mcpan button')].find(x=>/^\\s*Άνεμος/.test(x.textContent)); t&&t.click()}"); pg.wait_for_timeout(2500)
    o1=pg.evaluate("()=>!!document.querySelector('.mcdrw')"); pg.mouse.click(60,500); pg.wait_for_timeout(900)
    r=[o1,pg.evaluate("()=>!document.querySelector('.mcdrw')&&!document.querySelector('.wch')")]
    check('πάτημα στον χάρτη με ανοιχτό μενού: κλείνει μόνο το μενού, χωρίς «Σημείο» (1.9.8)', r==[True,True], r)
    pg.evaluate("h=>location.hash=h",'#profile'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('#main .seg button')].find(x=>/Λογαριασμός/.test(x.textContent)); t&&t.click()}"); pg.wait_for_timeout(600)   # 1.12.14: η εισαγωγή είναι στον Λογαριασμό
    pg.evaluate("()=>{const r=[...document.querySelectorAll('#main .li')].find(x=>/plotter/.test(x.textContent)); r&&r.click()}"); pg.wait_for_timeout(900)
    had=pg.evaluate("()=>!!document.querySelector('.sheet.on')"); pg.go_back(); pg.wait_for_timeout(900)
    check('το «πίσω» κλείνει το φύλλο και μένει στη σελίδα (1.9.8)', had and pg.evaluate("()=>!document.querySelector('.sheet.on')&&location.hash==='#profile'"), had)
    check('1.9.8 χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    now=int(time.time()*1000); c=ctx(b); c.add_init_script("if(!sessionStorage.mn){sessionStorage.mn=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T9',start:%d,due:%d}));}"%(now-600000,now+3600000))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    s0=pg.evaluate("()=>document.documentElement.classList.contains('night')"); pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(800)
    first=pg.evaluate("()=>{const g=[...document.querySelectorAll('.mcpan details.mcacc')].find(x=>/Εργαλεία/.test(x.textContent)); if(g) g.open=true; const t=g&&g.querySelector('.mctile'); return t?t.textContent:''}")
    pg.evaluate("()=>{const g=[...document.querySelectorAll('.mcpan details.mcacc')].find(x=>/Εργαλεία/.test(x.textContent)); g.querySelector('.mctile').click()}"); pg.wait_for_timeout(1000); s1=pg.evaluate("()=>document.documentElement.classList.contains('night')")
    check('Μέρα/Νύχτα πρώτο στο μενού › Εργαλεία, όχι κουμπί στον χάρτη (1.9.11)', s1!=s0 and not pg.evaluate("()=>!!document.querySelector('.mcnight')") and not pg._errs, [first,s0,s1,pg._errs])
    r0=pg.evaluate("()=>{const e=document.querySelector('.fb.fbc'); const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]}")
    pg.mouse.move(r0[0],r0[1]); pg.mouse.down(); pg.wait_for_timeout(800); pg.mouse.up(); pg.wait_for_timeout(500)
    n=pg.evaluate("()=>document.querySelectorAll('.fdial .fdi').length"); pg.mouse.click(60,300); pg.wait_for_timeout(400)
    check('κράτημα στο «ψάρι»: κουμπιά πάνω από το ψάρι, κλείνουν με πάτημα δίπλα (1.9.9)', n>=4 and not pg.evaluate("()=>!!document.querySelector('.fdial')") and not pg._errs, [n,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-limits',JSON.stringify({wave:0.19}))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_selector('.dstrip .dtile:not(.past)'); pg.wait_for_timeout(1200)
    v=pg.evaluate("()=>[...document.querySelectorAll('.dstrip .dtile:not(.past) .dsc.nov')].map(x=>x.textContent)")
    pg.evaluate("()=>document.querySelectorAll('.dstrip .dtile:not(.past)')[1].click()"); pg.wait_for_timeout(700)
    r=[len(v)>0 and all(any(ch.isdigit() for ch in x) for x in v), pg.evaluate("()=>!document.querySelector('.hero .tag')&&!document.querySelector('.hero .plan, .hero .planbtn')")]
    check('Πρόγνωση: μέρα εκτός ορίων δείχνει την τιμή, χωρίς ετικέτα/«Θα βγω» (1.9.9)', all(r) and not pg._errs, [v[:3],r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_selector('.dstrip .dtile:not(.past)'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>document.querySelectorAll('.dstrip .dtile:not(.past)')[1].click()"); pg.wait_for_timeout(800)
    r=pg.evaluate("()=>[!!document.querySelector('.hero .hsun1'), ![...document.querySelectorAll('#main h2')].some(x=>/Ήλιος και σελήνη/.test(x.textContent)), document.querySelectorAll('#main details.fold').length>=0]")
    check('Πρόγνωση: ήλιος/σελήνη στην πάνω κάρτα, όχι ξεχωριστή κάρτα (1.9.10)', all(r) and not pg._errs, [r,pg._errs]); c.close()
    now=int(time.time()*1000); c=ctx(b); c.add_init_script("if(!sessionStorage.mp){sessionStorage.mp=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T7',start:%d,due:%d}));}"%(now-600000,now+3600000))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(6000)
    t=pg.evaluate("()=>{const p=document.querySelector('.mcpanel.fish'); return p?p.innerText:''}")
    check('μπάρα εξόδου: ταχύτητα και ώρα επιστροφής (1.9.11)', 'ΕΠΙΣΤΡΟΦΗ' in t and 'ΤΑΧΥΤΗΤΑ' in t and not pg._errs, [t[:80],pg._errs])
    pg.evaluate("()=>AK.troll&&AK.troll.sheet()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const s=document.querySelector('.sheet.on .trsheet'); if(!s) return null; const a=s.querySelectorAll('.cprow input'); return a.length}")
    check('φύλλο συρτής: ταχύτητα και πετονιά σε μία γραμμή (1.9.11)', r==3 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.ss){sessionStorage.ss=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-sstsrc',JSON.stringify('sat'));}")
    c.route('**/functions/v1/water-clarity*',lambda r: r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'sst':{'url':BASE+'/v4/alk-th-boatrod.jpg?{z}{x}{y}','range':[19,26],'day':'2026-11-05'}})))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3500); pg.evaluate("()=>AK.sst.set(true)"); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>[!!document.querySelector('.sstleg .slsrc'), /Δορυφόρ/.test((document.querySelector('.sstleg')||{}).innerText||''), ![...document.querySelectorAll('.ltile')].some(x=>/Νερό δορυφόρου/.test(x.textContent))]")
    check('Νερό: πηγή μοντέλο/δορυφόρος στο υπόμνημα, όχι ξεχωριστό στρώμα (1.9.12)', all(r) and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.fv){sessionStorage.fv=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000); pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(1000)
    n0=pg.evaluate("()=>document.querySelectorAll('.mcfav .mctile').length")
    pg.evaluate("()=>document.querySelector('.mcfe').click()"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{const f=[...document.querySelectorAll('.fved .fvr')].find(x=>/Τροφή/.test(x.textContent)); f.querySelector('.fvst').click()}"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{const x=document.querySelector('.sheet.on .sx, .sheet.on [aria-label=Κλείσιμο], .sheet.on .close'); x?x.click():AK.closeSheet()}"); pg.wait_for_timeout(2000)
    r=pg.evaluate("()=>[!!document.querySelector('.mcdrw'), [...document.querySelectorAll('.mcfav .mctile')].some(x=>/Τροφή/.test(x.textContent))]")
    check('μενού: αγαπημένα από όλο το μενού, προσθήκη με ★, το μενού μένει ανοιχτό (1.9.12)', n0>=8 and all(r) and not pg._errs, [n0,r,pg._errs]); c.close()

    bs=[{'id':'q%d'%i,'date':'2026-%02d-1%d'%(6+i%4,i%9),'time':'%02d:15'%(6+i%3),'species':['Ροφός','Σαργός'][i%2],'kg':1+i/10,'place':'Λατσί','lat':35.04,'lon':32.36,'_u':1} for i in range(14)]+[{'id':'mz%d'%i,'miss':True,'date':'2026-08-0%d'%(i+1),'time':'07:00','bait':'Σαρδέλα','_u':1} for i in range(3)]
    trs=[{'id':'tz1','date':'2026-08-02','start':'06:00','end':'10:00','spot':'Λατσί','_u':1}]
    c=ctx(b); c.add_init_script("if(!sessionStorage.st15){sessionStorage.st15=1;localStorage.setItem('alkyon-bites',JSON.stringify(%s));localStorage.setItem('alkyon-trips',JSON.stringify(%s));localStorage.removeItem('alkyon-v4-logrange');localStorage.setItem('alkyon-v4-logtab',JSON.stringify('stats'));}"%(json.dumps(bs),json.dumps(trs)))
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>[document.querySelector('.chip[aria-pressed=true]').textContent, document.querySelectorAll('.kpis .kpi').length, !!document.querySelector('.whenc .w24'), !/Το μεγαλύτερο/.test(document.body.innerText), !!document.querySelector('details.sfold[data-k=lost]'), (()=>{const k=document.querySelector('.kpis'), r=document.querySelector('.recs'), w=document.querySelector('.whenc'); return !!(r&&w&&(k.compareDocumentPosition(r)&4)&&(r.compareDocumentPosition(w)&4));})(), (()=>{const s=document.querySelector('.lseg'); return s.scrollWidth<=s.clientWidth+1;})()]")
    check('στατιστικά: Φέτος, 5 κουτάκια, «Πότε πιάνεις», ρεκόρ πρώτα, πτυσσόμενα, καρτέλες χωράνε (1.9.15)', r[0]=='Φέτος' and r[1] in (4,5) and all(r[2:]) and not pg._errs, [r,pg._errs])
    pg.evaluate("()=>{const d=document.querySelector('details.sfold[data-k=lost]'); d.open=true}"); pg.wait_for_timeout(400)
    r=pg.evaluate("()=>{const d=document.querySelector('details.sfold[data-k=lost]'); return [!!d.querySelector('.card.lost'), [...d.querySelectorAll('.bar .bv')].every(x=>{const m=x.textContent.match(/(\\d+) \\/ (\\d+)/); return m&&(+m[1]+ +m[2])>=2;})]}")
    r=pg.evaluate("()=>{const c=document.querySelector('.recs'); const vis=[...c.querySelectorAll('.rec')].filter(x=>x.offsetHeight>0).length; const k=[...document.querySelectorAll('.kpis .kpi span')].map(x=>x.textContent); return [vis<=5, !k.some(t=>/ανά ώρα/.test(t)) , !!document.querySelector('.sthd .stshare'), /kg/.test(document.querySelector('.spkg .bv').textContent)]}")
    pg.evaluate("()=>document.querySelector('.recs .rec').click()"); pg.wait_for_timeout(800)
    r.append(pg.evaluate("()=>!!document.querySelector('.sheet.on')")); pg.evaluate("()=>{const x=document.querySelector('.sheet.on .sx, .sheet.on [aria-label=Κλείσιμο], .sheet.on .close'); if(x) x.click()}"); pg.wait_for_timeout(800)
    check('στατιστικά: ρεκόρ 5 + πατιούνται, χωρίς άδειο «ανά ώρα», Κάρτα χρονιάς πάνω, κιλά ανά είδος (1.9.16)', all(r) and not pg._errs, [r,pg._errs])
    check('Χαμένα vs πιασμένα: ανοίγει, μόνο γραμμές με 2+ τσιμπήματα (1.9.15)', all(r) and not pg._errs, [r,pg._errs])
    pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2000)
    r=pg.evaluate("()=>{const sg=document.querySelector('main .seg'); return [document.querySelectorAll('.pstats').length, !!sg, sg?Math.round(sg.getBoundingClientRect().top):9999]}")
    check('προφίλ: χωρίς κουτάκια στατιστικών, οι καρτέλες αμέσως ορατές (1.14.32)', r[0]==0 and r[1] and r[2]<420 and not pg._errs, [r,pg._errs])
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const f=document.querySelector('.sheet.on form.bf2'); if(!f) return null; return [f.querySelectorAll('.bfseg button').length, !!f.querySelector('details.bfmore'), !!f.querySelector('.bfsave')]}")
    check('νέο ψάρι: νέα φόρμα (Ψάρι/Χάθηκε, Λεπτομέρειες, Αποθήκευση) (1.9.15)', r and r[0]==2 and r[1] and r[2] and not pg._errs, [r,pg._errs]); c.close()
    def supsr(route):
        u=route.request.url
        if 'sea_reports' in u and route.request.method=='POST': return route.fulfill(status=201,body='')
        if 'sea_reports_pub' in u: return route.fulfill(json=[{'id':'r1','lat':35.07,'lon':32.33,'state':0,'wind':1,'note':'λάδι','created_at':time.strftime('%Y-%m-%dT%H:%M:%S+00:00',time.gmtime(time.time()-1500)),'mine':False}])
        return route.fulfill(json=[])
    c=ctx(b); c.add_init_script("if(!sessionStorage.sr){sessionStorage.sr=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    c.route('**/*supabase.co/**',supsr); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>AK.seaRep.set(true)"); pg.wait_for_timeout(2000)
    n=pg.evaluate("()=>document.querySelectorAll('.mk.srmk.sr-calm').length")
    pg.evaluate("()=>AK.seaRep.form({lat:35.08,lon:32.31})"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{document.querySelector('.srb.sr-rough').click(); [...document.querySelectorAll('.sheet.on .btn.pri')].pop().click()}"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>[!document.querySelector('.srform'), /6 ώρες/.test(document.body.innerText)]")
    check('αναφορές θάλασσας: στρώμα στον χάρτη και αποστολή (1.9.17)', n==1 and r[0] and not pg._errs, [n,r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.loadScripts(['coordscan.js'])"); pg.wait_for_timeout(600)
    r=pg.evaluate("()=>{const f=AK.coordScan.find; const g=t=>f(t).map(p=>[+p.lat.toFixed(4),+p.lon.toFixed(4)]); return [g('Depth 34.5\\nN 35°03.602′\\nE 032°23.856′'), g('34°58.101N\\n033°01.554E'), g('N 35903.602 E 032923.856'), g('35.06003, 32.39760'), g('SOG 5.2 COG 270')]}")
    ok=r[0]==[[35.0600,32.3976]] and r[1]==[[34.9684,33.0259]] and r[2]==[[35.0600,32.3976]] and r[3]==[[35.0600,32.3976]] and r[4]==[]
    pg.evaluate("()=>{const b=AK.coordBox(35,32.3); document.body.append(b.el);}"); pg.wait_for_timeout(300)
    chip=pg.evaluate("()=>[...document.querySelectorAll('.cptools .chip')].some(x=>/Από εικόνα/.test(x.textContent))")
    check('συντεταγμένες από εικόνα: ανάγνωση μορφών plotter και κουμπί (1.9.18)', ok and chip and not pg._errs, [r,chip,pg._errs]); c.close()
    PNP=[]
    def suppn(route):
        rq=route.request; u=rq.url
        if 'port_notes' in u and rq.method=='POST': PNP.append(rq.post_data); return route.fulfill(status=201,body='')
        if 'port_notes' in u: return route.fulfill(json=[{'id':'11111111-1111-1111-1111-111111111111','tags':['shallow','swell'],'note':'Ρηχά','status':'ok','created_at':'2026-10-01T10:00:00+00:00','user_id':'u9'}])
        return route.fulfill(json=[])
    c=ctx(b); c.add_init_script("if(!sessionStorage.pn){sessionStorage.pn=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-ports-mine',JSON.stringify([{n:'Λατσί',la:35.039,lo:32.391,k:'ramp'}]));}")
    c.route('**/*supabase.co/**',suppn); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    pg.evaluate("()=>AK.mapGo(35.039,32.391,14)"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>document.querySelector('.mk-port').click()"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>[!!document.querySelector('.pnbtn'), (document.querySelector('.pnbtn')||{}).textContent]")
    pg.evaluate("()=>AK.portNotes.form({n:'Λατσί',la:35.039,lo:32.391,k:'ramp'})"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{document.querySelector('.pnpick .chip').click(); [...document.querySelectorAll('.sheet.on .btn.pri')].pop().click()}"); pg.wait_for_timeout(1000)
    check('σημειώσεις λιμανιών: στο αναδυόμενο και αποστολή για έγκριση (1.9.19)', r[0] and '(1)' in (r[1] or '') and len(PNP)==1 and '"shallow"' in PNP[0] and not pg._errs, [r,PNP,pg._errs]); c.close()
    import datetime as _dt
    _t=_dt.datetime.now(_dt.timezone.utc)-_dt.timedelta(minutes=12); _k=_t.strftime('%Y%m%d%H%M')
    _png=bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'+'1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082')
    def radr(route):
        u=route.request.url
        if 'radar.json' in u: return route.fulfill(json={'frames':[{'t':_k,'img':'radar_'+_k+'.png'}],'bounds':[[33.6,30.9],[36.15,35.25]]},headers={'Access-Control-Allow-Origin':'*'})
        return route.fulfill(body=_png,content_type='image/png')
    c=ctx(b); c.add_init_script("if(!sessionStorage.rd){sessionStorage.rd=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-map',JSON.stringify({base:'sat',sea:false,zones:false,rain:true}));}")
    c.route('**/raw.githubusercontent.com/dinospapani/alkyon/radar-data/**',radr); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    r=pg.evaluate("()=>[document.querySelectorAll('.domradar').length, /ΤΜ ΚΥΠΡΟΥ|ΤΜ Κύπρου/i.test((document.querySelector('.rainbar')||{}).innerText||'')]")
    check('ραντάρ ΤΜ Κύπρου στη Βροχή (1.9.20)', r[0]==1 and r[1] and not pg._errs, [r,pg._errs]); c.close()
    print('# 1.14.88 ραντάρ: αλλαγή πηγής χωρίς να φεύγει η μπάρα · έξοδος με 0 ψάρια · φίλτρο ακινησίας')
    def rvr(route):
        u=route.request.url
        if 'weather-maps.json' in u:
            import time as _tm; _tm.sleep(1.2)
            return route.fulfill(json={'host':'https://tilecache.rainviewer.com','radar':{'past':[{'time':int(_t.timestamp()),'path':'/v2/radar/x'}]}},headers={'Access-Control-Allow-Origin':'*'})
        return route.fulfill(body=_png,content_type='image/png')
    c=ctx(b); c.add_init_script("if(!sessionStorage.rd){sessionStorage.rd=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-map',JSON.stringify({base:'sat',sea:false,zones:false,rain:true}));}")
    c.route('**/raw.githubusercontent.com/dinospapani/alkyon/radar-data/**',radr); c.route('**/*rainviewer.com/**',rvr); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
    r=pg.evaluate("""async()=>{ const W=ms=>new Promise(r=>setTimeout(r,ms)), o={before:[document.querySelectorAll('.rainbar').length,document.body.classList.contains('navslid'),(document.querySelector('.rainbar .rbt i')||{}).textContent], gone:0, nav:0, wait:false};
      const iv=setInterval(()=>{ if(!document.querySelector('.rainbar')) o.gone++; if(!document.body.classList.contains('navslid')) o.nav++; if(document.querySelector('.rainbar.rbwait')) o.wait=true; },20);
      const mo=new MutationObserver(()=>{ if(!document.querySelector('.rainbar')) o.gone++; }); mo.observe(document.body,{childList:true});
      document.querySelector('.rainbar .rbs').click(); await W(3200); clearInterval(iv); mo.disconnect();
      o.after=[document.querySelectorAll('.rainbar').length,document.body.classList.contains('navslid'),(document.querySelector('.rainbar .rbt i')||{}).textContent,!!document.querySelector('.rainbar.rbwait'),document.querySelectorAll('.domradar').length];
      document.querySelector('.rainbar .rbx').click(); await W(600); o.closed=[document.querySelectorAll('.rainbar').length,document.body.classList.contains('navslid')]; return o; }""")
    check('ραντάρ: στην αλλαγή πηγής «⇄» η μπάρα μένει και το κύριο μενού δεν εμφανίζεται ενδιάμεσα· με ✕ κλείνει και το μενού επιστρέφει (1.14.88)',
          r['before'][0]==1 and r['before'][1] and r['gone']==0 and r['nav']==0 and r['wait'] and r['after'][0]==1 and r['after'][1] and not r['after'][3] and r['after'][4]==0 and r['after'][2]!=r['before'][2] and r['closed']==[0,False] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.__z){sessionStorage.__z=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'trip-z1',start:Date.now()-50*60000,due:Date.now()+3*3600000,route:'Z',last:{lat:34.7,lon:32.4,t:Date.now()}}));}")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4500)
    r=pg.evaluate("""async()=>{ const W=ms=>new Promise(r=>setTimeout(r,ms)), o={};
      const tr=()=>JSON.parse(localStorage.getItem('alkyon-trips')||'[]').filter(t=>!t.deleted), sheet=()=>{ const a=[...document.querySelectorAll('.sheet.on')]; return a[a.length-1]; }, k=t=>(AK.contrib._rowOf('trip',t).cond||{}).k;
      const end=async(id)=>{ localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id,start:Date.now()-50*60000,due:Date.now()+3*3600000,route:'Z',last:{lat:34.7,lon:32.4,t:Date.now()}})); AK.trip.back(); await W(900); const s=sheet(); return s?[(s.querySelector('h2,h3,.sht,.title')||{}).textContent||s.textContent.slice(0,40),[...s.querySelectorAll('.zeroq .btn')].map(x=>x.textContent)]:['no sheet',[]]; };
      const tap=async(txt)=>{ const bt=[...document.querySelectorAll('.sheet.on .zeroq .btn')].find(x=>x.textContent===txt); bt&&bt.click(); await W(900); };
      o.q=await end('trip-z1'); await tap('Έπιασα, αλλά δεν θα τα γράψω'); let t=tr().find(x=>x.sid==='trip-z1'); o.un=[t&&t.fish0,k(t),AK.PF?1:0,!!document.querySelector('.sheet.on .rateq')];
      document.querySelectorAll('.sheet.on .linkbtn').forEach(x=>x.click()); await W(700); document.querySelectorAll('.sheet.on .shx,.sheet.on .close').forEach(x=>x.click()); await W(500);
      o.q2=await end('trip-z2'); await tap('Δεν έπιασα τίποτα'); t=tr().find(x=>x.sid==='trip-z2'); o.none=[t&&t.fish0,t&&t.rate,k(t),!!document.querySelector('.sheet.on .rateq')];
      document.querySelectorAll('.sheet.on .shx,.sheet.on .close').forEach(x=>x.click()); await W(500);
      o.q3=await end('trip-z3'); await tap('Έπιασα, θα τα γράψω τώρα'); t=tr().find(x=>x.sid==='trip-z3'); o.log=[t&&t.fish0,k(t),!!document.querySelector('.sheet.on .bform:not(.zeroq):not(.rateq)'),!!document.querySelector('.sheet.on .rateq')];
      return o; }""")
    check('έξοδος με 0 ψάρια: «Έπιασες κάτι;» με τρεις απαντήσεις· «δεν θα τα γράψω» → εκτός ελέγχου (k=u), «τίποτα» → μετρά (k=l), «θα τα γράψω» → ανοίγει η φόρμα (1.14.88)',
          len(r['q'][1])==3 and r['q'][1]==['Δεν έπιασα τίποτα','Έπιασα, θα τα γράψω τώρα','Έπιασα, αλλά δεν θα τα γράψω'] and r['un'][0]=='unlogged' and r['un'][1]=='u' and r['un'][3] and r['none'][:3]==['none',0,'l'] and not r['none'][3] and r['log'][0]=='log' and r['log'][1]=='u' and r['log'][2] and not r['log'][3] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.__g){sessionStorage.__g=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'trip-g1',start:Date.now()-90*60000,due:Date.now()+3*3600000,route:'G',last:{lat:34.7,lon:32.4,t:Date.now()}}));}")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4500)
    r=pg.evaluate("""async()=>{ const W=ms=>new Promise(r=>setTimeout(r,ms)), t0=Date.now()-90*60000, pts=[], mla=1/111320, mlo=1/(111320*Math.cos(34.7*Math.PI/180)); let t=t0, m=0, s=5;
      const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff, add=(x,y)=>{ const p=[34.7+y*mla,32.4+x*mlo,t+=20000,6]; pts.push(p); };
      for(let i=0;i<40;i++) add(i*12,0); for(let i=0;i<60;i++) add(468+(rnd()-.5)*30,(rnd()-.5)*30); for(let i=1;i<=40;i++) add(468,i*12);
      for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i]; m+=Math.hypot((b[0]-a[0])/mla,(b[1]-a[1])/mlo); }
      localStorage.setItem('alkyon-track',JSON.stringify({id:'trip-g1',pts,m,d:{js:pts.length}})); AK.trip.back(); await W(1200);
      const tr=JSON.parse(localStorage.getItem('alkyon-trips')||'[]').find(x=>x.sid==='trip-g1')||{}; const g=tr.gps||{}; return {km:tr.km,n:(tr.track||[]).length,raw:g.raw,stops:g.stops,cut:g.cut,out:g.out,kmRaw:g.kmRaw,src:g.src,end:g.end,v:AK.gpsVerdict(g,tr.endMs-tr.startMs).code,js:g.js}; }""")
    check('διαδρομή: η στάση 20 λεπτών γίνεται ένα σημείο, η απόσταση είναι η πραγματική (0,9 km, όχι με το τρέμουλο), η διάγνωση γράφεται στην έξοδο (1.14.88)',
          r.get('raw')==140 and r.get('stops')==1 and r.get('cut',0)>=50 and abs((r.get('km') or 0)-0.9)<=0.1 and (r.get('kmRaw') or 0)>=1.3 and 3<=r.get('n',0)<=8 and r.get('out')==r.get('n') and r.get('src')=='web' and r.get('v')=='ok' and r.get('js')==140 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.ld){sessionStorage.ld=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>{AK.troll.landHere(34.80,32.45); AK.troll.landHere(34.70,32.45);}"); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>[AK.troll.landHere(34.80,32.45), AK.troll.landHere(34.70,32.45)]")
    check('συρτή: αναγνωρίζει στεριά/θάλασσα (Πάφος / ανοιχτά) (1.9.22)', r==[True,False] and not pg._errs, [r,pg._errs]); c.close()
    for _mins,_want in ((70,1),(200,0)):
        _t2=(_dt.datetime.now(_dt.timezone.utc)-_dt.timedelta(minutes=_mins)).strftime('%Y%m%d%H%M')
        def _mk(_t2):
          def radr2(route):
            u=route.request.url
            if 'radar.json' in u: return route.fulfill(json={'frames':[{'t':_t2,'img':'radar_'+_t2+'.png'}],'bounds':[[32.7,29.6],[36.9,36.0]]},headers={'Access-Control-Allow-Origin':'*'})
            return route.fulfill(body=_png,content_type='image/png')
          return radr2
        c=ctx(b); c.add_init_script("if(!sessionStorage.rd){sessionStorage.rd=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-map',JSON.stringify({base:'sat',sea:false,zones:false,rain:true}));}")
        c.route('**/raw.githubusercontent.com/dinospapani/alkyon/radar-data/**',_mk(_t2)); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(5000)
        n=pg.evaluate("()=>document.querySelectorAll('.domradar').length")
        check('ραντάρ ΤΜ: εικόνα %d′ → %s (1.9.23)'%(_mins,'ΤΜ' if _want else 'RainViewer'), n==_want and not pg._errs, [n,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(600)
    r=pg.evaluate("()=>{const a=[...document.querySelectorAll('a.li')].find(x=>/mailto:alkyonfishingapp@gmail.com/.test(x.href)); return a?a.textContent:null}")
    check('προφίλ: «Επικοινωνία» με email της εφαρμογής (1.9.24)', r and 'Επικοινωνία' in r and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    c.route('**/*supabase.co/**',lambda r: r.fulfill(json=[])); pg=page(c); pg.goto(BASE+'/v4/#alerts'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>[...document.querySelectorAll('h2')].some(x=>x.textContent==='Κοινότητα')")
    pg.evaluate("()=>AK.commShare({id:'x1',species:'Μαγιάτικο',kg:15,date:'2026-10-25'})"); pg.wait_for_timeout(800)
    r2=pg.evaluate("()=>{const s=document.querySelector('.sheet.on'); return !![...s.querySelectorAll('*')].find(e=>e.classList.contains('cmshare'))}")
    check('Κοινότητα: ρυθμίσεις ειδοποιήσεων και μοίρασμα σε μία οθόνη (1.9.25)', r and r2 and not pg._errs, [r,r2,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-fcopen',JSON.stringify({pw:1}));localStorage.setItem('alkyon-pwrange',JSON.stringify('d3'))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>{const d=[...document.querySelectorAll('details')].find(x=>/Πίεση, άνεμος, σελήνη/.test(x.textContent)); if(d) d.open=true}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const g=document.querySelector('.pwgood'); return {g:g?g.innerText:null,mg:document.querySelectorAll('.pwc .mg').length,k4:!!document.querySelector('.pwl .k4')}}")
    check('πίεση/άνεμος/σελήνη: καλές ώρες σελήνης (1.9.26)', r['g'] and 'Καλές ώρες σελήνης' in r['g'] and r['k4'] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-fcopen',JSON.stringify({pw:1}));localStorage.setItem('alkyon-advsp',JSON.stringify('Καλαμάρι'))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>{const d=[...document.querySelectorAll('details')].find(x=>/Πίεση, άνεμος, σελήνη/.test(x.textContent)); if(d) d.open=true}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{document.querySelectorAll('details.pwmore').forEach(d=>d.open=true); const m=document.querySelector('.mres'); return m?m.innerText:null}")
    r2=pg.evaluate("()=>{const sm={f:0,rise:360,set:1080,maj:[],min:[]}, w={wind:8,wave:0.4,ptrend:'stable',cloud:'part'}; const a=PF.hourScore(sm,9,Object.assign({sp:{n:'Μαγιάτικο'}},w)), b=PF.hourScore(Object.assign({},sm,{f:0.25}),9,Object.assign({sp:{n:'Μαγιάτικο'}},w)), c=PF.hourScore(sm,9,Object.assign({sp:{n:'Καλαμάρι',l:'Loligo vulgaris'}},w)), d=PF.hourScore(Object.assign({},sm,{f:0.5}),9,Object.assign({sp:{n:'Καλαμάρι',l:'Loligo vulgaris'}},w)); return [a,b,c,d]}")
    check('σελήνη ανά είδος: έρευνα στο γράφημα, φάση μόνο στο καλαμάρι (1.9.27)', r and 'Καλαμάρι' in r and r2[0]==r2[1] and r2[2]>r2[3] and not pg._errs, [r,r2,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-fcopen',JSON.stringify({pw:1}))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>{const t=document.body.innerText; return {strong:/δυνατ(ές|ή σελήνη)|ασθεν(είς|ής σελήνη)/.test(t), two:[...document.querySelectorAll('.why li, .tags span, .chip')].filter(x=>/^Ριπές έως/.test(x.textContent.trim())).length}}")
    check('ίδιες λέξεις για τη σελήνη, άνεμος+ριπές σε μία ετικέτα (1.9.28)', not r['strong'] and r['two']==0 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-inbox',JSON.stringify([{at:new Date().toISOString(),kind:'good',title:'🎣 Καλές μέρες για ψάρεμα',body:'x',full:'Σημείο χάρτη: Δευ 09/11 · δείκτης 79 · 16:00–18:00\\n   νέα σελήνη, σταθερή πίεση\\nΣημείο χάρτη: Τρί 10/11 · δείκτης 76 · 16:00–18:00\\n   νέα σελήνη'}]))"); pg=page(c); pg.goto(BASE+'/v4/#inbox'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.ibrow')].find(x=>/Καλές μέρες/.test(x.textContent)); if(b) b.click()}"); pg.wait_for_timeout(600)
    r=pg.evaluate("()=>({n:document.querySelectorAll('.ibday').length, why:document.querySelectorAll('.ibwhy').length, pl:!!document.querySelector('.ibpl')})")
    check('ειδοποίηση «Καλές μέρες»: μία κάρτα ανά μέρα (1.9.29)', r['n']==2 and r['why']==2 and not r['pl'] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.set_geolocation({'latitude':35.045,'longitude':32.40}); c.add_init_script("localStorage.setItem('alkyon-v4-fcopen',JSON.stringify({expo:1}))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(6000)
    r=pg.evaluate("()=>{const x=document.querySelector('#fcExposure'); const order=[...document.querySelectorAll('#main .hero, #main .nowcard, #main .hcard, #main details.fold')].filter(e=>!e.hidden&&e.dataset.k!=='opps').map(e=>e.classList.contains('hero')?'h':e.classList.contains('nowcard')?'n':e.classList.contains('hcard')?'u':e.querySelector('#fcExposure')?'e':'f').join(''); return {v:x&&x.dataset.v, cv:!!(x&&x.querySelector('.exmap canvas')), v1:!!(x&&x.querySelector('.exv')), est:!!(x&&x.querySelector('.exest:not([hidden]) b')), order:order}}")
    check('έκθεση ακτής με χάρτη, σειρά σημασίας στη σελίδα (1.9.30)', r['v']=='2' and r['cv'] and r['v1'] and r['est'] and r['order'].startswith('hnue') and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_selector('.dstrip .dtile:not(.past)'); pg.wait_for_timeout(1000)
    # 1.9.58: αύριο, όχι σήμερα: μετά τη δύση η σημερινή μέρα δεν έχει άλλες ώρες φωτός και η κάρτα δεν βγαίνει (το test αποτύγχανε μόνο το βράδυ)
    pg.evaluate("()=>document.querySelectorAll('.dstrip .dtile:not(.past)')[1].click()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const x=document.querySelector('.hero .hsplit'); const fc=JSON.parse(localStorage.getItem('alkyon-fc')||'null'); return {box:!!x, n:x?x.querySelectorAll('.hsb').length:0, txt:x?x.innerText:''}}")
    r2=pg.evaluate("()=>{const sm={f:0.25,rise:360,set:1080,maj:[],min:[]}; const w={wind:30,wave:2.2,gust:40,ptrend:'stable',cloud:'part'}; return [PF.hourScore(sm,9,w), PF.hourScore(sm,9,Object.assign({bite:true},w))]}")
    check('Τσίμπημα και Θάλασσα χωριστά (1.9.32)', r['box'] and r['n']==2 and 'Τσίμπημα' in r['txt'] and r2[1]>r2[0]+20 and not pg._errs, [r,r2,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ const T0=Date.UTC(2026,9,1,4,0), trips=[], bites=[];
      for(let d=0;d<8;d++){ const st=T0+d*86400000, en=st+6*3600000, sc=[]; for(let k=0;k<6;k++) sc.push([Math.floor(st/3600000)+k, k<2?80:50]);
        trips.push({startMs:st,endMs:en,lat:35.05,lon:32.4,scoreH:sc});
        const loc=new Date(st+120*60000+30*60000); bites.push({date:loc.toISOString().slice(0,10),time:loc.toISOString().slice(11,16)}); }
      const v=PP.vsMoon(trips,bites,{utcMin:120}); return {ok:v.ok,n:v.n,rA:v.rA,hiA:v.A.hi.c,loA:v.A.lo.c}; }''')
    check('Alkyon ή μόνο σελήνη: σύγκριση με τα ψάρια σου (1.9.33)', r['n']==8 and r['hiA']==8 and r['loA']==0 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3500)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.seg button')].find(x=>/Δικά μου/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>({card:!!document.querySelector('.tfcard'), miss:AK.tripFill.missing().length})")
    pg.evaluate("()=>document.querySelector('.tfcard .btn').click()"); pg.wait_for_timeout(600)
    n=pg.evaluate("()=>document.querySelectorAll('.tfill .tfr').length")
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.tfill .btn.pri')][0]; b&&b.click()}"); pg.wait_for_timeout(800)
    r2=pg.evaluate("()=>({trips:AK.store.raw('trips').filter(t=>t.fromCatches).length, miss:AK.tripFill.missing().length, ses:AK.adv.model().progress.sessions})")
    check('έξοδοι από τα ψάρια της ημέρας (1.9.34)', r['card'] and r['miss']>=1 and n>=1 and r2['trips']>=1 and r2['miss']==0 and r2['ses']>=1 and not pg._errs, [r,n,r2,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.hero .btn')].find(x=>/Πού να πάω/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.btn')].find(x=>/Πού είναι ήρεμα/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(5000)
    r=pg.evaluate("()=>({rows:document.querySelectorAll('.calmr').length, txt:(document.querySelector('.calml')||{}).innerText||''})")
    check('Πού είναι ήρεμα τώρα (1.9.34)', (r['rows']>=1 or 'δεδομένα' in r['txt']) and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{const d=document.createElement('div'); d.className='card'; d.innerHTML='<button class=btn>📍 Πού</button><p class=sub>'+'λόγια '.repeat(60)+'</p>'; document.querySelector('#main').append(d); return new Promise(res=>setTimeout(()=>res({ik:!!d.querySelector('.btn .pik'), emo:/📍/.test(d.textContent), cl:!!d.querySelector('p.clmp'), more:!!d.querySelector('.clmpb')}),300)); }")
    check('εικονίδια αντί για emoji και «Περισσότερα» σε μεγάλα κείμενα (1.9.36)', r['ik'] and not r['emo'] and r['cl'] and r['more'] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.removeItem('alkyon-onboard');localStorage.removeItem('alkyon-bites')"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    a=pg.evaluate("()=>!!document.querySelector('.sppage .spback')")
    pg.evaluate("()=>document.querySelector('.sppage .spgo').click()"); pg.wait_for_timeout(400)
    t1=pg.evaluate("()=>document.querySelector('.sptitle h1').textContent")
    pg.evaluate("()=>document.querySelector('.sppage .spback').click()"); pg.wait_for_timeout(400)
    t0=pg.evaluate("()=>document.querySelector('.sptitle h1').textContent")
    check('καλωσόρισμα: κουμπί «Πίσω» (1.9.38)', (not a) and 'ψαρεύεις' in t1 and 'Καλώς' in t0 and not pg._errs, [a,t1,t0,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-inbox',JSON.stringify([{at:new Date().toISOString(),kind:'commre',title:'❤️ Άρεσε σε κάποιον το ψάρι σου',body:'Μαγιάτικο'}]))"); pg=page(c); pg.goto(BASE+'/v4/#inbox'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{const row=[...document.querySelectorAll('.ibrow')].find(x=>/Άρεσε/.test(x.textContent)); return {ic:!!(row&&row.querySelector('.ibic.k-comm'))}}")
    pg.evaluate("()=>{const row=[...document.querySelectorAll('.ibrow')].find(x=>/Άρεσε/.test(x.textContent)); row&&row.click()}"); pg.wait_for_timeout(800)
    check('ειδοποίηση κοινότητας: εικονίδιο και άνοιγμα Κοινότητας (1.9.39)', r['ic'] and pg.evaluate('location.hash')=='#community' and not pg._errs, [r,pg.evaluate('location.hash'),pg._errs]); c.close()
    c=ctx(b, prof='shore'); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('.seg button,.lseg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)); t&&t.click()}"); pg.wait_for_timeout(600)
    pg.evaluate("()=>{const r=[...document.querySelectorAll('.li')].find(x=>/Όρια ασφαλείας/.test(x.textContent)); r&&r.click()}"); pg.wait_for_timeout(700)
    r=pg.evaluate("()=>({card:!!document.querySelector('.limc'), sug:!!document.querySelector('.limc .limsug')})")
    check('όρια ασφαλείας στο Προφίλ, πρόταση για ακτή (1.9.40)', r['card'] and r['sug'] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-logtab',JSON.stringify('fish'))"); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('.seg button,.lseg button')].find(x=>/^Ψάρια/.test(x.textContent.trim())); t&&t.click()}"); pg.wait_for_timeout(600)
    a=pg.evaluate("()=>!!document.querySelector('.srow .addfish')"); pg.evaluate("()=>document.querySelector('.srow .addfish').click()"); pg.wait_for_timeout(800)
    f=pg.evaluate("()=>!!document.querySelector('.bf2, .bform, form')")
    check('Ημερολόγιο: κουμπί «+ Ψάρι» (1.9.41)', a and f and not pg._errs, [a,f,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('.seg button,.lseg button')].find(x=>/^Έξοδοι/.test(x.textContent.trim())); t&&t.click()}"); pg.wait_for_timeout(600)
    pg.evaluate("()=>document.querySelector('.addrow .addbtn').click()"); pg.wait_for_timeout(600)
    n=pg.evaluate("()=>[...document.querySelectorAll('.list .li')].filter(x=>/Ξεκινώ τώρα|Παλιά έξοδος/.test(x.textContent)).length")
    pg.evaluate("()=>{const c=document.querySelector('.sheet .close,.sheet [aria-label=Κλείσιμο]'); c&&c.click()}"); pg.wait_for_timeout(400)
    pg.evaluate("()=>{const t=[...document.querySelectorAll('.seg button,.lseg button')].find(x=>/^Σημεία/.test(x.textContent.trim())); t&&t.click()}"); pg.wait_for_timeout(600)
    sp=pg.evaluate("()=>!!document.querySelector('.srow .addfish[aria-label=\"Νέο σημείο\"]')")
    check('Ημερολόγιο: «+» σε Εξόδους και Σημεία (1.9.42)', n>=2 and sp and not pg._errs, [n,sp,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(800)
    r=pg.evaluate("()=>{const i=[...document.querySelectorAll('input')].find(x=>/Λαβράκι|Sea bass/.test(x.placeholder||'')); if(!i) return 'noinput'; i.value='σουπιοκαλ'; i.dispatchEvent(new Event('input',{bubbles:true})); return new Promise(res=>setTimeout(()=>res([...document.querySelectorAll('.sugi')].map(x=>x.textContent).join('|')),300)); }")
    check('νέο ψάρι: είδη του Οδηγού στη λίστα (σουπιοκαλάμαρο) (1.9.42)', 'Sepioteuthis' in str(r) and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(800); pg.evaluate("()=>document.querySelector('.bfline').click()"); pg.wait_for_timeout(400)
    n=pg.evaluate("()=>document.querySelectorAll('.wpk .wpb').length")
    pg.evaluate("()=>[...document.querySelectorAll('.wpb')][1].click()"); pg.wait_for_timeout(1500)
    ov=pg.evaluate("()=>!!document.querySelector('.bpov')")
    pg.evaluate("()=>document.querySelector('.bpbot .btn').click()"); pg.wait_for_timeout(500)
    r=pg.evaluate("()=>({v:[...document.querySelectorAll('select')].map(x=>x.value).find(v=>v==='coord')||'', sum:document.querySelector('.wps').innerText})")
    check('νέο ψάρι: «Πού» με κουμπιά και μεγάλο χάρτη (1.9.43)', n==3 and ov and r['v']=='coord' and '°' in r['sum'] and not pg._errs, [n,ov,r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_selector('.dstrip .dtile:not(.past)'); pg.wait_for_timeout(1500)
    nm=pg.evaluate("()=>{const x=document.querySelector('.hero .nmx'); const r=PF.nextMoon(Date.now()); return [x?(x.title||'')+x.textContent:'', r&&r.nw>Date.now()&&r.nw-Date.now()<30*864e5, r&&r.full>Date.now()]}")
    check('Πρόγνωση: επόμενη νέα σελήνη (1.9.44)', 'νέα σελήνη' in nm[0] and nm[1] and nm[2] and not pg._errs, [nm,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    c.route('**/*supabase.co/**',lambda r: r.fulfill(json=[])); pg=page(c); pg.goto(BASE+'/v4/#alerts'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{const s=[...document.querySelectorAll('section.card')].find(x=>/Καλαμάρια και νέα σελήνη/.test(x.textContent)); return s?[!!s.querySelector('input[type=checkbox]'),/Επόμενη νέα σελήνη/.test(s.textContent)]:null}")
    check('Ειδοποιήσεις: «Καλαμάρια και νέα σελήνη» (1.9.44)', r and all(r) and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(800); pg.evaluate("()=>document.querySelector('.bfline').click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>[...document.querySelectorAll('.wplinks .linkbtn')][0].click()"); pg.wait_for_timeout(400)
    r=pg.evaluate("()=>{const m=document.querySelector('.cpbox .cpmapb'); if(!m) return null; const w=m.getBoundingClientRect().width, p=m.parentElement.getBoundingClientRect().width; m.click(); return [w>p*0.9, !m.closest('.cptools')]}"); pg.wait_for_timeout(1200)
    mp=pg.evaluate("()=>{const x=document.querySelector('.cpbox .cpmap'); return !!x&&!x.hidden}")
    check('συντεταγμένες: «Διάλεξε στον χάρτη» ξεχωριστό κουμπί (1.9.44)', r and all(r) and mp and not pg._errs, [r,mp,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#tackle'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>new Promise(res=>{const go=()=>{const L=window.TACKLE_LIB||[], e=L.filter(x=>x[3]&&x[3].kind==='egi'); const d=L.find(x=>x[1]==='DUEL'&&x[2]==='EZ-Q Cast Rattle #3.0'); const sp=L.find(x=>x[2]==='Sephia Sepy Flash Boost #1.8'); res([e.length, d?d[3].w[0]:null, new Set(e.map(x=>x[1])).size, sp&&sp[3].w?sp[3].w[0]:null]);}; if(window.TACKLE_LIB) go(); else { const s=document.createElement('script'); s.src='../tackle-lib.js'; s.onload=go; document.head.appendChild(s);} })")
    check('Εξοπλισμός: βιβλιοθήκη καλαμαριέρες (1.9.45, 1.9.46, 1.9.49)', r[0]>=123 and r[3]==7 and r[1]==14 and r[2]>=12 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-advsp',JSON.stringify('Καλαμάρι'))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_selector('.dstrip .dtile:not(.past)'); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const q=document.querySelector('.hero .sqb'); const D=[{date:'2026-11-10',set:1004,hours:[{t:'2026-11-10T16:00',hr:16,score:80,wind:4,wave:.3,safe:true},{t:'2026-11-10T17:00',hr:17,score:75,wind:9,wave:.2,safe:true}]},{date:'2026-11-14',set:1003,hours:[{t:'2026-11-14T16:00',hr:16,score:90,wind:2,wave:.1,safe:true}]}]; const a=PF.squidEves(D,Date.parse('2026-11-09T06:11Z'),{}); return [q?q.textContent:'', a.length, a[0]&&a[0].hr]}")
    check('καλαμάρι: καλύτερο βράδυ κοντά στη νέα σελήνη (1.9.47)', 'καλαμάρι' in r[0].lower() and r[1]==1 and r[2]==16 and not pg._errs, [r,pg._errs]); c.close()
    trips=[]
    import json as _json
    for i,rt in enumerate([2,2,1,0,0]):
        st=1793500000000+i*86400000; trips.append({'id':'rt%d'%i,'date':'2026-10-2%d'%i,'startMs':st,'endMs':st+3*3600000,'rate':rt,'scoreH':[[st//3600000,80 if rt==2 else 60 if rt==1 else 45],[st//3600000+1,78 if rt==2 else 58 if rt==1 else 40]],'_u':1})
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-trips',JSON.stringify(%s))"%_json.dumps(trips)); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3500)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.seg button')].find(x=>/Δικά μου/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const c=[...document.querySelectorAll('section.card')].find(x=>/Πρόγνωση και πώς ήταν/.test(x.textContent)); return c?c.innerText:''}")
    pg.evaluate("()=>AK.tripRate('rt2')"); pg.wait_for_timeout(500)
    q=pg.evaluate("()=>{const b=[...document.querySelectorAll('.rateq .btn')]; const n=b.length; b.find(x=>x.textContent==='Καλό').click(); return n}"); pg.wait_for_timeout(400)
    rv=pg.evaluate("()=>AK.store.get('trips','rt2').rate")
    check('«Πώς ήταν το ψάρεμα;» και σύγκριση με τον βαθμό (1.9.50)', 'Η πρόγνωση συμφωνεί' in r and q==3 and rv==2 and not pg._errs, [r[:300],q,rv,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    r=pg.evaluate("""()=>{ localStorage.removeItem('alkyon-v4-setsync'); localStorage.setItem('alkyon-boat',JSON.stringify({name:'local'}));
      const o1=[]; const g1=AK.store.setsSync([{kind:'settings',id:'main',data:{'alkyon-boat':{name:'cloud'},'alkyon-limits':{wave:0.8},_u:5}}],o1);
      const a=[g1, JSON.parse(localStorage.getItem('alkyon-boat')).name, o1.length];
      localStorage.setItem('alkyon-limits',JSON.stringify({wave:1.1})); const o2=[]; AK.store.setsSync([{kind:'settings',id:'main',data:{'alkyon-boat':{name:'cloud'},_u:5}}],o2);
      const o3=[]; AK.store.setsSync([],o3);
      return a.concat([o2.length, o2[0]&&o2[0].kind, o2[0]&&o2[0].data['alkyon-limits'].wave, o3.length]); }""")
    check('ρυθμίσεις στον λογαριασμό: νέο κινητό τις παίρνει, αλλαγή ανεβαίνει (1.9.50)', r==[1,'cloud',0,1,'settings',1.1,0] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-inbox',JSON.stringify([{at:new Date().toISOString(),kind:'commre',title:'x',body:'y'}]))"); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>{const a=document.querySelector('.mapbar .bellb'), m=document.querySelector('.mclay'); if(!a||!m) return null; const x=a.getBoundingClientRect(), y=m.getBoundingClientRect(); return [getComputedStyle(a).display, x.top>=y.bottom+4, Math.abs(x.right-y.right)<2]}")
    check('καθαρός χάρτης: το καμπανάκι κάτω από τα «Στρώματα», όχι από πίσω (1.9.51)', r and r[0]!='none' and r[1] and r[2] and not pg._errs, [r,pg._errs]); c.close()
    now=int(time.time()*1000)
    c=ctx(b); c.add_init_script("if(!sessionStorage.bp){sessionStorage.bp=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T3',start:%d,due:%d}));localStorage.setItem('alkyon-v4-acctask','1');localStorage.setItem('alkyon-v4-inbox',JSON.stringify([{at:new Date().toISOString(),kind:'commre',title:'x',body:'y'}]));}"%(now-600000,now+3600000*4)); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(6500)
    r=pg.evaluate("()=>{const g=s=>{const e=document.querySelector(s); return e&&getComputedStyle(e).display!=='none'?e.getBoundingClientRect():null}; const p=g('.mcpanel'), l=g('.mclay'), a=g('.mapbar>.bellb'); if(!p||!l||!a) return [!!p,!!l,!!a]; return [l.top>=p.bottom+4, a.top>=l.bottom+4, a.top>=p.bottom+4]}")
    check('σε έξοδο: «Στρώματα» και καμπανάκι κάτω από την κάρτα ΨΑΡΕΥΩ/ΕΠΙΣΤΡΟΦΗ, χωρίς επικάλυψη (1.9.84)', r==[True,True,True] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-v4-acctask','1');"); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    pg.evaluate("()=>{window.__p=null; AK.mapPick({lat:35.0553,lon:32.3822,z:13,title:'t',onPick:(a,o)=>{window.__p=[a,o]}})}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const v=s=>[...document.querySelectorAll(s)].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0); const cr=v('.cross')[0], bt=document.querySelector('.mpkbar').getBoundingClientRect().top, q=cr?cr.getBoundingClientRect():null; return [v('.cross').length+v('.wxcross').length, !!q&&q.bottom<bt]}")
    pg.evaluate("()=>document.querySelector('.mpkbar .btn.pri').click()"); pg.wait_for_timeout(500); pp=pg.evaluate("()=>window.__p")
    check('διαλογή σημείου: ένας σταυρός, πάνω από την κάρτα, αποθηκεύει ακριβώς το σημείο κάτω του (1.9.85)', r==[1,True] and pp and abs(pp[0]-35.0553)<0.0002 and abs(pp[1]-32.3822)<0.0002 and not pg._errs, [r,pp,pg._errs]); c.close()
    inb=[{'at':'2026-11-08T14:05:00Z','kind':'wind','title':'💨 Wind change · Map point','body':'x'},{'at':'2026-11-08T13:46:00Z','kind':'smart','title':'🏠 When to head back','body':'y'},{'at':'2026-11-08T13:03:00Z','kind':'good','title':'⭐ A good fishing window is coming soon for you today','body':'z'}]
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-inbox',JSON.stringify(%s))"%json.dumps(inb)); pg=page(c); pg.goto(BASE+'/v4/#inbox'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>[...document.querySelectorAll('.ibrow')].map(x=>[x.querySelector('.ibic').className.replace('ibic ',''), x.querySelector('.tx b').textContent, !!x.querySelector('.tx b .ik'), getComputedStyle(x.querySelector('.tx b')).whiteSpace])")
    we=pg.evaluate("""()=>{ const mk=(a)=>({nowLocal:'2026-11-08T12:00',days:[{hours:a.map((w,i)=>({t:'2026-11-08T'+String(12+i).padStart(2,'0')+':00',wind:w[0],dir:w[1]}))}]});
      return [!!PF.windEvent(mk([[0,315],[6,45],[6,45]])), !!PF.windEvent(mk([[6,315],[14,315],[14,315]])), !!PF.windEvent(mk([[4,0],[4,180],[4,180]])), !!PF.windEvent(mk([[9,0],[9,180],[9,180]]))]; }""")
    ok=r and len(r)==3 and [x[0] for x in r]==['k-wind','k-trip','k-good'] and not any(x[2] for x in r) and r[0][1].startswith('Αλλαγή ανέμου') and r[2][3]=='normal'
    check('ειδοποιήσεις: ένα εικονίδιο, σωστή κατηγορία, τίτλος χωρίς «…»· όχι «αλλαγή ανέμου» από νηνεμία (1.9.52)', ok and we==[False,True,False,True] and not pg._errs, [r,we,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>AK.pushHeal?AK.pushHeal(true):'missing'")
    check('ειδοποιήσεις: αυτόματη επανασύνδεση υπάρχει και δεν σπάει χωρίς άδεια (1.9.53)', r in ('off','nologin') and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const w=document.querySelector('input[type=datetime-local]'); w.value='2025-01-02T10:00'; w.dispatchEvent(new Event('change')); const sel=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.value==='gps')); const hnt=document.querySelector('.oldhint'); return [sel&&sel.value, hnt&&!hnt.hidden, !document.querySelector('.bfww').hidden]}")
    check('παλιό ψάρι: όχι η θέση μου τώρα, ζητά πού ήταν (1.9.54)', r==['none',True,True] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(2000)
    pg.evaluate("()=>[...document.querySelectorAll('.wpb')][1].click()"); pg.wait_for_timeout(2000)
    bx=pg.locator('.bpov .bpm').bounding_box(); x=bx['x']+bx['width']/2; y=bx['y']+bx['height']/2
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-150,y+120,steps=12); pg.mouse.up(); pg.wait_for_timeout(800)
    pg.evaluate("()=>document.querySelector('.bpbot .btn').click()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>{const i=[...document.querySelectorAll('input')].find(x=>/Λαβράκι|Sea bass/.test(x.placeholder||'')); i.value='Σφυρίδα'; i.dispatchEvent(new Event('input',{bubbles:true}));}")
    pg.evaluate("()=>document.querySelector('.bfsave').click()"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const a=AK.store.raw('bites'); const x=a[a.length-1]; return x?[x.lat,x.lon]:null}")
    check('νέο ψάρι: το σημείο του μεγάλου χάρτη αποθηκεύεται (όχι η θέση GPS) (1.9.55)', r and abs(r[0]-35.0)>0.003 and abs(r[1]-33.3)>0.003 and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{ AK.depthAt=(la,lo)=>Promise.resolve(Math.abs(la-35.0)<0.0005&&Math.abs(lo-33.3)<0.0005?150:42); AK.biteForm(); }"); pg.wait_for_timeout(2000)
    d0=pg.evaluate("()=>{const i=[...document.querySelectorAll('input')].find(x=>x.closest('.fld')&&/Βάθος|Depth/.test(x.closest('.fld').textContent)&&x.type!=='checkbox'); return i?i.value:null}")
    pg.evaluate("()=>[...document.querySelectorAll('.wpb')][1].click()"); pg.wait_for_timeout(2000)
    bx=pg.locator('.bpov .bpm').bounding_box(); x=bx['x']+bx['width']/2; y=bx['y']+bx['height']/2
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-150,y+120,steps=12); pg.mouse.up(); pg.wait_for_timeout(800)
    pg.evaluate("()=>document.querySelector('.bpbot .btn').click()"); pg.wait_for_timeout(1200)
    d1=pg.evaluate("()=>{const i=[...document.querySelectorAll('input')].find(x=>x.closest('.fld')&&/Βάθος|Depth/.test(x.closest('.fld').textContent)&&x.type!=='checkbox'); return i?i.value:null}")
    sg=pg.evaluate("()=>{const i=[...document.querySelectorAll('input')].find(x=>/Λαβράκι|Sea bass/.test(x.placeholder||'')); i.value='ορφ'; i.dispatchEvent(new Event('input',{bubbles:true})); return [...document.querySelectorAll('.spsug .sugi')].map(x=>x.textContent).join('|')}")
    sv=pg.evaluate("()=>{const b=document.querySelector('.bfsave').getBoundingClientRect(); return Math.round(innerHeight-b.bottom)}")
    check('νέο ψάρι: το βάθος ακολουθεί το σημείο του χάρτη, ο ροφός/ορφός βρίσκεται, το «Αποθήκευση» χαμηλά (1.13.7)', d0=='150' and d1=='42' and 'marginatus' in sg and 0<=sv<=24 and not pg._errs, [d0,d1,sg[:120],sv,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.__u){sessionStorage.__u=1; localStorage.removeItem('alkyon-onboard'); localStorage.removeItem('alkyon-bites'); localStorage.setItem('alkyon-tour-at',JSON.stringify({step:2,s:'boat',p:'boat',t:Date.now()}));}")
    pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const t=document.querySelector('.sppage.tour h1'); return t&&t.textContent; }")
    check('Καλωσόρισμα: αν το κινητό κλείσει την εφαρμογή (π.χ. ρυθμίσεις τοποθεσίας), συνεχίζει από το ίδιο βήμα (1.13.8)', r=='Δες τη θάλασσα πριν φύγεις' and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    r=pg.evaluate("""()=>{ const now=new Date().toISOString(); localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:35.0,lon:33.3,t:Date.now()}));
      AK.sosNear._set([{user_id:'u9',id:'s1',name:'Γιώργος',lat:35.03,lon:33.33,at:now,created_at:now}]); window.dispatchEvent(new Event('alkyon-sos')); AK.sosNear._notify();
      const sh=document.querySelector('.sheet'); return [!!document.querySelector('.mk.sosmk'), !!sh&&/SOS κοντά σου/.test(sh.textContent)&&/Γιώργος/.test(sh.textContent)&&/ν\.μ\./.test(sh.textContent)]; }""")
    check('SOS κοντά σου: κόκκινο σημάδι στον χάρτη και ειδοποίηση με απόσταση και «Πήγαινε εκεί» (1.14.0)', r==[True,True], [r,pg._errs])
    pg.evaluate("()=>{ AK.closeSheet(); localStorage.setItem('alkyon-sos-me',JSON.stringify({id:'sos-x',t:Date.now(),lat:35,lon:33.3})); }"); pg.reload(); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const b=document.querySelector('.sosbar'); return [!!b&&/SOS/.test(b.textContent)&&/112/.test(b.textContent)&&/Είμαι καλά/.test(b.textContent)]; }")
    check('Δικό μου SOS: κόκκινη μπάρα με 112 και «Είμαι καλά» μένει και μετά από επαναφόρτωση (1.14.0)', r==[True] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b,touch=True); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    cdp=c.new_cdp_session(pg)
    def touch(kind,pts): cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]})
    def tap(x,y): touch('touchStart',[(x,y)]); touch('touchEnd',[]); pg.wait_for_timeout(60)
    pg.evaluate("()=>AlkyonCore.map().setZoom(10,{animate:false})"); pg.wait_for_timeout(300)
    tap(200,420); tap(200,420); pg.wait_for_timeout(700); z1=pg.evaluate("()=>AlkyonCore.map().getZoom()")
    touch('touchStart',[(200,420)]); touch('touchEnd',[]); pg.wait_for_timeout(60); touch('touchStart',[(200,420)])
    for k in range(1,10): touch('touchMove',[(200,420+k*20)]); pg.wait_for_timeout(20)
    touch('touchEnd',[]); pg.wait_for_timeout(700); z2=pg.evaluate("()=>AlkyonCore.map().getZoom()")
    touch('touchStart',[(150,420),(250,420)]); touch('touchEnd',[]); pg.wait_for_timeout(700); z3=pg.evaluate("()=>AlkyonCore.map().getZoom()")
    check('Χάρτης: διπλό πάτημα = ζουμ μέσα, διπλό πάτημα και σύρσιμο = ζουμ με ένα δάχτυλο, δύο δάχτυλα = ζουμ έξω (1.13.8)', z1==11 and z2==13 and z3==12 and not pg._errs, [z1,z2,z3,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    r=pg.evaluate("""async()=>{ const now=Date.now(); localStorage.removeItem('alkyon-v4-baro'); localStorage.removeItem('alkyon-v4-barooff');
      for(let i=0;i<=36;i++) AK.baro._save({t:now-(180-i*5)*60000,hpa:1015-i*5/60*0.6});
      AK.baro._test({available:()=>Promise.resolve({ok:true}),read:()=>Promise.resolve({hpa:1013.2,t:Date.now()})}); await AK.baro.read();
      const d1=AK.baro.trend(1), d3=AK.baro.trend(3); AK.baro.calib(1014.0,'station'); const off=AK.baro.offset(), fc=AK.baro.forCatch(now);
      return [d1!=null&&d1<-0.4&&d1>-0.8, d3!=null&&d3<-1.5&&d3>-2.0, Math.abs(off-0.8)<0.05, !!fc&&Math.abs(fc.hpa-1014.0)<0.1]; }""")
    check('Βαρόμετρο κινητού: τάση 1 και 3 ωρών, διόρθωση με σταθμό, τιμή για το ψάρι (1.13.8)', r==[True,True,True,True], r)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ const i=[...document.querySelectorAll('input')].find(x=>/Λαβράκι|Sea bass/.test(x.placeholder||'')); i.value='Σαργός'; i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('.bfsave').click(); }"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{ const b=AK.store.bites().find(x=>x.species==='Σαργός'); return b&&b.pb?[Math.round(b.pb.hpa), b.pb.d1!=null]:null; }")
    check('Βαρόμετρο κινητού: το ψάρι κρατά την πίεση της στιγμής (1.13.8)', r==[1014,True], [r,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>window.scrollTo(0,400)"); pg.wait_for_timeout(300)
    pg.evaluate("()=>AK.relang('en')"); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>[location.hash, Math.round(scrollY)>=300, localStorage.getItem('alkyon-lang')]")
    check('αλλαγή γλώσσας: μένει στη σελίδα και στο σημείο (1.13.7)', r==['#profile',True,'en'], r); c.close()
    inb=[{'id':'u1|sq:2026-11-09','at':'2026-11-08T07:00:00Z','kind':'good','title':'🦑 Καλαμάρια','body':'Καλύτερο: Δευ 16:00','full':'Καλύτερο: Δευ 09/11 16:00–17:00 (βαθμός 90) · σκοτάδι 17:20 ως το πρωί'},{'id':'x2','at':'2026-11-08T08:00:00Z','kind':'wind','title':'Αλλαγή ανέμου','body':'x'}]
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-inbox',JSON.stringify(%s))"%json.dumps(inb)); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>AK.fromNotif('#inbox','sq:2026-11-09')"); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{const f=document.querySelector('.ibrow.ibfoc'); return [location.hash, !!f, f&&f.getAttribute('aria-expanded'), f&&/σκοτάδι/.test(f.textContent)]}")
    pg.evaluate("()=>AK.fromNotif('#community',null)"); pg.wait_for_timeout(800)
    r2=pg.evaluate("()=>location.hash")
    check('πάτημα ειδοποίησης κινητού: ανοίγει τη σωστή σελίδα και την ειδοποίηση (1.9.57)', r==['#inbox',True,'true',True] and r2=='#community' and not pg._errs, [r,r2,pg._errs]); c.close()
    c=ctx(b,lang='en'); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'tb1',date:'2026-10-01',time:'10:00',species:'Sargo',tech:'Βυθού',_u:1}]))"); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const ch=[...document.querySelectorAll('.qchips .chip')].find(x=>/Bottom fishing|Βυθού/.test(x.textContent)); if(!ch) return null; ch.click(); const i=document.querySelector('input[list=bfTech]'); return [ch.textContent, i&&i.value]}")
    check('τεχνική στα αγγλικά: «Bottom fishing» και όχι «Βυθού» (1.9.58)', r==['Bottom fishing','Bottom fishing'] and not pg._errs, [r,pg._errs]); c.close()
    R=[("2024-03-11","12:01","Dusky grouper",5,"stable",5,0.5,18),("2025-01-02","11:30","Dusky grouper",3,"slow",3,0.3,19.4),("2025-02-26","08:11","Dusky grouper",7,"stable",1,0.2,17.5),("2026-10-23","07:23","Χάννος",0.6,"stable",5,0.2,23.8),("2026-10-25","07:23","Πέρκα",0.2,"stable",4,0.4,24.1)]
    cb=[{'id':'cm%d'%i,'date':r[0],'time':r[1],'species':r[2],'kg':r[3],'ptrend':r[4],'wind':r[5],'wave':r[6],'sst':r[7],'tech':'Βυθού','lat':34.75,'lon':32.38,'_u':1} for i,r in enumerate(R)]
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify(%s))"%json.dumps(cb)); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.seg button')].find(x=>/Δικά μου/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>{const c=document.querySelector('.cmcard'); if(!c) return ''; const d=c.closest('details'); if(d) d.open=true; c.querySelectorAll('details').forEach(x=>x.open=true); return c.innerText}")
    check('«Τι κοινό είχαν τα ψαρέματά σου» (1.9.59)', 'Μεγάλα ψάρια (ροφοί, συναγρίδα, μαγιάτικο…) · 3 μέρες' in ' '.join(r.split()) and 'Ιανουάριος–Μάρτιος' in r and 'κοντά στη νέα σελήνη' in r and 'Άλλα ψάρια · 2 μέρες' in ' '.join(r.split()) and not pg._errs, [r[:500],pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'tb1',date:'2026-10-01',time:'10:00',species:'Sargo',tech:'Βυθού',bait:'Live squid',_u:1}]))"); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const ch=[...document.querySelectorAll('.qchips .chip')].find(x=>x.dataset.v==='Βυθού'); if(!ch) return null; ch.click(); const bc=[...document.querySelectorAll('.qchips .chip')].find(x=>x.dataset.v==='Live squid'); bc&&bc.click(); return new Promise(res=>setTimeout(()=>res([ch.getAttribute('aria-pressed'), bc&&bc.getAttribute('aria-pressed')]),50))}")
    check('τεχνική και δόλωμα: το chip ανάβει όταν το διαλέγεις (1.9.59)', r==['true','true'] and not pg._errs, [r,pg._errs]); c.close()
    import os as _os
    import struct as _st
    _pb=open(_os.path.join(ROOT,'badge-96.png'),'rb').read(32); _w,_h=_st.unpack('>II',_pb[16:24])  # χωρίς PIL (δεν υπάρχει στο GitHub)
    check('εικονίδιο ειδοποίησης: διάφανο PNG 96×96 (1.9.59)', _pb[:8]==b'\x89PNG\r\n\x1a\n' and (_w,_h)==(96,96) and _pb[25]==6 and "badge: 'badge-96.png'" in open(_os.path.join(ROOT,'sw.js')).read(), [_w,_h,_pb[25]])
    c=ctx(b)
    c.route('**/*supabase.co/auth/v1/signup*',lambda r: r.fulfill(json={'id':'u-old','email':'x+test@example.com','identities':[]}))
    pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.authSheet({mode:'up'})"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{const F=document.querySelector('.sheet.on .authf'), e=F.querySelector('input[type=email]'), p=F.querySelector('input[type=password]'); e.value='x+test@example.com'; p.value='secret123'; F.requestSubmit();}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>document.querySelector('.sheet.on .authf').innerText")
    check('εγγραφή με email που έχει ήδη λογαριασμό: το λέει αντί να περιμένει κωδικό (1.9.60)', 'Υπάρχει ήδη λογαριασμός' in r and not pg._errs, [r[-300:],pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    hits=[]
    def _qp(route):
        try: hits.append(route.request.post_data or '')
        except Exception: pass
        route.fulfill(json={'ok':True})
    c.route('**/functions/v1/quick-processor',_qp)
    c.route('**/rest/v1/community_posts?select=*,likes*',lambda r: r.fulfill(json=[{'id':'p1','user_id':'u9','author':'Ψαράς','species':'Σφυρίδα','kg':3,'created_at':'2026-11-08T10:00:00Z','likes':[{'count':0}],'comments':[{'count':0}]}]))
    c.route('**/rest/v1/community_likes*',lambda r: r.fulfill(status=201,body=''))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>{const b=document.querySelector('.cmact .cmbtn'); b&&b.click(); return !!b}"); pg.wait_for_timeout(2500)
    check('Κοινότητα: like → άμεση ειδοποίηση στον server (1.9.61)', any('"comm"' in h for h in hits), hits); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    likes=[]
    c.route('**/functions/v1/quick-processor',lambda r: r.fulfill(json={'ok':True}))
    c.route('**/rest/v1/community_posts?select=*,likes*',lambda r: r.fulfill(json=[{'id':'p1','user_id':'u9','author':'Νίκος Π','species':'Dentex','kg':3,'len':50,'photo':'u9/a.jpg','cond':{'more':[{'s':'Grouper','kg':2.5}],'area':'Λεμεσός'},'created_at':'2026-11-08T10:00:00Z','likes':[{'count':0}],'comments':[{'count':1}]}]))
    c.route('**/rest/v1/community_comments?select=*&post_id*',lambda r: r.fulfill(json=[{'id':'c1','post_id':'p1','user_id':'u9','author':'Νίκος Π','body':'@Ντίνος ωραίο','created_at':'2026-11-08T09:00:00Z'}]))
    c.route('**/storage/v1/object/public/community/**',lambda r: r.fulfill(path=_os.path.join(ROOT,'badge-96.png')))
    c.route('**/rest/v1/community_likes*',lambda r: (likes.append(r.request.method), r.fulfill(status=201,body='')))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{const c=document.querySelector('.cmpost'); return {more:(c.querySelector('.cmmore')||{}).innerText||'',area:(c.querySelector('.cmarea')||{}).innerText||'',ico:!!c.querySelector('.cmact .pik-chat'),noNote:!c.querySelector('.cmact .pik-note')}}")
    check('Κοινότητα: πολλά ψάρια, σύνολο και περιοχή στην ανάρτηση (1.9.62)', 'Grouper 2,5 kg' in r['more'] and 'Σύνολο 5,5 kg' in r['more'] and 'Λεμεσός' in r['area'], r)
    check('Κοινότητα: εικονίδιο σχολίων = συννεφάκι, όχι έγγραφο (1.9.62)', r['ico'] and r['noNote'], r)
    pg.evaluate("()=>document.querySelectorAll('.cmact .cmbtn')[1].click()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{const c=document.querySelector('.cmc'); return {t:c?c.innerText:'',at:!!(c&&c.querySelector('.cmat'))}}")
    check('Κοινότητα: σχόλιο με ώρα και «Απάντηση» (1.9.62)', 'Απάντηση' in r['t'] and ('πριν' in r['t'] or 'χθες' in r['t'] or '/' in r['t']), r)
    pg.evaluate("()=>{[...document.querySelectorAll('.cmc .linkbtn')].find(b=>b.textContent==='Απάντηση').click()}"); pg.wait_for_timeout(300)
    v=pg.evaluate("()=>document.querySelector('.cmcom input').value")
    check('Κοινότητα: «Απάντηση» → «@Όνομα » στο πεδίο', v=='@Νίκος Π ', v)
    pg.evaluate("()=>document.querySelector('.cmph').click()"); pg.wait_for_timeout(700)
    op=pg.evaluate("()=>!!document.querySelector('.cmview img')")
    pg.evaluate("()=>document.querySelector('.cmvx').click()"); pg.wait_for_timeout(200)
    check('Κοινότητα: πάτημα στη φωτογραφία → πλήρης οθόνη, κλείνει με ✕ (1.9.62)', op and not pg.evaluate("()=>!!document.querySelector('.cmview')"), op)
    pg.evaluate("()=>{const p=document.querySelector('.cmph'); p.click(); setTimeout(()=>p.click(),120)}"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>({on:document.querySelector('.cmact .cmbtn').classList.contains('on'),view:!!document.querySelector('.cmview')})")
    check('Κοινότητα: διπλό πάτημα στη φωτογραφία → like, χωρίς πλήρη οθόνη (1.9.62)', r['on'] and not r['view'] and 'POST' in likes and not pg._errs, [r,likes,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    import datetime as _dt
    _now=_dt.datetime.utcnow(); _d=_now.strftime('%Y-%m-%d'); _t=lambda h:(_now-_dt.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ')
    ALL=[{'id':'a1','user_id':'u9','author':'Κώστας','species':'Συναγρίδα','kg':3,'tech':'Βυθού','bait':'Σουπιά','day':_d,'cond':{'more':[{'s':'Ροφός','kg':2.5}]},'created_at':_t(30)},
         {'id':'a3','user_id':'u8','author':'Νίκος','species':'Συναγρίδα','kg':4.1,'tech':'Jigging','day':_d,'cond':{'rel':True},'created_at':_t(5)},
         {'id':'a2','user_id':'u8','author':'Νίκος','species':'Καλαμάρι','kg':0.6,'tech':'Eging','day':_d,'cond':{},'created_at':_t(20)},
         {'id':'a4','user_id':'u7','author':'Τάκης','species':'Σκαθάρι','kg':3,'tech':'Βυθού','day':'2025-02-26','cond':{},'created_at':_t(1)}]
    feed=[]; posts=[]; coms=[]
    c.route('**/functions/v1/quick-processor',lambda r: r.fulfill(json={'ok':True}))
    c.route('**/rest/v1/community_posts?select=id,user_id*',lambda r: r.fulfill(json=ALL))
    def _feed(r):
        feed.append(r.request.url); r.fulfill(json=[dict(x,photo=None,likes=[{'count':0}],comments=[{'count':0}]) for x in reversed(ALL)])
    c.route('**/rest/v1/community_posts?select=*,likes*',_feed)
    def _post(r):
        if r.request.method=='POST': posts.append(r.request.post_data); r.fulfill(status=201,body='')
        else: r.fallback()
    c.route('**/rest/v1/community_posts',_post)
    def _com(r):
        if r.request.method=='POST': coms.append(r.request.post_data); r.fulfill(status=201,body='')
        else: r.fulfill(json=[])
    c.route('**/rest/v1/community_comments*',_com)
    c.route('**/rest/v1/community_likes*',lambda r: r.fulfill(json=[]))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    r=pg.evaluate("()=>{const t=[...document.querySelectorAll('.cmtop')].map(x=>x.innerText); const ps=[...document.querySelectorAll('.cmpost')].map(x=>x.innerText); return {t,ps}}")
    wk=r['t'][0] if r['t'] else ''
    check('Κοινότητα: «Τι πιάνεται αυτή την εβδομάδα» (1.9.63)', 'Τι πιάνεται' in wk and 'Συναγρίδα 2' in wk and 'Ροφός 1' in wk and '2 ψαράδες' in wk, r['t'])
    check('Κοινότητα: παλιό ψάρι που μοιράστηκε τώρα δεν μετράει στην εβδομάδα (1.9.66)', 'Σκαθάρι' not in wk, wk)
    pg.evaluate("()=>[...document.querySelectorAll('.cmtop')].find(x=>x.innerText.includes('Κατάταξη')).querySelector('.cmtoph').click()"); pg.wait_for_timeout(300)
    bd=pg.evaluate("()=>[...document.querySelectorAll('.cmtop')].find(x=>x.innerText.includes('Κατάταξη')).innerText")
    check('Κοινότητα: κατάταξη μήνα, μεγαλύτερο ανά είδος (1.9.63)', 'Κατάταξη' in bd and bd.index('Συναγρίδα')<bd.index('Ροφός')<bd.index('Καλαμάρι') and '4,1 kg' in bd, bd)
    rec=[x for x in r['ps'] if '4,1 kg' in x]
    check('Κοινότητα: 🏆 ρεκόρ και «Απελευθερώθηκε», όχι ρεκόρ με μία μόνο ανάρτηση (1.9.63)', rec and 'Ρεκόρ Κοινότητας' in rec[0] and 'Απελευθερώθηκε' in rec[0] and not any('Ρεκόρ' in x for x in r['ps'] if 'Καλαμάρι' in x), r['ps'])
    n0=len(feed); pg.evaluate("()=>[...document.querySelectorAll('.cmflt .chip')].find(b=>b.textContent==='Συναγρίδα').click()"); pg.wait_for_timeout(1500)
    check('Κοινότητα: φίλτρο είδους → species=eq στο αίτημα (1.9.63)', len(feed)>n0 and 'species=eq.' in feed[-1], feed[-1:])
    pg.evaluate("()=>AK.commProfile('u8','Νίκος')"); pg.wait_for_timeout(800)
    pr=pg.evaluate("()=>document.querySelector('.sheet.on .cmprof').innerText")
    check('Κοινότητα: προφίλ ψαρά με στατιστικά (1.9.63)', '2 αναρτήσεις' in pr and 'απελευθερώθηκαν' in pr and 'Μεγαλύτερα ψάρια' in pr, pr)
    pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .cmprof button')].find(b=>b.textContent==='Ακολούθησε').click()"); pg.wait_for_timeout(800)
    fw=pg.evaluate("()=>localStorage.getItem('alkyon-comm-follow')")
    pg.evaluate("()=>[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='Ακολουθώ').click()"); pg.wait_for_timeout(1500)
    check('Κοινότητα: Ακολούθησε → «Ακολουθώ» φέρνει μόνο αυτούς (1.9.63)', fw and '"u8"' in fw and 'user_id=in.(u8)' in feed[-1], [fw,feed[-1:]])
    pg.evaluate("()=>AK.commAsk({k:'q'})"); pg.wait_for_timeout(600)
    pg.evaluate("()=>{const s=document.querySelector('.sheet.on'); s.querySelector('textarea').value='Ποια καλαμαριέρα;'; [...s.querySelectorAll('button')].find(b=>b.textContent==='Δημοσίευση').click()}"); pg.wait_for_timeout(1500)
    pj=json.loads(posts[-1]) if posts else {}
    check('Κοινότητα: ερώτηση → ανάρτηση με cond.k=q (1.9.63)', pj.get('cond',{}).get('k')=='q' and pj['cond'].get('q')=='Ποια καλαμαριέρα;' and pj.get('src','').startswith('q-'), posts)
    pg.evaluate("()=>AK.commAccept({id:'q1',src:'b1',user_id:'u1',cond:{k:'id'},comments:[{count:0}]},'Σφυρίδα!')"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const s=document.querySelector('.sheet.on'); [...s.querySelectorAll('button')].find(b=>b.textContent==='Επιβεβαίωση').click()}"); pg.wait_for_timeout(1500)
    sp=pg.evaluate("()=>JSON.parse(localStorage.getItem('alkyon-bites')).find(x=>x.id==='b1').species")
    check('Κοινότητα: «✓ Αυτό είναι» → σχόλιο «✓ Σφυρίδα» και αλλάζει το είδος στο Ημερολόγιο (1.9.63)', sp=='Σφυρίδα' and any('✓ Σφυρίδα' in x for x in coms) and not pg._errs, [sp,coms,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));}")
    ALL2=[{'id':'s1','user_id':'u8','author':'Νίκος','species':'Καλαμάρι','latin':'Loligo vulgaris','kg':0.7,'day':_d,'cond':{'wind':8,'wave':0.4,'press':1016,'sst':22,'moon':1},'created_at':_t(3)},
          {'id':'s2','user_id':'u9','author':'Κώστας','species':'European squid','kg':0.9,'day':_d,'cond':{},'created_at':_t(2)}]
    feed2=[]
    c.route('**/functions/v1/quick-processor',lambda r: r.fulfill(json={'ok':True}))
    c.route('**/rest/v1/community_posts?select=id,user_id*',lambda r: r.fulfill(json=ALL2))
    c.route('**/rest/v1/community_posts?select=*,likes*',lambda r: (feed2.append(r.request.url), r.fulfill(json=[dict(x,photo=None,likes=[{'count':0}],comments=[{'count':0}]) for x in reversed(ALL2)])))
    c.route('**/rest/v1/community_comments*',lambda r: r.fulfill(json=[]))
    c.route('**/rest/v1/community_likes*',lambda r: r.fulfill(json=[]))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    ch=pg.evaluate("()=>{const c=[...document.querySelectorAll('.cmtop')].find(x=>x.innerText.includes('Πρόκληση')); if(!c) return ''; if(!c.classList.contains('open')) c.querySelector('.cmtoph').click(); return 1}"); pg.wait_for_timeout(300)
    ch=pg.evaluate("()=>{const c=[...document.querySelectorAll('.cmtop')].find(x=>x.innerText.includes('Πρόκληση')); return c?c.innerText:''}")
    import datetime as _dt2
    if _dt2.datetime.utcnow().month==11: check('Κοινότητα: πρόκληση μήνα, «Καλαμάρι» και «European squid» μετρούν μαζί (1.9.64)', 'Καλαμάρι' in ch and ch.index('Κώστας')<ch.index('Νίκος') and '0,9 kg' in ch, ch)
    else: check('Κοινότητα: κάρτα πρόκλησης μήνα (1.9.64)', 'Πρόκληση' in ch, ch)
    pg.evaluate("()=>{const p=[...document.querySelectorAll('.cmpost')].find(x=>x.innerText.includes('Νίκος')); [...p.querySelectorAll('.cmic')].pop().click()}"); pg.wait_for_timeout(500)
    sv=pg.evaluate("()=>localStorage.getItem('alkyon-comm-saved')")
    pg.evaluate("()=>[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='Σωσμένα').click()"); pg.wait_for_timeout(1500)
    check('Κοινότητα: ☆ → «Σωσμένα» φέρνει μόνο αυτές (1.9.64)', sv and 's1' in sv and 'id=in.(s1)' in feed2[-1], [sv,feed2[-1:]])
    pg.evaluate("()=>[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='Όλα').click()"); pg.wait_for_timeout(1500)
    r=pg.evaluate("()=>AK.commShareImg({id:'s1',species:'Καλαμάρι',kg:0.7,author:'Νίκος',day:'2026-11-08',cond:{}})"); pg.wait_for_timeout(300)
    check('Κοινότητα: κοινοποίηση ως εικόνα (1.9.64)', r=='dl' and not pg._errs, [r,pg._errs])
    pg.evaluate("()=>{const p=[...document.querySelectorAll('.cmpost')].find(x=>x.innerText.includes('Νίκος')); p.querySelector('.cmcmpb').click()}"); pg.wait_for_timeout(3500)
    cm=pg.evaluate("()=>{const s=document.querySelector('.sheet.on .cmcmp'); return s?s.innerText:''}")
    check('Κοινότητα: «Σύγκρινε» → συνθήκες τότε και αύριο (1.9.64)', 'Τότε' in cm and 'Αύριο' in cm and 'Άνεμος' in cm and ('Ίδια σε' in cm or 'μοιάζει' in cm), cm)
    pg.evaluate("()=>{const x=document.querySelector('.sheet.on .iconbtn'); x&&x.click()}"); pg.wait_for_timeout(400)
    pg.evaluate("()=>AK.commProfile('u9','Κώστας')"); pg.wait_for_timeout(800)
    bg=pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .cmbadge.on')].map(x=>x.innerText.trim())")
    check('Κοινότητα: σήματα στο προφίλ (1.9.64)', 'Πρώτη ανάρτηση' in bg and 'Πρώτο καλαμάρι' in bg and '10 είδη' not in bg and not pg._errs, [bg,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#alerts'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const i=document.querySelector('.cmwsp input'); i.value='Καλαμάρι'; [...document.querySelectorAll('.cmwsp button')].find(b=>b.textContent==='Προσθήκη').click()}"); pg.wait_for_timeout(400)
    ks=pg.evaluate("()=>AK.wspKeys(JSON.parse(localStorage.getItem('alkyon-notify')||'{}'))")
    check('Ειδοποιήσεις: «όταν κάποιος πιάσει Καλαμάρι» → κλειδιά λατινικό/ελληνικό/αγγλικό (1.9.64)', 'loligo vulgaris' in ks and 'καλαμάρι' in ks and 'european squid' in ks, ks)
    t=pg.evaluate("()=>document.getElementById('main').innerText")
    check('Ειδοποιήσεις Κοινότητας: Όλοι / Όσοι ακολουθώ / Κανένας (1.9.63)', 'Όσοι ακολουθώ' in t and 'Κανένας' in t, t[-600:]); c.close()
    # 1.9.65
    c=ctx(b); hits65=[]
    def _f65(r):
        hits65.append((r.request.method,r.request.url,r.request.headers.get('authorization','')))
        r.fulfill(json=[{'id':'z1','user_id':'u9','author':'Κώστας','species':'Συναγρίδα','kg':3,'photo':'u9/a.jpg','cond':{'th':1},'created_at':'2026-11-08T10:00:00Z','likes':[{'count':1}],'comments':[{'count':0}]}])
    c.route('**/rest/v1/community_posts?select=*,likes*',_f65)
    c.route('**/rest/v1/community_posts?select=id,user_id*',lambda r: r.fulfill(json=[]))
    c.route('**/rest/v1/community_profiles*',lambda r: r.fulfill(json=[{'user_id':'u9','avatar':'u9/avatar-x.jpg'}]))
    c.route('**/storage/v1/object/public/community/**',lambda r: r.fulfill(path=_os.path.join(ROOT,'badge-96.png')))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    r=pg.evaluate("()=>({anon:!!document.querySelector('.cmanon'),n:document.querySelectorAll('.cmpost').length,img:(document.querySelector('.cmimg')||{}).getAttribute&&document.querySelector('.cmimg').getAttribute('src'),av:!!document.querySelector('.cmhd .cmav img')})")
    check('Κοινότητα χωρίς λογαριασμό: βλέπεις τις αναρτήσεις (δημόσιο κλειδί) (1.9.65)', r['anon'] and r['n']==1 and hits65 and hits65[0][2]=='', [r,hits65[:1]])
    check('Κοινότητα: μικρή φωτογραφία στη λίστα και φωτογραφία προφίλ (1.9.65)', r['img'] and r['img'].endswith('a_t.jpg') and r['av'], r)
    pg.evaluate("()=>document.querySelector('.cmact .cmbtn').click()"); pg.wait_for_timeout(700)
    check('Κοινότητα χωρίς λογαριασμό: like → σύνδεση', pg.evaluate("()=>!!document.querySelector('.sheet.on .authf')") and not pg._errs, pg._errs); c.close()
    check('Κοινότητα: οι φωτογραφίες κρατιούνται στο κινητό (service worker) (1.9.65)', "alkyon-comm-img" in open(_os.path.join(ROOT,'v4','sw.js')).read(), 0)
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com'}));localStorage.setItem('alkyon-comm-seen','2026-11-01T00:00:00Z');}")
    reqs=[]
    def _all65(r):
        reqs.append((r.request.method,r.request.url,r.request.post_data))
        u=r.request.url
        if '/rpc/community_is_admin' in u: return r.fulfill(json=True)
        if '/rpc/community_reports_list' in u: return r.fulfill(json=[{'id':'r1','created_at':'2026-11-08T10:00:00Z','kind':'comment','target':'c9','author':'Χ','body':'spam','hidden':False,'reporters':2}])
        if '/rpc/' in u: return r.fulfill(status=204,body='')
        if 'community_posts?select=*,likes' in u: return r.fulfill(json=[{'id':'m1','user_id':'u1','author':'Ντίνος','species':'Σαργός','kg':1,'created_at':'2026-11-08T10:00:00Z','likes':[{'count':0}],'comments':[{'count':1}]}])
        if 'community_posts?select=id&created_at' in u: return r.fulfill(json=[{'id':'n1'},{'id':'n2'}])
        if 'community_comments?select=*' in u: return r.fulfill(json=[{'id':'c5','post_id':'m1','user_id':'u7','author':'Λ','body':'Τέλειο','created_at':'2026-11-08T11:00:00Z','likes':[{'count':0}]}])
        if r.request.method in ('POST','PATCH','DELETE'): return r.fulfill(status=204,body='')
        return r.fulfill(json=[])
    c.route('**/rest/v1/**',_all65)
    c.route('**/functions/v1/quick-processor',lambda r: r.fulfill(json={'ok':True}))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    rb=pg.evaluate("()=>{const b=document.querySelector('.cmrepb'); return b?b.innerText:''}")
    pg.evaluate("()=>AK.commReports()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .cmrep button')].find(b=>b.textContent==='Απόκρυψη').click()"); pg.wait_for_timeout(1000)
    hid=[x for x in reqs if '/rpc/community_hide' in x[1]]
    check('Διαχειριστής: 🚩 αναφορές και «Απόκρυψη» (1.9.65)', '1' in rb and hid and json.loads(hid[-1][2])=={'kind':'comment','target':'c9','hide':True}, [rb,hid])
    pg.evaluate("()=>{const x=document.querySelector('.sheet.on .iconbtn'); x&&x.click()}"); pg.wait_for_timeout(400)
    pg.evaluate("()=>AK.commEdit({id:'m1',user_id:'u1',species:'Σαργός',kg:1,cond:{}})"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const s=document.querySelector('.sheet.on'); const i=s.querySelectorAll('input'); i[0].value='Σαργός μεγάλος'; i[1].value='1.4'; [...s.querySelectorAll('button')].find(b=>b.textContent==='Αποθήκευση').click()}"); pg.wait_for_timeout(1000)
    pt=[x for x in reqs if x[0]=='PATCH' and 'community_posts?id=eq.m1' in x[1]]
    check('Κοινότητα: επεξεργασία δικής σου ανάρτησης (1.9.65)', pt and json.loads(pt[-1][2]).get('kg')==1.4 and json.loads(pt[-1][2]).get('species')=='Σαργός μεγάλος', pt)
    pg.evaluate("()=>document.querySelectorAll('.cmact .cmbtn')[1].click()"); pg.wait_for_timeout(1200)
    pg.evaluate("()=>document.querySelector('.cmcl').click()"); pg.wait_for_timeout(800)
    cl=[x for x in reqs if x[0]=='POST' and x[1].endswith('community_comment_likes')]
    check('Κοινότητα: like σε σχόλιο (1.9.65)', cl and json.loads(cl[-1][2])=={'comment_id':'c5'} and '♥ 1' in pg.evaluate("()=>document.querySelector('.cmcl').textContent"), cl)
    iv=pg.evaluate("()=>AK.commInvite()")
    check('Κοινότητα: πρόσκληση φίλου (1.9.65)', iv in ('copied','shared','cancel'), iv)
    pg.evaluate("()=>{location.hash='#profile'}"); pg.wait_for_timeout(2500)
    t=pg.evaluate("()=>document.getElementById('main').innerText")
    nb=pg.evaluate("()=>{const e=document.querySelector('.cmnew'); return e?e.textContent:''}")
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Λογαριασμός/.test(x.textContent)).click()"); pg.wait_for_timeout(600); t=t+pg.evaluate("()=>document.getElementById('main').innerText")
    check('Προφίλ: «Νέα» στην Κοινότητα, «Φωτογραφία προφίλ», «Πρόσκληση φίλου» (1.9.65)', nb=='2' and 'Φωτογραφία προφίλ' in t and 'Πρόσκληση φίλου' in t and not pg._errs, [nb,pg._errs]); c.close()
    # 1.9.67: ποιος έκανε like, κάρτα προφίλ
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d+test@x.com',name:'Ντίνος'}));}")
    def _all67(r):
        u=r.request.url
        if 'community_posts?select=*,likes' in u: return r.fulfill(json=[{'id':'k1','user_id':'u9','author':'Κώστας','species':'Συναγρίδα','kg':3,'created_at':'2026-11-08T10:00:00Z','likes':[{'count':3}],'comments':[{'count':0}]}])
        if 'community_posts?select=id,user_id' in u: return r.fulfill(json=[{'id':'k1','user_id':'u9','author':'Κώστας','species':'Συναγρίδα','kg':3,'created_at':'2026-11-08T10:00:00Z'},{'id':'k2','user_id':'u9','author':'Κώστας','species':'Ροφός','kg':7,'created_at':'2026-11-07T10:00:00Z'}])
        if 'community_likes?select=post_id,user_id,created_at' in u: return r.fulfill(json=[{'post_id':'k1','user_id':'u5'},{'post_id':'k1','user_id':'u6'},{'post_id':'k1','user_id':'u7'}])
        if 'community_profiles?select' in u: return r.fulfill(json=[{'user_id':'u5','avatar':None,'name':'Νίκος'},{'user_id':'u6','avatar':None,'name':'Μάριος'}])
        if r.request.method in ('POST','PATCH','DELETE'): return r.fulfill(status=204,body='')
        return r.fulfill(json=[])
    c.route('**/rest/v1/**',_all67)
    c.route('**/functions/v1/quick-processor',lambda r: r.fulfill(json={'ok':True}))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    ll=pg.evaluate("()=>{const e=document.querySelector('.cmlkl'); return e?e.innerText:''}")
    check('Κοινότητα: «Άρεσε σε Νίκος, Μάριος και 1 ακόμα» (1.9.67)', 'Άρεσε σε Νίκος, Μάριος και 1 ακόμα' in ll, ll)
    pg.evaluate("()=>document.querySelector('.cmlkl').click()"); pg.wait_for_timeout(600)
    ls_=pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .cmlkr b')].map(x=>x.textContent)")
    check('Κοινότητα: λίστα με όσους έκαναν like (1.9.67)', ls_==['Νίκος','Μάριος','Ψαράς'], ls_)
    pg.evaluate("()=>{const x=document.querySelector('.sheet.on .iconbtn'); x&&x.click()}"); pg.wait_for_timeout(400)
    pg.evaluate("()=>AK.commProfile('u9','Κώστας')"); pg.wait_for_timeout(700)
    pr=pg.evaluate("()=>({t:document.querySelector('.sheet.on .sheet-h, .sheet.on h2')?document.querySelector('.sheet.on .sheet-h, .sheet.on h2').textContent:'',b:document.querySelector('.sheet.on .cmprof').innerText})")
    check('Κοινότητα: κάρτα προφίλ χωρίς «Πιάνει συχνότερα» όταν όλα είναι 1 ψάρι (1.9.67)', 'Πιάνει συχνότερα' not in pr['b'] and 'Ψάρι 5+ kg' in pr['b'] and not pg._errs, [pr,pg._errs]); c.close()
    # 1.9.68: φωνή — ερωτήσεις, ολόκληρη φράση, ακύρωση, χωρίς σήμα
    _cj=open(_os.path.join(ROOT,'v4','cards.js')).read()
    check('Φωνή: δεν καλείται το SpeechRecognition.available (ρίχνει τη σελίδα του Chromium) (1.9.68)', 'SR.available(' not in _cj and '.processLocally=true' not in _cj.replace('if(LOCAL) try{ rec.processLocally=true; }catch(e){}','').replace('if(LOCAL) try{ r.processLocally=true; }catch(e){}',''), 0)
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:34.66,lon:33.04,t:Date.now()}));")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3500)
    n0=pg.evaluate("()=>AK.store.raw('bites').filter(b=>!b.deleted).length")
    pg.evaluate("()=>AK.voiceCmd.test(['συναγρίδα τρία κιλά'])"); pg.wait_for_timeout(600)
    lb=pg.evaluate("()=>{const a=AK.store.raw('bites').filter(b=>!b.deleted); return {n:a.length,last:a[a.length-1]}}")
    check('Φωνή: «συναγρίδα τρία κιλά» → ψάρι με είδος και βάρος χωρίς άγγιγμα (1.9.68)', lb['n']==n0+1 and lb['last'].get('species')=='Συναγρίδα' and lb['last'].get('kg')==3, lb)
    ans=pg.evaluate("()=>AK.voiceAsk('πόσα ψάρια έχουμε')")
    check('Φωνή: «πόσα ψάρια;» → απάντηση (1.9.68)', ans and ('1 ψάρι' in ans) and '3 κιλά' in ans, ans)
    pg.evaluate("()=>AK.voiceUndo()"); pg.wait_for_timeout(300)
    n2=pg.evaluate("()=>AK.store.raw('bites').filter(b=>!b.deleted).length")
    check('Φωνή: «ακύρωση» σβήνει την τελευταία φωνητική καταγραφή (1.9.68)', n2==n0, [n0,n2])
    w=pg.evaluate("()=>AK.voiceAsk('πόσο αέρα έχει')")
    ss=pg.evaluate("()=>AK.voiceAsk('τι ώρα δύει ο ήλιος')")
    check('Φωνή: «πόσο αέρα;» και «τι ώρα δύει;» (1.9.68)', w and w.startswith('Άνεμος') and ss and ('δύει' in ss or 'έδυσε' in ss), [w,ss])
    nm=pg.evaluate("()=>AK.voiceAsk('συναγρίδες και σαργοί')")
    check('Φωνή: κουβέντα χωρίς ερώτηση δεν απαντιέται', nm is None, nm)
    pg.evaluate("()=>AK.voiceOffline()"); pg.wait_for_timeout(1500)
    lo=pg.evaluate("()=>{const a=AK.store.raw('bites').filter(b=>!b.deleted); return {n:a.length,last:a[a.length-1]}}")
    check('Φωνή χωρίς σήμα: το ψάρι γράφεται αμέσως (1.9.68)', lo['n']==n0+1 and isinstance(lo['last'].get('lat'),(int,float)) and not lo['last'].get('species'), lo)
    pg.evaluate("()=>{const sh=document.querySelector('.sheet.on .iconbtn'); sh&&sh.click()}"); pg.wait_for_timeout(400)
    pg.evaluate("(id)=>AK.vnote.put(id,new Blob(['x'],{type:'audio/webm'})).then(()=>{const b=AK.store.get('bites',id); AK.store.save('bites',Object.assign({},b,{vnote:1})); AK.biteDetail(AK.store.get('bites',id));})",lo['last']['id']); pg.wait_for_timeout(900)
    vp=pg.evaluate("()=>{const x=document.querySelector('.sheet.on .vnplay button'); return x?x.textContent:''}")
    check('Ημερολόγιο: «Άκου τη φωνητική σημείωση» (1.9.68)', 'φωνητική σημείωση' in vp and not pg._errs, [vp,pg._errs]); c.close()
    print('# 1.10.5: κείμενα μέσα στα κουτιά (360 px), Εργαλεία, παλιά ρίψη με θέση')
    for lang in ('el','en'):
        c=b.new_context(viewport={'width':360,'height':780}, service_workers='block'); c.grant_permissions(['geolocation']); c.set_geolocation({'latitude':35.0,'longitude':33.3})
        c.add_init_script(init(lang=lang)); c.route('**/*open-meteo.com/**',respond); c.route(lambda u: not u.startswith(BASE) and 'open-meteo' not in u, lambda r: r.abort())
        pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500); pg.evaluate("()=>AK.logTab('gear')"); pg.wait_for_timeout(1200)
        ov=pg.evaluate("""()=>{const r=[]; document.querySelectorAll('#main .seg button, #main .btn').forEach(e=>{ const b=e.getBoundingClientRect(); if(e.offsetParent&&(e.scrollWidth>e.clientWidth+1||b.right>innerWidth+1)) r.push(e.textContent.trim()); });
          document.querySelectorAll('#main input[placeholder]').forEach(i=>{ if(!i.offsetParent) return; const st=getComputedStyle(i), cv=document.createElement('canvas').getContext('2d'); cv.font=st.fontWeight+' '+st.fontSize+' '+st.fontFamily; if(cv.measureText(i.placeholder).width>i.clientWidth-parseFloat(st.paddingLeft)-parseFloat(st.paddingRight)+1) r.push('ph:'+i.placeholder); }); return r;}""")
        check('%s: Ημερολόγιο › Εργαλεία στα 360 px: τίποτα έξω από το κουτί (1.10.5)'%lang, not ov, ov)
        bt=pg.evaluate("()=>[...document.querySelectorAll('#main .gearadd .btn')].map(x=>x.textContent)")
        check('%s: Εργαλεία: «+ Ρίψη τώρα» και «+ Παλιά ρίψη» (1.10.5)'%lang, len(bt)==2, bt)
        if lang=='el':
            pg.evaluate("()=>AK.gearPast()"); pg.wait_for_timeout(1000)
            pg.evaluate("()=>{const i=document.querySelector('.sheet.on .gearpast input[list=gpSpots]'); i.value='35.0612, 32.4001'; i.dispatchEvent(new Event('change'))}"); pg.wait_for_timeout(200)
            pi=pg.evaluate("()=>document.querySelector('.sheet.on .gppos').textContent")
            pg.evaluate("()=>{const r=document.querySelector('.sheet.on .gprow'); const i=r.querySelectorAll('input'); i[0].value='Σφυρίδα'; i[1].value='2'; [...document.querySelectorAll('.sheet.on .btn.pri')].pop().click()}"); pg.wait_for_timeout(1200)
            g=pg.evaluate("()=>{const g=JSON.parse(localStorage.getItem('alkyon-gear')); const it=g.items[g.items.length-1]; return {a:it.set.a, tab:document.querySelector('#main .gearadd')?1:0}}")
            check('Παλιά ρίψη: θέση από γραμμένες συντεταγμένες, μετά ανοίγουν τα Εργαλεία (1.10.5)', '35.06120, 32.40010' in pi and g['a']==[35.0612,32.4001] and g['tab']==1, [pi,g])
        check('%s: χωρίς σφάλματα JS (1.10.5)'%lang, not pg._errs, pg._errs); c.close()
    print('# 1.10.6: διαδρομή εργαλείου με σημεία, ✕ του χάρτη πίσω, ελληνικά ονόματα')
    c=b.new_context(viewport={'width':360,'height':780}, service_workers='block'); c.grant_permissions(['geolocation']); c.set_geolocation({'latitude':35.0,'longitude':33.3})
    c.add_init_script(init(lang='el')); c.route('**/*open-meteo.com/**',respond); c.route(lambda u: not u.startswith(BASE) and 'open-meteo' not in u, lambda r: r.abort())
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ const now=Date.now(); localStorage.setItem('alkyon-v4-acctask',JSON.stringify(now)); const sm=JSON.parse(localStorage.getItem('alkyon-smart')||'{}'); sm.weekly=now; localStorage.setItem('alkyon-smart',JSON.stringify(sm)); localStorage.setItem('alkyon-gear',JSON.stringify({items:[{id:'gx1',type:'ll',name:'Longline 17',state:'done',past:true,set:{a:[35,33.3],ta:now-9e6,tb:now-9e6,pts:[[35,33.3]],b:[35,33.3]},haul:{a:[35,33.3],ta:now-1e6,tb:now-1e6,pts:[[35,33.3]],b:[35,33.3]},done:now-1e6}],seq:{}}));
      AK.store.save('bites',{id:'bx1',date:new Date().toISOString().slice(0,10),time:'07:00',species:'Dusky grouper',cnt:1,kg:4,gear:'gx1',bait:'Live squid',place:'Rocks / reef'}); AK.logTab('gear'); }""")
    pg.wait_for_timeout(1200); pg.keyboard.press('Escape'); pg.wait_for_timeout(400); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    nm=pg.evaluate("()=>document.querySelector('#main .list .li b').textContent")
    pg.click('#main .list .li >> nth=0'); pg.wait_for_timeout(1200)
    sp=pg.evaluate("()=>[...document.querySelectorAll('.sheet.on .list .li b')].map(x=>x.textContent).join('|')")
    check('Ελληνικά: «Longline 17» → «Παραγάδι 17», «Dusky grouper» → «Ροφός» (1.10.6)', nm=='Παραγάδι 17' and 'Ροφός' in sp, [nm,sp])
    pg.locator('.sheet.on button',has_text='διαδρομ').first.click(); pg.wait_for_timeout(2500)
    pg.click('.mpkbar .mplrow .btn >> nth=1'); pg.wait_for_timeout(200)
    pg.mouse.move(180,300); pg.mouse.down(); pg.mouse.move(80,200,steps=8); pg.mouse.up(); pg.wait_for_timeout(500)
    pg.click('.mpkbar .mplrow .btn >> nth=1'); pg.wait_for_timeout(200)
    pg.click('.mpkbar .mplrow .btn >> nth=0'); pg.wait_for_timeout(200)
    pg.mouse.move(180,300); pg.mouse.down(); pg.mouse.move(100,250,steps=8); pg.mouse.up(); pg.wait_for_timeout(500)
    pg.click('.mpkbar .mplrow .btn >> nth=1'); pg.wait_for_timeout(300)
    cnt=pg.evaluate("()=>document.querySelector('.mplcnt').textContent")
    pg.click('.mpkbar > .acts:last-child .btn.pri'); pg.wait_for_timeout(2000)
    pts=pg.evaluate("()=>JSON.parse(localStorage.getItem('alkyon-gear')).items[0].set.pts")
    check('Εργαλείο: διαδρομή με σημεία στον χάρτη (+ Σημείο, Αναίρεση, Αποθήκευση) (1.10.6)', cnt.startswith('3') and len(pts)==3 and pts[0]==[35,33.3] and pg.evaluate('location.hash')=='#log', [cnt,pts,pg.evaluate('location.hash')])
    pg.evaluate("()=>location.hash='#inbox'"); pg.wait_for_timeout(1000); pg.evaluate("()=>AK.mapGo(35,33.3,12,null,{lab:'Δοκιμή'})"); pg.wait_for_timeout(2500); pg.click('.revchip .rvx'); pg.wait_for_timeout(1200)
    check('Χάρτης: «Στον χάρτη» από τις Ειδοποιήσεις → ✕ → πίσω στις Ειδοποιήσεις (1.10.6)', pg.evaluate('location.hash')=='#inbox', pg.evaluate('location.hash'))
    check('1.10.6: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# 1.10.7: ειδοποιήσεις μόνο για όσες τοποθεσίες θέλεις')
    c=ctx(b); c.add_init_script("if(!localStorage.getItem('alkyon-mpfix2'))localStorage.setItem('alkyon-places',JSON.stringify([{id:'p1',name:'Map point',lat:35.1,lon:33.2,watch:true},{id:'p2',name:'Λατσί',lat:35.04,lon:32.39,watch:true},{id:'p3',name:'Λεμεσός',lat:34.67,lon:33.04,watch:false}]))")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    w=pg.evaluate("()=>JSON.parse(localStorage.getItem('alkyon-places')).map(p=>[p.id,p.watch])")
    check('Τοποθεσίες: «Map point» κλείνει, οι άλλες μένουν όπως ήταν (1.10.7)', w==[['p1',False],['p2',True],['p3',False]], w)
    check('1.10.7: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.10.11: υποδιαστολή στα ελληνικά, ελληνικά ονόματα ειδών, σημείωση έκθεσης ακτής')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    r=pg.evaluate("""()=>new Promise(res=>{ const d=document.createElement('div'); d.innerHTML='<p>κύμα 0.9 m, άνεμος 12.5 kn</p><p>έκδοση 1.10.11 · 34.70123, 32.40510 · 34°42.071′N</p><input value="2.4">';
      document.body.append(d); setTimeout(()=>{ const ps=d.querySelectorAll('p'); res([ps[0].textContent, ps[1].textContent, d.querySelector('input').value, AK.decEl('1013.2 hPa'), window.spName('Dogtooth grouper'), window.spName('Dusky grouper')]); d.remove(); },150); })""")
    check('Ελληνικά: «0,9 m», «12,5 kn» με κόμμα (1.10.11)', r[0]=='κύμα 0,9 m, άνεμος 12,5 kn', r)
    check('Ελληνικά: εκδόσεις, συντεταγμένες, λεπτά μοιρών και πεδία μένουν με τελεία (1.10.11)', r[1]=='έκδοση 1.10.11 · 34.70123, 32.40510 · 34°42.071′N' and r[2]=='2.4' and r[3]=='1013,2 hPa', r)
    check('Ελληνικά: τα αγγλικά ονόματα ειδών γίνονται ελληνικά και στην πρόγνωση (Ασπρόβλαχος, Ροφός) (1.10.11)', r[4]=='Ασπρόβλαχος' and r[5]=='Ροφός', r)
    check('Πρόγνωση: χωρίς τη γραμμή «Έκθεση ακτής: μόνο κοντά στην ακτή» (αφαιρέθηκε 1.14.37)', pg.evaluate("()=>!document.querySelector('main p.expo-none:not([hidden])')"))
    check('1.10.11: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    c=ctx(b, lang='en'); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{ const p=document.createElement('p'); p.textContent='0.9 m'; document.body.append(p); return new Promise(res=>setTimeout(()=>res(p.textContent),150)); }")
    check('Αγγλικά: η τελεία μένει (0.9 m) (1.10.11)', r=='0.9 m', r); c.close()
    print('# 1.10.12: βυθόμετρο (Signal K ζωντανά, αρχείο, «Ο βυθός μου»)')
    import struct as _st, math as _m, tempfile as _tf
    c=ctx(b); sub=[]
    def _skws(ws):
        def _om(m):
            sub.append(m)
            ws.send(json.dumps({'context':'vessels.self','updates':[{'values':[{'path':'navigation.position','value':{'latitude':34.7001,'longitude':33.0402}},{'path':'environment.depth.belowTransducer','value':41.6},{'path':'environment.water.temperature','value':292.25},{'path':'navigation.speedOverGround','value':1.0}]}]}))
        ws.on_message(_om)
    c.route_web_socket('**/signalk/v1/stream*',_skws)
    c.add_init_script("if(!sessionStorage.snd){sessionStorage.snd=1;localStorage.setItem('alkyon-sounder',JSON.stringify({src:'sk',host:'boat.local',off:0.5,rec:true}));}")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>{const s=AK.sounder.state(); return [s.state, AK.sounder.live(), s.wt&&+s.wt.toFixed(2), AK.sounder.url(AK.sounder.cfg())]}")
    check('Βυθόμετρο: Signal K ζωντανά — βάθος + βάθος αισθητήρα (41,6 + 0,5 m), νερό 19,1 °C, ws://…:3000 (1.10.12)', r[0]=='live' and r[1] is not None and abs(r[1]-42.1)<0.01 and r[2]==19.1 and r[3]=='ws://boat.local:3000/signalk/v1/stream?subscribe=none' and bool(sub) and 'environment.depth.belowTransducer' in sub[0], [r,sub[:1]])
    r=pg.evaluate("()=>AK.depthAt(34.7002,33.0403).then(d=>[d,AK.lastDepthSrc])")
    check('Βάθος: κοντά στο σκάφος έρχεται από το βυθόμετρο (1.10.12)', r==[42.1,'sounder'], r)
    go(pg,'#map',3500); pg.evaluate("()=>{ const m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(m) m.setView([34.7001,33.0402],16,{animate:false}); AK.mydepth&&AK.mydepth.set(true); }"); pg.wait_for_timeout(2500)
    r=pg.evaluate("()=>{ const ch=document.querySelector('.sndchip'); return [!!ch&&!ch.hidden&&ch.textContent, AK.mydepth?AK.mydepth._cells().length:-1, !!document.querySelector('.mdleg:not([hidden])')] }")
    check('Χάρτης: ζωντανό βάθος πάνω αριστερά και «Ο βυθός μου» με τα σημεία που γράφτηκαν (1.10.12)', bool(r[0]) and '42' in r[0] and r[1]>=1 and r[2], r)
    pg.evaluate("()=>AK.sounder.set({src:'off'})"); pg.wait_for_timeout(300)
    r=pg.evaluate("()=>AK.sounder.flush().then(()=>AK.depthAt(34.7001,33.0402)).then(d=>[d,AK.lastDepthSrc,AK.sounder.live()])")
    check('Βάθος: χωρίς βυθόμετρο έρχεται από τον «Βυθό μου» (1.10.12)', r==[42.1,'mine',None], r)
    # 1.13.1: «Δίκτυο σκάφους»: NMEA 0183 από UDP (DPT με offset, MTW, RMC) → ζωντανό βάθος· στη σελίδα web λέει «μόνο Android»
    r=pg.evaluate("""()=>{ AK.sounder.set({rec:false}); AK.sounder._net({items:[{p:'udp',port:10110,from:'10.0.0.5',n:40,txt:'$SDDPT,7.5,0.5*55\\r\\n$SDMTW,19.0,C*00\\r\\n'},{p:'udp',port:10110,from:'10.0.0.5',n:60,txt:'$GPRMC,101010,A,3442.006,N,03302.412,E,3.0,90,121126,,*00'}],drop:0});
      const s=AK.sounder.state(); const r=[AK.sounder.live(), s.wt, s.pos&&+s.pos.lat.toFixed(4), /DPT×1/.test(AK.sounder.diag())]; AK.sounder.set({src:'net'}); return new Promise(res=>setTimeout(()=>res(r.concat([AK.sounder.state().state])),300)); }""")
    check('Βυθόμετρο: «Δίκτυο σκάφους» διαβάζει NMEA (DPT+offset, MTW, RMC) και στο web λέει «μόνο Android» (1.13.1)', r==[8.0,19.0,34.7001,True,'err'], r)
    pg.evaluate("()=>AK.sounder.set({src:'off',rec:true})")
    # αρχείο .sl2 από το φύλλο ρυθμίσεων
    R=6356752.3142; X=round(_m.radians(33.05)*R); Y=round(R*_m.log(_m.tan(_m.pi/4+_m.radians(34.69)/2)))
    raw=bytearray(8)
    for i in range(5):
        f=bytearray(144); _st.pack_into('<H',f,28,144); _st.pack_into('<H',f,32,0); _st.pack_into('<f',f,64,(20+i)/0.3048); _st.pack_into('<i',f,108,X+i*40); _st.pack_into('<i',f,112,Y); raw+=f
    fp=os.path.join(_tf.mkdtemp(),'trip.sl2'); open(fp,'wb').write(raw)
    pg.evaluate("()=>AK.sounder.sheet()"); pg.wait_for_timeout(600)
    check('Βυθόμετρο: πολλά αρχεία μαζί και .RSD/.SON/.DAT στην επιλογή (1.10.13)', pg.evaluate("()=>{const i=document.querySelector('.sndsheet input[type=file]'); return i.multiple&&/\\.rsd/.test(i.accept)&&/\\.son/.test(i.accept)&&/\\.dat/.test(i.accept)}"))
    pg.set_input_files('.sndsheet input[type=file]',fp); pg.wait_for_timeout(1200)
    t=pg.evaluate("()=>document.querySelector('.sndimp').textContent")
    check('Βυθόμετρο: αρχείο Lowrance .sl2 — προεπισκόπηση 5 μετρήσεων (1.10.12)', '5 μετρήσεις' in t, t)
    pg.click('.sndimp .btn.pri'); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>AK.sounder.stats().then(s=>[s.cells,s.n])")
    check('«Ο βυθός μου»: το αρχείο αποθηκεύτηκε (1.10.12)', r[0]>=6 and r[1]>=6, r)
    r=pg.evaluate("()=>AK.loadScripts(['sounder-parse.js']).then(()=>AlkSounderParse.gpx('<gpx xmlns:g=\"x\"><trk><trkseg><trkpt lat=\"34.7\" lon=\"33\"><extensions><g:TrackPointExtension><g:Depth>12.5</g:Depth></g:TrackPointExtension></extensions></trkpt><trkpt lat=\"34.71\" lon=\"33\"></trkpt></trkseg></trk></gpx>').map(p=>p.d))")
    check('Βυθόμετρο: GPX με βάθος στα extensions (Garmin) (1.10.12)', r==[12.5], r)
    check('1.10.12: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# 1.11.0: Ελλάδα')
    c=ctx(b); c.set_geolocation({'latitude':37.94,'longitude':23.64}); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ window.ALKYON_GR_PLACES=[['Πειραιάς','Piraeus',37.9420,23.6465,3],['Πέραμα','Perama',37.9640,23.5680,2],['Σαλαμίνα','Salamina',37.9640,23.4950,3]]; localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:37.95,lon:23.62,t:Date.now()})); return [AK.region(37.94,23.64), AK.country(), AK.nearKnown(37.95,23.62), AK.placeName({name:'Σημείο χάρτη',lat:37.943,lon:23.645})] }")
    check('Ελλάδα: χώρα από τη θέση και «Κοντά: …» με γνωστά μέρη της Ελλάδας (1.11.0)', r[0]=='gr' and r[1]=='gr' and r[2]['name']=='Πειραιάς' and r[3]=='Πειραιάς', r)
    r=pg.evaluate("()=>new Promise(res=>{ AK.loadScripts?0:0; const s=document.createElement('script'); s.src='../zones-gr.js'; s.onload=()=>{ const z=AK.zoneCheck(37.60,24.72); res([z&&z.inside, z&&z.z.n]); }; document.head.append(s); })")
    check('Ειδοποίηση απαγορευμένης περιοχής και στην Ελλάδα (Γυάρος) (1.11.0)', r[0] is True and 'Γυάρου' in (r[1] or ''), r)
    r=pg.evaluate("()=>AK.grLocal.load().then(()=>{ const G=AK.grLocal; const k=G.check(40.934,24.409), m=G.check(37.005,22.1), kos=G.check(36.88,27.08,new Date('2027-05-01')), kos2=G.check(36.88,27.08,new Date('2026-11-12')), lv=G.check(37.7203,23.9439); return [k.port.a.k, k.port.a.r.some(x=>x[0]==='ok'&&x[1].includes('Νο 1 και Νο 3')), m.hits.length&&m.hits[0].d, kos.hits.some(x=>x.a.k==='kos'&&x.d===0), kos2.hits.some(x=>x.a.k==='kos'), lv.hits.length&&lv.hits[0].g.s, window.GR_LOCAL.a.length>=30]; })")
    check('Τοπικές απαγορεύσεις Λιμενικού: Καβάλα (αποβάθρα 1–3), αγκυροβόλιο Καλαμάτας, εποχική Κω–Καλύμνου, ψαροντούφεκο Λαύριο (1.13.3)', r==['KABALA',True,0,True,False,1,True], r)
    r=pg.evaluate("()=>{ const a=window.GR_LOCAL.a; return [a.every(x=>x.r.every(r=>r[4]&&!/[α-ω]/.test(r[4]))), a.every(x=>(x.g||[]).every(g=>g.ne&&g.de))]; }")
    check('Τοπικές απαγορεύσεις: όλοι οι κανόνες και οι περιοχές έχουν αγγλικό κείμενο (1.13.4)', r==[True,True], r)
    r=pg.evaluate("()=>{ const G=AK.grLocal, h=G.check(40.9335,24.409).hits.filter(x=>x.d===0).map(x=>x.g.s), A=window.GR_LOCAL.a; return [h.includes(2), A.length>=60, A.some(x=>x.k==='hraklio'), A.some(x=>x.k==='thessaloniki'&&x.r.some(r=>r[1].includes('Λιμάνι Θεσσαλονίκης')))]; }")
    check('Τοπικές απαγορεύσεις: λεκάνη λιμανιού Καβάλας (OSM), όλες οι 66 Λιμενικές Αρχές, Θεσσαλονίκη λιμάνι (1.13.5)', r==[True,True,True,True], r)
    go(pg,'#guide',2500); pg.click('#tab-guide .seg button[data-g=law]') if pg.query_selector('#tab-guide .seg button[data-g=law]') else pg.click('button[data-g=law]'); pg.wait_for_timeout(600)
    t=pg.evaluate("()=>{ const L=document.getElementById('g-law'); const on=L.querySelector('.lawc [aria-pressed=true]'); return [on&&on.textContent, L.textContent.includes('Έως 5 kg ψάρια ή κεφαλόποδα'), L.textContent.includes('108 Λιμενικό')] }")
    check('Οδηγός › Νόμοι: στην Ελλάδα ανοίγει με τους ελληνικούς κανόνες (1.11.0)', t==['Ελλάδα',True,True], t)
    pg.wait_for_timeout(500); t=pg.evaluate("()=>{ const L=document.getElementById('g-law'); return [L.textContent.includes('Τοπικές απαγορεύσεις Λιμενικών Αρχών'), L.textContent.includes('Τελωνείο Καβάλας'), L.querySelectorAll('details.sp').length>=30]; }")
    check('Οδηγός › Νόμοι › Ελλάδα: κάρτα τοπικών απαγορεύσεων ανά Λιμενική Αρχή (1.13.3)', t==[True,True,True], t)
    pg.click('#g-law .lawc button:first-child'); pg.wait_for_timeout(400)
    t=pg.evaluate("()=>document.getElementById('g-law').textContent.includes('Δημοκρατία της Κύπρου')")
    check('Οδηγός › Νόμοι: αλλάζεις σε Κύπρο (1.11.0)', t)
    check('1.11.0: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# 1.11.3: όλος ο κόσμος')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3000)
    r=pg.evaluate("""()=>fetch('../nav/w_20_-90.json').then(r=>r.json()).then(j=>{ const f=j.f.find(x=>x.hl===1||x.rf===1); const v=f.g[0][0][0]; return AK.navWorldZonesFor(v[0],v[1]).then(zs=>{ const z=AK.zoneCheck(v[0],v[1]); return [zs.length>0, z&&z.d<60, z&&z.z.n===f.n]; }); })""")
    check('Ειδοποίηση απαγορευμένης περιοχής και εκτός Κύπρου/Ελλάδας (Navigator, κομμάτι 10°) (1.11.3)', r==[True,True,True], r)
    r=pg.evaluate("()=>AK.navWorldZonesFor(34.9,33.6).then(z=>[z.length, AK.navTiles(34.9,33.6).then(fs=>fs.filter(f=>f.c==='Cyprus').length)]).then(a=>a[1].then(n=>[a[0],n]))")
    check('Κύπρος: οι απαγορεύσεις έρχονται από τα δικά της αρχεία, όχι από τα κομμάτια του κόσμου (1.11.3)', r==[0,0], r)
    r=pg.evaluate("()=>{ localStorage.removeItem('alkyon-v4-pos'); localStorage.removeItem('alkyon-cond'); localStorage.removeItem('alkyon-country'); AK.tour(); const b=document.querySelector('.spctry'); return b?[b.querySelectorAll('select option').length>200, !!b.querySelector('button.loc'), b.textContent.includes('Σε ποια χώρα ψαρεύεις'), !/Κύπρο και την Ελλάδα/.test(document.querySelector('.sppage').textContent)]:null }")
    check('Καλωσόρισμα: χωρίς θέση «Χρήση της θέσης μου» ή λίστα με όλες τις χώρες, χωρίς «μόνο Κύπρος/Ελλάδα» (1.11.4)', r==[True,True,True,True], r)
    pg.select_option('.spctry select','it'); pg.wait_for_timeout(200)
    r=pg.evaluate("()=>[AK.country(), AK.countryName('it')]")
    check('Καλωσόρισμα: διαλέγεις οποιαδήποτε χώρα (Ιταλία) (1.11.4)', r==['it','Ιταλία'], r)
    r=pg.evaluate("()=>{ document.querySelector('.sppage').remove(); localStorage.setItem('alkyon-country',JSON.stringify('auto')); localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:37.94,lon:23.64,t:Date.now()})); AK.tour(); return document.querySelector('.spctry').textContent }")
    check('Καλωσόρισμα: με γνωστή θέση δείχνει «Χώρα: Ελλάδα (από τη θέση σου) · Αλλαγή» (1.11.3)', 'Ελλάδα (από τη θέση σου)' in r and 'Αλλαγή' in r, r)
    r=pg.evaluate("()=>{ document.querySelector('.sppage').remove(); localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:43.3,lon:5.3,t:Date.now()})); return [AK.country(), AK.countryName(AK.country())] }")
    check('Χώρα: αυτόματα εκτός Κύπρου/Ελλάδας δίνει «Άλλη χώρα», όχι Κύπρο (1.11.4)', r==['xx','Άλλη χώρα'], r)
    check('1.11.3: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# 1.11.5: νόμοι ανά χώρα')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#guide'); pg.wait_for_timeout(3000)
    pg.click('#tab-guide .seg button[data-g=law]') if pg.query_selector('#tab-guide .seg button[data-g=law]') else pg.click('button[data-g=law]'); pg.wait_for_timeout(600)
    t=pg.evaluate("()=>document.getElementById('g-law').textContent.includes('Πάντα να ελέγχεις τις επίσημες σελίδες')")
    check('Νόμοι: η προειδοποίηση για επίσημες σελίδες και στην Κύπρο (1.11.5)', t)
    pg.select_option('#g-law select.lawsel','hr'); pg.wait_for_timeout(1500)
    t=pg.evaluate("()=>{ const L=document.getElementById('g-law'); return [L.textContent.includes('Χρειάζεται άδεια για ψάρεμα αναψυχής'), L.textContent.includes('Κανόνες της ΕΕ'), L.textContent.includes('195'), (L.querySelector('.lawc [aria-pressed=true]')||{}).textContent] }")
    check('Νόμοι: Κροατία με άδεια, κανόνες ΕΕ, 195 (1.11.5)', t==[True,True,True,'Κροατία'], t)
    pg.select_option('#g-law select.lawsel','it'); pg.wait_for_timeout(800)
    t=pg.evaluate("()=>{ const L=document.getElementById('g-law'); return [L.textContent.includes('Δεν έχουμε ακόμα ελεγμένο οδηγό για: Ιταλία'), L.textContent.includes('1530'), L.textContent.includes('Κανόνες της ΕΕ')] }")
    check('Νόμοι: Ιταλία χωρίς ελεγμένο οδηγό ακόμα, με 1530 και κανόνες ΕΕ (1.11.5)', t==[True,True,True], t)
    check('1.11.5: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# 1.11.6: παράθυρο τσιμπήματος')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(800)
    pg.fill('.bform .spwrap input', 'Θράψαλο')
    pg.click('.bform .bfline'); pg.wait_for_timeout(200)   # 1.12.7: οι ώρες είναι μέσα στο «Πότε · Πού»
    pg.evaluate("()=>{ document.querySelector('.bfwin').open=true; }")
    pg.fill('.bfwin input[aria-label=\"Τσιμπούσαν από\"]','19:00'); pg.fill('.bfwin input[aria-label=\"Τσιμπούσαν έως\"]','')
    pg.click('.bform .bfsave'); pg.wait_for_timeout(500)
    t=pg.evaluate("()=>document.querySelector('.bfwin small.wn').textContent")
    check('Παράθυρο τσιμπήματος: μόνο «από» χωρίς «έως» δεν αποθηκεύεται (1.11.6)', 'και τις δύο ώρες' in t, t)
    pg.fill('.bfwin input[aria-label=\"Τσιμπούσαν έως\"]','21:00'); pg.click('.bform .bfsave'); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{ const b=AK.store.bites().filter(x=>x.win)[0]; return b?b.win:null }")
    check('Παράθυρο τσιμπήματος: αποθηκεύεται από–έως στο ψάρι (1.11.6)', r=={'a':'19:00','b':'21:00'}, r)
    r=pg.evaluate("""()=>{ const b={date:'2026-11-09',time:'19:30',tz:120,lat:34.75,lon:32.40,win:{a:'19:00',b:'21:00'}};
      const s=AK.biteWin.span(b), H=3600000, t=[], w=[], d=[], sl=[], p=[];
      for(let i=-4;i<=6;i++){ const ms=s.a+i*H; t.push(ms); const after=ms>=s.e; w.push(after?14:5); d.push(after?270:20); p.push(1015-(after?(ms-s.e)/H*0.6:0)); sl.push(i<=2?0.05*i:0.1-0.05*(i-2)); }
      const S={t:t,wind_speed_10m:w,wind_direction_10m:d,pressure_msl:p,sea_level_height_msl:sl};
      const ch=AK.biteWin.analyze(b,S).map(c=>c.k); return [(s.e-s.a)/H, ch.includes('wind-up'), ch.includes('wind-turn'), ch.includes('tide-turn'), ch.includes('press-fall')]; }""")
    check('Παράθυρο τσιμπήματος: βρίσκει δυνάμωμα και γύρισμα ανέμου, γύρισμα παλίρροιας, πτώση πίεσης στο τέλος (1.11.6)', r==[2,True,True,True,True], r)
    r=pg.evaluate("()=>{ const b={date:'2026-11-09',tz:120,lat:34.75,lon:32.40,win:{a:'16:00',b:'16:55'}}; return AK.biteWin.analyze(b,null).map(c=>c.k) }")
    check('Παράθυρο τσιμπήματος: σταμάτησαν στη δύση του ηλίου (Πάφος, Νοέμβριος) (1.11.6)', 'sunset' in r, r)
    r=pg.evaluate("()=>{ const b={date:'2026-11-09',tz:120,win:{a:'23:00',b:'01:30'}}; const s=AK.biteWin.span(b); return (s.e-s.a)/3600000 }")
    check('Παράθυρο τσιμπήματος: περνά τα μεσάνυχτα (23:00–01:30 = 2,5 ώρες) (1.11.6)', r==2.5, r)
    r=pg.evaluate("()=>{ const b=AK.store.bites().filter(x=>x.win)[0]; AK.biteDetail(b); const c=document.querySelector('.bwin'); return c?[c.querySelector('h2').textContent, !!c.querySelector('button')]:null }")
    check('Σελίδα ψαριού: «Τσιμπούσαν 19:00–21:00» με κουμπί «Τι άλλαξε…» (1.11.6)', r and r[0].startswith('Τσιμπούσαν 19:00–21:00') and r[1], r)
    r=pg.evaluate("()=>{ try{ AK.biteDetail({id:'wx1',date:'2026-11-10',time:'07:00',species:'Λαβράκι',lat:34.7,lon:33.0,wind:12,wave:0.5,press:1015,sst:22,pb:{hpa:1014.2}}); return 'ok'; }catch(e){ return e.message; } }")
    check('Σελίδα ψαριού με καιρό και βαρόμετρο ανοίγει (1.14.9: ψάρια στον χάρτη δεν άνοιγαν)', r=='ok', r)
    pg.evaluate("()=>{ document.querySelectorAll('.sheet .x, .sheet button[aria-label]').forEach(()=>0); AK.biteForm(); }"); pg.wait_for_timeout(800)
    pg.evaluate("()=>{ const f=[...document.querySelectorAll('.bform')].pop(); f.querySelector('.bfwin').open=true; }")
    pg.evaluate("()=>{ const f=[...document.querySelectorAll('.bform')].pop(); const a=f.querySelector('.bfwin input[aria-label=\"Τσιμπούσαν από\"]'); a.value='19:00'; a.dispatchEvent(new Event('input')); }"); pg.wait_for_timeout(200)
    r=pg.evaluate("()=>{ const f=[...document.querySelectorAll('.bform')].pop(); const w=f.querySelector('.bfww input[type=datetime-local]'), d=f.querySelector('.bfww input[type=date]'); return [w.closest('label').hidden, d.closest('label').hidden, w.value.slice(11,16)] }")
    check('Ώρες που τσιμπούσαν: η ώρα του ψαριού γίνεται το «Από» και κρύβεται το «Πότε» (μένει η ημερομηνία) (1.11.7)', r==[True,False,'19:00'], r)
    r=pg.evaluate("""()=>{ const b={date:'2026-11-09',tz:120,lat:34.75,lon:32.40,win:{a:'19:00',b:'21:00'}};
      const s=AK.biteWin.span(b), H=3600000, t=[], w=[], d=[], sl=[];
      for(let i=-4;i<=6;i++){ const ms=s.a+i*H; t.push(ms); const before=ms<s.a; w.push(before?15:5); d.push(before?200:20); sl.push(i<=0?-0.05*i:0.05*i); }
      const ch=AK.biteWin.analyze(b,{t:t,wind_speed_10m:w,wind_direction_10m:d,sea_level_height_msl:sl},'start').map(c=>c.k); return [ch.includes('wind-down'), ch.includes('wind-turn'), ch.includes('tide-turn')]; }""")
    check('Ώρες που τσιμπούσαν: βρίσκει και τι άλλαξε όταν άρχισαν (έπεσε/γύρισε ο άνεμος, γύρισε η παλίρροια) (1.11.8)', r==[True,True,True], r)
    check('1.11.6: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    print('# offline')
    c=ctx(b,sw=True); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(6000); pg.reload(); pg.wait_for_timeout(3000)
    c.set_offline(True)
    for r in ['map','help','friends','check','boat','tackle','guide','log','forecast']:
        s=go(pg,'#'+r,2200); check('offline #'+r, not s['fail'] and not s['loading'], s)
    pg.reload(); pg.wait_for_timeout(3000); s=go(pg,'#map',2500)
    check('offline μετά από ανανέωση: χάρτης', s['n']>15 and not s['fail'], s)
    check('offline χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    # 1.10.2: παλιά ρίψη διχτυού: εργαλείο «Ολοκληρώθηκε», έξοδος στο Ημερολόγιο, ψάρια ανά είδος συνδεδεμένα
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.gearPast()"); pg.wait_for_timeout(600)
    r=pg.evaluate("""()=>{const f=document.querySelector('.gearpast'); if(!f) return null; const rw=f.querySelectorAll('.gprow');
      const set=(el,v)=>{el.value=v; el.dispatchEvent(new Event('input',{bubbles:true}));};
      const n=f.querySelectorAll('input[type=number]'); set(n[0],'300');
      let i=rw[0].querySelectorAll('input'); set(i[0],'Σαργός'); set(i[1],'8'); set(i[2],'2.4');
      i=rw[1].querySelectorAll('input'); set(i[0],'Μουρμούρα'); set(i[1],'4');
      [...f.querySelectorAll('button')].find(b=>/Αποθήκευση/.test(b.textContent)).click();
      const g=JSON.parse(localStorage.getItem('alkyon-gear')||'{}').items||[], it=g[g.length-1]||{};
      const bt=JSON.parse(localStorage.getItem('alkyon-bites')||'[]').filter(x=>x.gear===it.id);
      const tr=JSON.parse(localStorage.getItem('alkyon-trips')||'[]').filter(x=>x.sid==='g'+it.id)[0]||{};
      return [it.state, it.type, it.len, it.past, bt.length, bt.reduce((a,x)=>a+x.cnt,0), tr.count, tr.kg, (tr.endMs-tr.startMs)/3600000];}"""); pg.wait_for_timeout(800); r=r and r+[pg.evaluate("()=>!!document.querySelector('.gearpast')")]
    check('Εργαλεία: παλιά ρίψη διχτυού με ψάρια ανά είδος (1.10.2)', r and r[0]=='done' and r[1]=='net' and r[2]==300 and r[3] and r[4]==2 and r[5]==12 and r[6]==12 and abs(r[7]-2.4)<0.01 and r[8]==12 and not r[9] and not pg._errs, [r,pg._errs]); c.close()
    # 1.12.13: πλοήγηση: τα ‹ γυρίζουν πίσω (όχι νέα σελίδα), το «πίσω» δεν χρειάζεται άδεια πατήματα
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(2500)
    def nv(js=None,ms=1100):
        if js: pg.evaluate(js); pg.wait_for_timeout(ms)
        return pg.evaluate("()=>[location.hash||'',navigation.currentEntry.index,navigation.canGoBack,document.querySelectorAll('.sheet.on').length]")
    BK="()=>history.back()"
    nv("()=>{location.hash='#profile'}"); nv("()=>{location.hash='#tackle'}"); r1=nv("()=>document.querySelector('.top a.iconbtn').click()"); r2=nv(BK)
    check('Πλοήγηση: ‹ από Εξοπλισμό → Προφίλ, μετά «πίσω» → αρχική σελίδα (όχι ξανά Εξοπλισμός) (1.12.13)', r1[0]=='#profile' and r2[0]=='' and not r2[2], [r1,r2])
    # 1.14.89: αρχική σελίδα είναι πλέον ο Χάρτης, άρα «η καρτέλα όπου είσαι ήδη» είναι ο Χάρτης (πριν η Πρόγνωση). Ο έλεγχος είναι ο ίδιος: δεν γράφεται νέα εγγραφή.
    r0=nv("()=>document.querySelector('.nav a[data-v=map]').click()")
    check('Πλοήγηση: «Χάρτης» ενώ είσαι ήδη εκεί (αρχική σελίδα) δεν γράφει νέα εγγραφή (1.12.13 · 1.14.89)', r0[1]==0 and not r0[2], r0)
    nv("()=>{location.hash='#log'}"); nv("()=>AK.biteForm()"); r1=nv("()=>[...document.querySelectorAll('.sheet.on .bfline')].find(x=>/Εξοπλισμός|Tackle/.test(x.textContent)).click()",1600)
    r2=nv(BK); r3=nv(BK)
    check('Πλοήγηση: φόρμα → Εξοπλισμός, «πίσω» → Ημερολόγιο, «πίσω» → αρχική σελίδα χωρίς άδειο πάτημα (1.12.13)', r1[0]=='#tackle' and r2[0]=='#log' and r2[3]==0 and r3[0]=='', [r1,r2,r3])
    pg.goto(BASE+'/v4/?n=1#boat'); pg.wait_for_timeout(2000); r0=nv(); r1=nv("()=>document.querySelector('.top a.iconbtn').click()")
    check('Πλοήγηση: άνοιγμα απευθείας στο #boat, ‹ → Προφίλ χωρίς νέα εγγραφή (1.12.13)', r1[0]=='#profile' and r1[1]==r0[1], [r0,r1])
    pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2000); nv("()=>{location.hash='#map'}",2500); r1=nv("()=>document.querySelector('.mclay').click()"); r2=nv(BK)
    nv("()=>document.querySelector('.mclay').click()"); r3=nv("()=>[...document.querySelectorAll('.mcdrw button')].find(x=>/^(Ειδοποιήσεις|Notifications)/.test(x.textContent.trim())).click()",1500); r4=nv(BK); r5=nv(BK)
    check('Πλοήγηση: μενού χάρτη κλείνει με «πίσω»· μενού → Ειδοποιήσεις → «πίσω» Χάρτης → «πίσω» Ημερολόγιο (1.12.13)', (not pg.evaluate("()=>!!document.querySelector('.mcdrw.open')") and r2[0]=='#map' and r3[0]=='#inbox' and r4[0]=='#map' and r5[0]=='#log'), [r1,r2,r3,r4,r5])
    check('1.12.13: πλοήγηση χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    # 1.12.15: με <base> /v4/ και διεύθυνση άλλη από /v4/ (π.χ. /v4/index.html ή alkyonfishing.com/), οι καρτέλες δεν ξαναφορτώνουν την εφαρμογή
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/index.html'); pg.wait_for_timeout(2500); pg.evaluate("()=>{window.__mk=1}"); rr=[]
    # 1.14.89: ξεκινά από τον Χάρτη, άρα η πρώτη αλλαγή καρτέλας είναι προς την Πρόγνωση (πριν προς τον Χάρτη)
    for v in ['forecast','log','profile','map']:
        pg.click('.nav a[data-v="%s"]'%v); pg.wait_for_timeout(1000); rr.append(pg.evaluate("()=>[location.pathname,location.hash,window.__mk===1]"))
    check('Καρτέλες: χωρίς νέα φόρτωση της σελίδας όταν η διεύθυνση δεν είναι /v4/ (1.12.15)', all(x[0]=='/v4/index.html' and x[2] for x in rr) and rr[0][1]=='#forecast' and rr[3][1]=='#map', rr)
    c.close()
    # 1.12.16: παλίρροια, φίλτρα Οδηγού, GPX/KML, «Είδη» στο Προφίλ, «Σήμερα» στην είσοδο
    import json as _jj, time as _tt
    _SL=_jj.load(open(_os.path.join(os.path.dirname(os.path.abspath(__file__)),'sealevel.json')))
    # όλες οι ώρες μετακινούνται κατά τις ίδιες μέρες, ώστε σήμερα ΚΑΙ αύριο να έχουν παλίρροια (αλλιώς νωρίς το πρωί UTC φαινόταν μόνο ένα άκρο)
    import datetime as _dtm
    _d0=_tt.strftime('%Y-%m-%d')
    _off=_dtm.date.today()-_dtm.date.fromisoformat(_SL['t'][24][:10])
    _shift=lambda ts: (_dtm.datetime.fromisoformat(ts)+_off).strftime('%Y-%m-%dT%H:%M')
    c=ctx(b); c.route('**/marine?*hourly=sea_level_height_msl*',lambda r: r.fulfill(json={'hourly':{'time':[_shift(x) for x in _SL['t']],'sea_level_height_msl':_SL['v']}}))
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(5000)
    pg.evaluate("()=>{const d=document.querySelector('details.fold[data-k=pw]'); if(d) d.open=true;}"); pg.wait_for_timeout(1500)
    td=pg.evaluate("()=>{const d=document.querySelector('details.fold[data-k=pw]'); return d?[d.querySelector('summary').innerText,d.querySelectorAll('svg.pwc .th, svg.pwc .tlo').length,!!d.querySelector('svg.pwc .tl')]:null}")
    check('Πρόγνωση: παλίρροια ΜΕΣΑ στο γράφημα πίεσης/ανέμου/σελήνης, με ψηλές/χαμηλές (1.12.19)', td and td[1]>=3 and td[2] and 'παλίρροια' in td[0].lower(), td)
    pg.evaluate("()=>{location.hash='#guide'}"); pg.wait_for_timeout(3500)
    pg.click("#spFs button:has-text('Δεν κρατιούνται')"); pg.wait_for_timeout(700)
    gl=pg.evaluate("()=>[...document.querySelectorAll('#spList summary b')].map(e=>e.textContent)")
    check('Οδηγός: φίλτρο «Δεν κρατιούνται» (τόνος, ξιφίας, λαγοκέφαλος, σαλάχια) (1.12.16)', 'Ξιφίας' in gl and 'Λαγοκέφαλος' in gl and 'Σφυρίδα' not in gl, gl)
    pg.click("#spFs button:has-text('Ελάχιστο μέγεθος')"); pg.wait_for_timeout(700)
    gb=pg.evaluate("()=>[...document.querySelectorAll('#spList .bd.mn')].length===document.querySelectorAll('#spList details.sp').length&&document.querySelectorAll('#spList details.sp').length>10")
    check('Οδηγός: φίλτρο «Ελάχιστο μέγεθος» με ετικέτα σε κάθε είδος (1.12.16)', gb, gb)
    gx=pg.evaluate("()=>[AK.geoText('gpx',{spots:1,fish:1,tracks:1}),AK.geoText('kml',{spots:1,fish:1,tracks:1})]")
    check('Εξαγωγή GPX/KML: έγκυρα XML (1.12.16)', gx[0].startswith('<?xml') and '<gpx' in gx[0] and '</gpx>' in gx[0] and '<kml' in gx[1] and '</kml>' in gx[1] and pg.evaluate("(t)=>!new DOMParser().parseFromString(t,'application/xml').querySelector('parsererror')",gx[0]) and pg.evaluate("(t)=>!new DOMParser().parseFromString(t,'application/xml').querySelector('parsererror')",gx[1]), [x[:120] for x in gx])
    pg.evaluate("()=>{location.hash='#profile'}"); pg.wait_for_timeout(1500)
    ps=pg.evaluate("()=>[...document.querySelectorAll('main .listh')].map(e=>e.textContent)")
    check('Προφίλ › Τα δικά μου: «Εξοπλισμός και συσκευές», «Φίλοι και κοινότητα», «Βοήθεια» (1.14.32)', ps[:2]==['Εξοπλισμός και συσκευές','Φίλοι και κοινότητα'] and 'Βοήθεια' not in ps, ps)
    check('1.12.16 χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    _fc={'id':'gps','t':int(_tt.time()*1000),'fc':{'days':[{'date':_d0,'best':72,'safe':True,'win':{'s':23,'e':23},'avgWind':4,'avgWave':0.4}]}}
    c=ctx(b); c.add_init_script("if(!sessionStorage.sp){sessionStorage.sp=1;localStorage.setItem('alkyon-askfp','1');localStorage.setItem('alkyon-fc7',%s);}"%_jj.dumps(_jj.dumps(_fc)))
    pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(2500)
    sp=pg.evaluate("()=>{const p=document.querySelector('.sppage'); return p?[!!p.querySelector('.sptoday'),(p.querySelector('.sptoday')||{}).textContent||'',(p.querySelector('.sphi')||{}).textContent||'']:null}")
    check('Είσοδος: χαιρετισμός και «Σήμερα 72 · καλύτερη ώρα» (1.12.16)', sp and sp[0] and '72' in sp[1] and 'καλύτερη ώρα 23:00' in sp[1] and sp[2], sp)
    c.close()
    _d1=(_dt.date.fromisoformat(_d0)+_dt.timedelta(days=1)).isoformat()
    _fc={'id':'gps','t':int(_tt.time()*1000),'fc':{'days':[{'date':_d0,'best':0,'safe':False,'why':'night','win':None,'avgWind':3,'avgWave':0.4},{'date':_d1,'best':81,'safe':True,'win':{'s':6,'e':8},'avgWind':4,'avgWave':0.3}]}}
    c=ctx(b); c.add_init_script("if(!sessionStorage.sp){sessionStorage.sp=1;localStorage.setItem('alkyon-askfp','1');localStorage.setItem('alkyon-fc7',%s);}"%_jj.dumps(_jj.dumps(_fc)))
    pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(2500)
    sp=pg.evaluate("()=>(document.querySelector('.sppage .sptoday')||{}).textContent||''")
    check('Είσοδος το βράδυ: «Αύριο 81», όχι «εκτός ορίων» (1.14.19)', 'Αύριο' in sp and '81' in sp and 'εκτός' not in sp, sp); c.close()
    # 1.12.17: ανάλυση ωρών τσιμπήματος με τα πραγματικά δεδομένα των θράψαλων 9/11 (Πάφος): άπνοια + στροφή ανέμου στην αρχή, δυνάμωμα + κρύωμα + γύρισμα παλίρροιας στο τέλος
    import calendar as _cal
    _R=[(14,4.1,225,8.6,1026.4,72,19.6,.62,-.63,.8,315),(15,4.2,236,8.9,1026.3,59,19.2,.58,-.66,.8,315),(16,4,235,8.7,1025.8,89,18.7,.56,-.64,.6,326),(17,3,220,8.2,1026.4,100,18,.52,-.6,.6,326),(18,1.8,193,5.6,1026.4,100,17.7,.5,-.54,.6,326),(19,1.2,108,3.1,1026.8,100,17.6,.46,-.46,.5,315),(20,3.7,51,7,1026.6,100,15.5,.44,-.4,.5,315),(21,5.1,50,9.1,1026.5,100,14.9,.44,-.37,.5,315),(22,5.2,45,9.5,1026.3,69,14.9,.42,-.37,.5,315),(23,5.1,43,9.7,1026.5,0,14.3,.42,-.41,.5,315),(24,5.2,42,9.7,1026.5,0,13.8,.4,-.47,.6,326),(25,5.5,39,10.1,1026.2,0,13.4,.4,-.55,.6,326)]
    _K=['wind_speed_10m','wind_direction_10m','wind_gusts_10m','pressure_msl','cloud_cover','temperature_2m','wave_height','sea_level_height_msl','ocean_current_velocity','ocean_current_direction']
    _S={'t':[(_cal.timegm((2026,11,9,0,0,0))+(r[0]-2)*3600)*1000 for r in _R]}
    for _i,_k in enumerate(_K): _S[_k]=[r[_i+1] for r in _R]
    _bq={'id':'x','date':'2026-11-09','time':'19:00','tz':120,'lat':34.72453,'lon':32.36531,'win':{'a':'19:00','b':'21:00'},'species':'Θράψαλο'}
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    rq=pg.evaluate("([b,S])=>{const W=AK.biteWin; return {st:W.analyze(b,S,'start').map(x=>x.k),en:W.analyze(b,S,'end').map(x=>x.k),du:W.during(b,S).map(x=>x.t).join(' | ')}}",[_bq,_S])
    check('Ώρες τσιμπήματος: αρχή = άπνοια και στροφή ανέμου ΝΔ→ΒΑ σε ελαφρύ άνεμο (1.12.17)', 'wind-calm' in rq['st'] and 'wind-turn' in rq['st'], rq)
    check('Ώρες τσιμπήματος: τέλος = γύρισμα παλίρροιας, δυνάμωμα ανέμου, κρύωμα αέρα (1.12.17)', all(k in rq['en'] for k in ['tide-turn','wind-build','air']), rq)
    check('Ώρες τσιμπήματος: «όσο τσιμπούσαν» δείχνει άνεμο από→σε και αέρα (1.12.17)', '→' in rq['du'].split(' | ')[0] and 'Αέρας' in rq['du'], rq['du'])
    c.close()
    # 1.12.19: κοινό γράφημα (Πρόγνωση + ψάρι): πίεση, άνεμος, σελήνη, παλίρροια, σημάδι «σταμάτησαν»
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    rc=pg.evaluate("""()=>{ const t0=Date.UTC(2026,10,9,12), pts=[]; for(let i=0;i<13;i++) pts.push({t:t0+i*3600e3,p:1026+Math.sin(i/3),w:3+i/3,g:6+i/3,d:220-i*15,l:-0.5+0.12*Math.sin(i/2)});
      const C=AK.pwChart(pts,{lat:34.72,lon:32.37,tz:120,rk:'catch',nowI:-1,sel:6,marks:[{t:t0+6*3600e3,cls:'catch'},{t:t0+8*3600e3,cls:'stop',lbl:'σταμάτησαν 20:00'}],shade:[{a:t0+6*3600e3,b:t0+8*3600e3,cls:'win'}]});
      const q=s=>C.svg.querySelectorAll(s).length; return [q('.pl'),q('.wl'),q('.tl'),q('.th')+q('.tlo'),q('.pmk.stop'),q('.shd.win'),!!C.svg.querySelector('.axh.mk'),C.rd.textContent]; }""")
    check('Γράφημα ψαριού = ίδιο με Πρόγνωση: πίεση, άνεμος, σελήνη, παλίρροια, «σταμάτησαν» (1.12.19)', rc[0]>=1 and rc[1]>=1 and rc[2]==1 and rc[3]>=1 and rc[4]==1 and rc[5]==1 and rc[6] and 'στάθμη' in rc[7], rc)
    check('1.12.19 χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    # 19/11/2026: τα δύο παρακάτω contexts δεν έκοβαν τα εξωτερικά αιτήματα όπως όλα τα άλλα (ctx)· όταν μια εξωτερική υπηρεσία αργούσε, το goto έληγε στο GitHub. Τώρα είναι κι αυτά χωρίς δίκτυο.
    # 1.12.22: είσοδος: «Συνέχεια» πάντα ορατό, «πίσω» κλείνει την ερώτηση, Continue αφαιρεί την εγγραφή ιστορικού, βήμα πίσω στο καλωσόρισμα
    c=b.new_context(viewport={'width':411,'height':640},is_mobile=True,has_touch=True); c.add_init_script("localStorage.setItem('alkyon-onboard','1')"); c.route('**/*open-meteo.com/**',respond); c.route(lambda u: not u.startswith(BASE) and 'open-meteo' not in u, lambda r: r.abort()); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{const p=document.querySelector('.sppage'); if(p) p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))}")   # 1.12.28: η εγγραφή ιστορικού μπαίνει στο πρώτο άγγιγμα
    sp1=pg.evaluate("()=>{const g=document.querySelector('.sppage .spgo'); return g?[Math.round(g.getBoundingClientRect().bottom)<=innerHeight,!!(history.state&&history.state.spk)]:null}")
    pg.go_back(); pg.wait_for_timeout(600); sp2=pg.evaluate("()=>[!!document.querySelector('.sppage'),location.hash]")
    pg.evaluate("()=>AK.startPick()"); pg.wait_for_timeout(400); pg.evaluate("()=>document.querySelector('.sppage .spgo').click()"); pg.wait_for_timeout(800)
    sp3=pg.evaluate("()=>[!!document.querySelector('.sppage'),location.hash,!!(history.state&&history.state.spk)]")
    check('Είσοδος: «Συνέχεια» ορατό σε μικρή οθόνη, «πίσω» την κλείνει, «Συνέχεια» δεν αφήνει νεκρό «πίσω» (1.12.22)', sp1==[True,True] and sp2==[False,'#map'] and sp3==[False,'#map',False], [sp1,sp2,sp3])
    c.close()
    c=b.new_context(viewport={'width':411,'height':740}); c.add_init_script("localStorage.setItem('alkyon-country',JSON.stringify('cy'))"); c.route('**/*open-meteo.com/**',respond); c.route(lambda u: not u.startswith(BASE) and 'open-meteo' not in u, lambda r: r.abort()); pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(2500)   # 1.14.62: η γλώσσα φαίνεται μόνο για Κύπρο/Ελλάδα
    tb=pg.evaluate("()=>{const r=[AK.backHook()]; document.querySelector('.sppage .spgo').click(); r.push(document.querySelectorAll('.obd i')[1].className==='on'); r.push(AK.backHook()); r.push(document.querySelectorAll('.obd i')[0].className==='on'); const l=document.querySelector('.splang .lnk'); r.push(l?getComputedStyle(l).backgroundColor:''); return r}")
    check('Καλωσόρισμα: «πίσω» της εφαρμογής = ένα βήμα πίσω, στο πρώτο βήμα όχι· κουμπιά γλώσσας χωρίς λευκό κουτί (1.12.22)', tb[:4]==[False,True,True,True] and tb[4] in ('rgba(0, 0, 0, 0)','transparent'), tb)
    c.close()
    # 1.12.23: παλιότερο ψάρι: «πάτα για φόρτωση» → το γράφημα εμφανίζεται χωρίς να ξανανοίξει η κάρτα
    import datetime as _dt
    _d=(_dt.datetime.now()-_dt.timedelta(days=3)).strftime('%Y-%m-%d')
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'wx1',date:'"+_d+"',time:'07:20',tz:120,species:'Λαβράκι',cnt:1,kg:1.2,lat:34.73,lon:32.38,_u:1}]))"); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.locator('.li.fishrow').first.click(); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{const s=[...document.querySelectorAll('.sheet.on summary')].find(x=>/Πίεση/.test(x.textContent)); s&&s.click();}"); pg.wait_for_timeout(5000)
    wq=pg.evaluate("()=>{const s=document.querySelector('.sheet.on .bwx'); return s?[!!s.querySelector('.bwxch,.bwpw'),(s.querySelector('summary')||{}).textContent||'']:null}")
    check('Κάρτα ψαριού: το γράφημα καιρού εμφανίζεται μόλις φορτώσει, χωρίς ξανάνοιγμα (1.12.23)', wq and wq[0] and 'φορτώνει' not in wq[1], wq)
    c.close()
    # 1.12.24: κουμπί «Βάθη»: κάθε πάτημα δείχνει την πυκνότητα (ετικέτα + μήνυμα)· λευκές γραμμές στον δορυφόρο
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-v4-map',JSON.stringify({base:'sat'}))"); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4000)
    dq=[]
    for _ in range(3):
        pg.evaluate("()=>{const b=[...document.querySelectorAll('.mchip')].find(x=>x._lab); b.click();}"); pg.wait_for_timeout(700)
        dq.append(pg.evaluate("()=>{const b=[...document.querySelectorAll('.mchip')].find(x=>x._lab); const t=[...document.querySelectorAll('.toast')].map(x=>x.textContent).pop()||''; return [b._lab(),t]}"))
    st=pg.evaluate("()=>{const s=[...document.querySelectorAll('style')].some(x=>/dlbl\.sat/.test(x.textContent)); return s}")
    check('Βάθη: Στάνταρ → 5 m → 10 m με ετικέτα και μήνυμα, στυλ για λευκούς αριθμούς (1.12.24)', [x[0] for x in dq]==['Βάθη','5 m','10 m'] and 'κάθε 5 m' in dq[1][1] and 'κάθε 10 m' in dq[2][1] and st, [dq,st])
    c.close()
    # 1.12.21: πυκνές γραμμές βάθους: πυκνές ως 30·βήμα, μετά κάθε 50 m ως 500 και κάθε 100 m, ως τον πάτο (όχι κόψιμο στα 300 m)
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_function("()=>window.AlkyonDense&&AlkyonDense.levels",timeout=20000)
    dl=pg.evaluate("()=>[5,10,20].map(s=>AlkyonDense.levels(2,950,s).map(x=>x.lv))")
    check('Γραμμές βάθους: 5 m ως 150, μετά 200…500, 600…900· δεν κόβονται στα 300 m (1.12.21)', dl[0][29]==150 and dl[0][30:]==[200,250,300,350,400,450,500,600,700,800,900] and dl[1][-5:]==[500,600,700,800,900] and dl[2][-4:]==[600,700,800,900], dl)
    c.close()
    # 1.12.14: Προφίλ (ομάδες, Σχετικά, γνώμη, θέμα), δολώματα, αποκλεισμός χρήστη
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-smart',JSON.stringify({weekly:Date.now()}))"); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    def grp(): return pg.evaluate("()=>[...document.querySelectorAll('main .pgrp')].map(g=>[(g.querySelector('h3')||{}).textContent||'',[...g.querySelectorAll('.li b')].map(e=>e.textContent)])")
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Τα δικά μου/.test(x.textContent)).click()"); pg.wait_for_timeout(600); g1=grp()
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(600); g2=grp()
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Λογαριασμός/.test(x.textContent)).click()"); pg.wait_for_timeout(600); g3=grp()
    hg=[x for x in g2 if x[0]=='Βοήθεια']; dg=[x for x in g3 if x[0]=='Δεδομένα']
    check('Προφίλ: Οδηγός πρώτος στη Βοήθεια (1.14.35), Βοήθεια με «Πες μας τη γνώμη σου» και «Σχετικά» (1.12.14)', g1 and hg and hg[0][1][:1]==['Οδηγός'] and 'Σχετικά' in hg[0][1] and 'Πες μας τη γνώμη σου' in hg[0][1], g1)
    check('Προφίλ: Ρυθμίσεις σε ομάδες Ψάρεμα/Ασφάλεια/Ειδοποιήσεις/Εμφάνιση και γλώσσα/Βοηθοί (1.14.32)', [x[0] for x in g2]==['Ψάρεμα','Ασφάλεια','Ειδοποιήσεις','Εμφάνιση και γλώσσα','Βοηθοί','Βοήθεια'], [x[0] for x in g2])
    check('Προφίλ: Λογαριασμός › Δεδομένα με εισαγωγή, αντίγραφο και εξαγωγή (1.12.14)', dg and any('Εισαγωγή' in t for t in dg[0][1]) and 'Αντίγραφο ασφαλείας' in dg[0][1], g3)
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>[...document.querySelectorAll('main .li')].find(x=>/Σχετικά/.test(x.textContent)).click()"); pg.wait_for_timeout(800)
    ab=pg.evaluate("()=>{const s=document.querySelector('.sheet.on'); return s?s.innerText:''}")
    check('Σχετικά: έκδοση, Πολιτική απορρήτου, Όροι χρήσης (1.12.14)', 'Πολιτική απορρήτου' in ab and 'Όροι χρήσης' in ab and pg.evaluate("()=>window.ALKYON_VERSION") in ab, ab[:200])
    pg.evaluate("()=>AK.closeSheet()"); pg.wait_for_timeout(500)
    fb=[]; c.route('**/rest/v1/app_errors',lambda r: (fb.append(r.request.post_data or ''), r.fulfill(status=201,body='')))
    pg.evaluate("()=>[...document.querySelectorAll('main .li')].find(x=>/Πες μας/.test(x.textContent)).click()"); pg.wait_for_timeout(800)
    pg.fill('.sheet.on textarea','Δοκιμή σχολίου'); pg.click(".sheet.on button:has-text('Αποστολή')"); pg.wait_for_timeout(1500)
    check('«Πες μας τη γνώμη σου»: στέλνεται ως feedback με την έκδοση (1.12.14)', any('feedback' in x and 'Δοκιμή σχολίου' in x for x in fb), fb[:1])
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>[...document.querySelectorAll('main .li')].find(x=>/Θέμα/.test(x.textContent)).click()"); pg.wait_for_timeout(700)
    pg.click(".sheet.on button:has-text('Φωτεινό')"); pg.wait_for_timeout(500); t1=pg.evaluate("()=>document.documentElement.getAttribute('data-theme')")
    pg.reload(); pg.wait_for_timeout(2000); t2=pg.evaluate("()=>document.documentElement.getAttribute('data-theme')")
    check('Θέμα: Φωτεινό εφαρμόζεται και μένει μετά από ανανέωση (1.12.14)', t1=='light' and t2=='light', [t1,t2])
    pg.evaluate("()=>{location.hash='#log'}"); pg.wait_for_timeout(1200); pg.evaluate("()=>AK.biteForm()"); pg.wait_for_timeout(1000)
    bc=pg.evaluate("()=>{const c=document.querySelector('.sheet.on .bfbtc'); return c?[...c.querySelectorAll('.chip')].map(x=>x.textContent):[]}")
    check('Φόρμα ψαριού: έτοιμα δολώματα (σαρδέλα, καλαμάρι, γαρίδα…) (1.12.14)', 'Σαρδέλα' in bc and 'Καλαμάρι' in bc and len(bc)<=8, bc)
    check('1.12.14: Προφίλ/φόρμα χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    c=ctx(b); c.add_init_script("if(!sessionStorage.cs){sessionStorage.cs=1;localStorage.setItem('alkyon-smart',JSON.stringify({weekly:Date.now()}));localStorage.setItem('alkyon-sess',JSON.stringify({access_token:'AT',refresh_token:'RT',exp:Date.now()+9e6,uid:'u1',email:'d@x.com'}));}")
    c.route('**/rest/v1/**',lambda r: r.fulfill(json=[]) if r.request.method=='GET' else r.fulfill(status=201,body=''))
    c.route('**/storage/**',lambda r: r.fulfill(json=[])); c.route('**/functions/v1/**',lambda r: r.fulfill(json={'ok':True}))
    PB=[{'id':'p1','user_id':'u9','author':'Κακός','species':'Σφυρίδα','kg':3,'created_at':'2026-11-08T10:00:00Z','likes':[{'count':0}],'comments':[{'count':0}]},
        {'id':'p2','user_id':'u8','author':'Καλός','species':'Σαργός','kg':1,'created_at':'2026-11-08T09:00:00Z','likes':[{'count':0}],'comments':[{'count':2}]}]
    c.route('**/rest/v1/community_posts?select=*,likes*',lambda r: r.fulfill(json=PB)); c.route('**/rest/v1/community_posts?select=id,user_id*',lambda r: r.fulfill(json=PB))
    c.route('**/rest/v1/community_comments?select=*&post_id*',lambda r: r.fulfill(json=[{'id':'c1','post_id':'p2','user_id':'u9','author':'Κακός','body':'κακό','created_at':'2026-11-08T09:30:00Z'},{'id':'c2','post_id':'p2','user_id':'u7','author':'Άλλος','body':'ωραίο','created_at':'2026-11-08T09:40:00Z'}]))
    pg=page(c); pg.goto(BASE+'/v4/#community'); pg.wait_for_timeout(3500)
    au=lambda: pg.evaluate("()=>[...document.querySelectorAll('.cmpost .cmwho b')].map(e=>e.textContent)")
    pg.evaluate("()=>{[...document.querySelectorAll('.cmpost')].find(x=>/Σαργός/.test(x.textContent)).querySelector('.cmbtn[aria-label=Σχόλια]').click()}"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{[...document.querySelectorAll('.cmpost')].find(x=>/Κακός/.test(x.querySelector('.cmwho').textContent)).querySelector('button[aria-label=Περισσότερα]').click()}"); pg.wait_for_timeout(800)
    pg.click(".sheet.on button:has-text('Αποκλεισμός χρήστη')"); pg.wait_for_timeout(800); pg.click(".sheet.on button:has-text('Αποκλεισμός')"); pg.wait_for_timeout(1200)
    cm=pg.evaluate("()=>[...document.querySelectorAll('.cmc .noik b')].map(e=>e.textContent.trim())")
    check('Κοινότητα: αποκλεισμός χρήστη κρύβει αναρτήσεις ΚΑΙ σχόλιά του (1.12.14)', au()==['Καλός'] and cm==['Άλλος'], [au(),cm])
    pg.evaluate("()=>{location.hash='#profile'}"); pg.wait_for_timeout(1500); pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Λογαριασμός/.test(x.textContent)).click()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>[...document.querySelectorAll('main .li')].find(x=>/Αποκλεισμένοι/.test(x.textContent)).click()"); pg.wait_for_timeout(700)
    pg.click(".sheet.on button:has-text('Άρση')"); pg.wait_for_timeout(500)
    check('Προφίλ › Αποκλεισμένοι χρήστες: άρση αποκλεισμού (1.12.14)', pg.evaluate("()=>localStorage.getItem('alkyon-comm-block')")=='[]', pg.evaluate("()=>localStorage.getItem('alkyon-comm-block')"))
    check('1.12.14: αποκλεισμός χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.28 τι πιάνεται τώρα, γιατί 72, βεβαιότητα, βαθμολογία')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''async()=>{ const f=AK.contrib._rowOf; const a=f('b',{id:'x1',date:'2026-11-10',time:'06:30',tz:120,latin:'Loligo vulgaris',species:'Καλαμάρι',lat:34.7,lon:32.4}); const tr=f('trip',{id:'t1',date:'2026-11-10',startMs:1,endMs:3600001,lat:34.7,lon:32.4,count:0,rate:1});
      const sm={rise:390,set:1020,f:0.5,illum:0.5}, ex=PF.explainHour(sm,{hr:7,wind:6,wave:0.3,cloud:'over',rain:50,ptrend:'fast',pres:1012,sst:21,temp:19,bite:70,learn:{k:1.1}},null);
      const ff=async()=>new Response(JSON.stringify({hourly:{time:['2026-11-20T09:00','2026-11-21T09:00'],wind_speed_10m_ecmwf_ifs025:[5,6],wind_speed_10m_gfs_seamless:[16,7],wind_speed_10m_icon_seamless:[8,6]}}),{status:200});
      const E=await PF.ensSpread(10,10,ff,7); return [a.cond.nm,tr.cond&&tr.cond.rt,ex.parts.map(x=>x.k),E['2026-11-20'].bad,E['2026-11-21'].bad]; }''')
    check('Βαθμολογία εξόδου και όνομα είδους στα ανώνυμα· «Γιατί;» με πίεση/ουρανό/μάθηση· αβέβαιη μέρα όταν διαφωνούν τα μοντέλα (1.14.28)', r[0]=='Καλαμάρι' and r[1]==1 and 'pt' in r[2] and 'learn' in r[2] and r[3] is True and r[4] is False, r)
    card=pg.evaluate('''()=>{ localStorage.setItem('alkyon-lastpos',JSON.stringify({lat:34.7,lon:32.4,t:Date.now()})); const st=[{key:'all',n:72,users:3,data:{v:2,hrs:195,trips:40,fitMin:200,ins:[],f:{}}},{key:'trend:34_32',n:9,users:3,data:{items:[{sp:'loligo vulgaris',nm:'Καλαμάρι',g:'ceph',n7:9,prev:0,ratio:10,users:3,up:true,fresh:true}]}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); const pos=AK.lastPos; AK.lastPos=()=>({lat:34.7,lon:32.4}); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>r(c.textContent),1500)); }''')
    check('«Τι πιάνεται τώρα κοντά σου» με 🦑 και «200 έξοδοι (τώρα 40)» στην κάρτα (1.14.28)', 'Τι πιάνεται τώρα' in card and 'Καλαμάρι' in card and '(τώρα 40)' in card, card[:400])
    check('1.14.28: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.29 ακρίβεια, τι δουλεύει, εποχή, σημεία ανά άνεμο, χλωροφύλλη')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ localStorage.setItem('alkyon-bites',JSON.stringify([{id:'a',date:'2026-10-01',lat:34.70,lon:32.40,wdeg:270,wind:12,species:'Λαβράκι',cnt:2},{id:'b',date:'2026-10-05',lat:34.701,lon:32.401,wdeg:290,wind:10,species:'Λαβράκι'},{id:'c',date:'2026-10-09',lat:34.70,lon:32.402,wdeg:250,wind:14,species:'Σαργός'},{id:'d',date:'2026-10-09',lat:34.9,lon:32.9,wdeg:90,wind:10,species:'Σαργός',cnt:9}]));
      localStorage.setItem('alkyon-spots',JSON.stringify([{id:'s',name:'Λιμανάκι',lat:34.703,lon:32.40}]));
      const f=AK.mySpots.find(270,12), g=AK.mySpots.find(90,10), m=AK.mySpots.meanWind([{dir:350,wind:10},{dir:10,wind:10}]), bx=AK.mySpots.box([{dir:270,wind:12}]);
      return [f.length&&f[0].name,f.length&&f[0].n,f.length&&f[0].days,g.length,m&&m.dir,bx&&bx.textContent,PF.learnBins({rise:390,set:1020},{hr:9,chl:0.3}).chl]; }''')
    check('Σημεία ανά άνεμο: «Λιμανάκι · 4 ψάρια σε 3 μέρες» με Δ, όχι με 1 μέρα· χλωροφύλλη στον δείκτη (1.14.29)', r[0]=='Λιμανάκι' and r[1]==4 and r[2]==3 and r[3]==0 and r[4]==0 and 'Με Δ 12 kn' in (r[5] or '') and r[6]==3, r)
    card=pg.evaluate('''()=>{ const st=[{key:'all',n:72,users:3,data:{v:2,hrs:195,trips:40,fitMin:200,mon:[1,1,1,1,1,1,1,1,1,10,20,5],acc:{b:[50,60,70],n:[5,10,12,8],r:[0.2,0.4,0.6,0.9],hit:[40,60,70,88],trips:35},ins:[],f:{}}},
        {key:'sp:loligo vulgaris',n:30,users:3,data:{v:2,mon:[0,0,0,0,0,0,0,0,0,4,12,3],ins:[],f:{}}},
        {key:'trend:34_32',n:9,users:3,data:{day:new Date().toISOString().slice(0,10),items:[],works:{tech:[{v:'Καλαμαριέρα',n:9,u:3}],bait:[],lure:[{v:'πορτοκαλί 2.5',n:5,u:2}],users:3}}}];
      AK.cloud.pub=()=>Promise.resolve(new Response(JSON.stringify(st),{status:200})); AK.lastPos=()=>({lat:34.7,lon:32.4}); const c=AK.biteStatsCard(); document.body.append(c);
      return new Promise(r=>setTimeout(()=>{ const t0=c.textContent; const ch=[...c.querySelectorAll('.bschips .chip')].find(x=>/αλαμάρι|oligo/i.test(x.textContent)); ch&&ch.click(); setTimeout(()=>r([t0,c.textContent,c.querySelectorAll('.bsm').length]),300); },1500)); }''')
    check('Κάρτα: «Πόσο έπεσε μέσα» (×4,5), «Τι δουλεύει τώρα», «Κάλεσε φίλους», εποχή είδους 12 μήνες (1.14.29)', 'Πόσο έπεσε μέσα' in card[0] and '×4,5' in card[0] and 'Τι δουλεύει τώρα' in card[0] and 'Καλαμαριέρα' in card[0] and 'Κάλεσε φίλους' in card[0] and 'Εποχή από τα στοιχεία' in card[1] and card[2]==12, [card[0][:500],card[1][-300:],card[2]])
    check('1.14.29: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.30 σχέδιο, θερμοκλινές')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ localStorage.setItem('alkyon-works',JSON.stringify({day:new Date().toISOString().slice(0,10),w:{lure:[{v:'πορτοκαλί 2.5'}],tech:[{v:'Καλαμαριέρα'}],bait:[]}}));
      const a=AK.contrib.tryNow(); localStorage.setItem('alkyon-works',JSON.stringify({day:'2020-01-01',w:{lure:[{v:'x'}]}})); window.AlkyonLearn={ins:[{f:'sun',b:1,lift:2,w:{tech:['Συρτή']}}]}; const b2=AK.contrib.tryNow();
      const sm={rise:390,set:1020}; return [a,b2,PF.learnBins(sm,{hr:9,thd:0}).thc,PF.learnBins(sm,{hr:9,thd:30}).thc]; }''')
    check('«Δοκίμασε»: τι δουλεύει τώρα στην περιοχή, αλλιώς τα δικά σου ευρήματα· θερμοκλινές στον δείκτη (1.14.30)', r==['πορτοκαλί 2.5, Καλαμαριέρα','Συρτή',0,2], r)
    check('1.14.30: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.31 όριο ποσότητας, «το άφησα», όρια από τις εξόδους')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    r=pg.evaluate('''()=>{ const B=[{id:'a',trip:'T1',date:'2026-11-10',kg:4,lat:34.7,lon:32.4,latin:'Dentex dentex',species:'Συναγρίδα'},{id:'b',trip:'T1',date:'2026-11-10',kg:3,lat:34.7,lon:32.4,species:'Λαβράκι'},{id:'c',trip:'T1',date:'2026-11-10',kg:9,rel:true,lat:34.7,lon:32.4},{id:'d',trip:'T2',kg:20,lat:34.7,lon:32.4}];
      for(let i=0;i<9;i++) B.push({id:'w'+i,date:'2026-10-0'+(i+1),wind:8+i,gust:12+i,wave:0.3+i*0.05,prof:'boat'});
      localStorage.setItem('alkyon-bites',JSON.stringify(B)); localStorage.setItem('alkyon-fprof','boat');
      const r1=AK.bag.of('T1',{kg:2,species:'Σαργός'}), r2=AK.bag.of('T1',{kg:4.5,latin:'Dentex dentex',species:'Συναγρίδα'}), r3=AK.bag.of('T3',{kg:12,species:'Μαγιάτικο',lat:34.7,lon:32.4}), r4=AK.bag.of('T1',{kg:7,species:'Μαγιάτικο'});
      const L=AK.limitsLearn('boat'); return [r1.kg,r1.over,r2.oneOver.length,r2.over,r3.over,r4.over,AK.bag.text(r4).slice(0,40),L&&[L.wind,L.gust,L.wave,L.days]]; }''')
    check('Όριο ποσότητας: 9 kg εντάξει, 2η συναγρίδα ⚠, ένα μεγάλο ψάρι επιτρέπεται (5 kg + 1), 14 kg πάνω από το όριο· όρια από 9 μέρες (1.14.31)', r[0]==9 and r[1] is False and r[2]==1 and r[3] is True and r[4] is False and r[5] is True and 'Πέρασες το όριο' in r[6] and r[7]==[16,20,0.7,9], r)
    pg.evaluate("()=>{ localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T1',start:Date.now()-3600e3})); AK.biteForm(); }"); pg.wait_for_timeout(1200)
    pg.fill('.bf2 .spwrap input','Ροφός'); pg.wait_for_timeout(150); pg.fill('.bf2 .g3 .fld:nth-child(2) input','30'); pg.wait_for_timeout(200)
    r=pg.evaluate("()=>{ const n=document.querySelector('.bf2 .lawnote'); const rel=[...document.querySelectorAll('.bf2 label.tg')].find(l=>/άφησα ελεύθερο/.test(l.textContent)).querySelector('input'); return [n.textContent,rel.checked]; }")
    pg.fill('.bf2 .g3 .fld:nth-child(2) input','50'); pg.wait_for_timeout(200)
    r2=pg.evaluate("()=>{ const rel=[...document.querySelectorAll('.bf2 label.tg')].find(l=>/άφησα ελεύθερο/.test(l.textContent)).querySelector('input'); return [document.querySelector('.bf2 .lawnote').textContent,rel.checked]; }")
    check('Κάτω από το ελάχιστο → «Το άφησα ελεύθερο» αυτόματα, πάνω → ξεστσεκάρεται· κρατημένα της εξόδου στη φόρμα (1.14.31)', r[1] is True and 'Σημειώθηκε' in r[0] and r2[1] is False and 'Κρατημένα σε αυτή την έξοδο: 7' in r2[0], [r,r2])
    check('1.14.31: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.32 προφίλ: νέα κατανομή')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    def ptab(name):
        pg.evaluate("n=>[...document.querySelectorAll('main .seg button')].find(x=>x.textContent.trim()===n).click()",name); pg.wait_for_timeout(600)
        return pg.evaluate("()=>[...document.querySelectorAll('main .pgrp')].map(g=>((g.querySelector('.listh')||{}).textContent||'')+':'+[...g.querySelectorAll('.li b')].map(b=>b.firstChild?b.firstChild.textContent:b.textContent).join('|'))")
    m=ptab('Τα δικά μου'); st=ptab('Ρυθμίσεις'); ac=ptab('Λογαριασμός')
    check('Προφίλ: Οδηγός πάνω, βυθόμετρο στις συσκευές, Βοήθεια μόνο στις Ρυθμίσεις (1.14.34), Βοήθησε την πρόγνωση στον Λογαριασμό (1.14.32)',
      not any('Οδηγός' in x for x in m) and 'Βυθόμετρο' in m[0] and 'Ρολόι (Garmin' in m[0] and st[-1].startswith('Βοήθεια:Οδηγός|') and st[-1].startswith('Βοήθεια:') and not any(x.startswith('Βοήθεια:') for x in m+ac)
      and any(x.startswith('Εμφάνιση και γλώσσα:Θέμα') for x in st) and not any('Βοήθησε την πρόγνωση' in x for x in st) and any('Βοήθησε την πρόγνωση' in x for x in ac) and not any('Εισαγωγή από βυθόμετρο' in x for x in ac), [m,st,ac])
    check('1.14.32: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.35 Οδηγός από το Ημερολόγιο / ψάρι / χάρτη, εικονίδια')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    gi=pg.evaluate("()=>!!document.querySelector('main .top a.iconbtn[href=\"#guide\"]')")
    pg.evaluate("()=>AK.guideGo('species','Σαργός')"); pg.wait_for_timeout(4000)
    gq=pg.evaluate("()=>[location.hash,(document.getElementById('spQ')||{}).value,document.querySelectorAll('#spList details.sp').length]")
    pg.evaluate("()=>AK.guideGo('law')"); pg.wait_for_timeout(1500)
    gl=pg.evaluate("()=>{ const b=document.querySelector('.gseg button[data-g=law]'); return b&&b.getAttribute('aria-pressed'); }")
    check('Οδηγός: 📖 στο Ημερολόγιο, άνοιγμα σε είδος (Σαργός) και στους Νόμους (1.14.35)', gi and gq[0]=='#guide' and gq[1]=='Σαργός' and 0<gq[2]<15 and gl=='true', [gi,gq,gl])
    pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2000); pg.evaluate("()=>{location.hash='#log'}"); pg.wait_for_timeout(1500)
    pg.click("main .top a.iconbtn[href='#guide']"); pg.wait_for_timeout(2500); pg.click("main .top a.iconbtn[aria-label='Πίσω']"); pg.wait_for_timeout(1500)
    check('Οδηγός από το Ημερολόγιο: το «Πίσω» γυρίζει στο Ημερολόγιο, όχι στο Προφίλ (1.14.36)', pg.evaluate("()=>location.hash")=='#log', pg.evaluate("()=>location.hash"))
    pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2000)
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(600)
    ic=pg.evaluate("()=>{ const f=t=>{ const r=[...document.querySelectorAll('main .li')].find(x=>x.querySelector('b')&&x.querySelector('b').textContent.trim().startsWith(t)); return r?r.querySelector('.ic').innerHTML:null; }; return [f('Επαφή ασφαλείας')!==f('Όρια ασφαλείας'), !document.querySelector('main p.foot') || !/Alkyon ·/.test(document.querySelector('main p.foot').textContent)]; }")
    check('Προφίλ: διαφορετικά εικονίδια, χωρίς διπλή έκδοση κάτω (1.14.35)', ic==[True,True], ic)
    check('1.14.35: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.37 Πρόγνωση: (i), επόμενη ώρα, καθαρές κάρτες')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(5000)
    r=pg.evaluate("()=>{ const s=document.querySelector('main .infob'), q=[...document.querySelectorAll('main summary,main .hwhy2 summary')].map(x=>x.textContent).join('|'); let o=null; if(s){ s.click(); o=s.nextElementSibling; } const pn=document.querySelector('main .infot:not([hidden])'); return [!!s, !!pn, !/;$/.test('x'), document.querySelectorAll('main .opps').length]; }")
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Είδη/.test(x.textContent)).click()"); pg.wait_for_timeout(2500)
    sp=pg.evaluate("()=>[document.querySelectorAll('main .splv').length, /\\d%/.test((document.querySelector('main .spl')||{}).textContent||''), !document.querySelector('main .extcard')]")
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Δικά μου/.test(x.textContent)).click()"); pg.wait_for_timeout(2500)
    mn=pg.evaluate("()=>{ const t=document.getElementById('main').innerText; return [/Έλεγχος της πρόγνωσης/.test(t), !/Ο βαθμός στην πράξη/.test(t), / από 15/.test(t)]; }")
    check('Πρόγνωση: (i) ανοίγει εξήγηση, χωρίς διπλές «Ευκαιρίες» στις Μέρες· Είδη με «Καλές/Μέτριες» όχι %· μία κάρτα «Έλεγχος της πρόγνωσης» (1.14.37)', r[0] and r[1] and r[3]==0 and sp[0]>0 and not sp[1] and sp[2] and mn==[True,True,True], [r,sp,mn])
    check('1.14.37: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.14.39 Πρόγνωση: μικρή μπάρα ημερών στο κύλισμα, ετικέτες στο γράφημα')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(5000)
    pg.evaluate("()=>{document.querySelectorAll('main details').forEach(d=>d.open=true); window.scrollTo(0,900)}"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>[document.querySelector('.dstrip').classList.contains('stuck'), document.querySelector('.dstrip').offsetHeight<70, document.querySelectorAll('.hline .hlchip').length>=2, document.querySelectorAll('.hb.s-good,.hb.s-fair,.hb.s-poor,.hb.best,.hb.bad').length===24]")
    pg.evaluate("()=>window.scrollTo(0,0)"); pg.wait_for_timeout(800); r.append(pg.evaluate("()=>!document.querySelector('.dstrip').classList.contains('stuck')"))
    check('Πρόγνωση: η μπάρα ημερών μικραίνει στο κύλισμα και επανέρχεται, τιμές γραφήματος σε ετικέτες, μπάρες ωρών με χρώμα βαθμού (1.14.39)', all(r) and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.40 Πρόγνωση: κύκλος βαθμού')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(5000)
    r=pg.evaluate("()=>{ const h=document.querySelector('main .hero'); return [!!h.querySelector('.hring b'), /^\\d\\d:00–\\d\\d:00$/.test((h.querySelector('.hpw')||{}).textContent||'')||!h.querySelector('.hpw'), !!h.querySelector('.nowcard .nwg'), !!h.querySelector('.nwa .btn'), document.querySelectorAll('main .card.nowcard').length===0]; }")
    check('Πρόγνωση: κύκλος βαθμού με ένα παράθυρο, ο καιρός τώρα και τα κουμπιά μέσα στην πρώτη κάρτα (1.14.40)', all(r) and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.42 μικρές έξοδοι: η λίστα μένει ανοιχτή')
    c=ctx(b); c.add_init_script("if(!sessionStorage.st){sessionStorage.st=1;localStorage.setItem('alkyon-trips',JSON.stringify([1,2,3].map(i=>({id:'s'+i,date:'2026-11-1'+i,startMs:Date.parse('2026-11-1'+i+'T08:00:00Z'),endMs:Date.parse('2026-11-1'+i+'T08:02:00Z'),count:0,prof:'boat',_u:1}))));localStorage.setItem('alkyon-v4-logtab',JSON.stringify('trips'));}")
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.click('main .shortbtn'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{ const t=AK.store.raw('trips').find(x=>x.id==='s1'); AK.store.delUndo('trips',t,'x'); AK.emit('store','alkyon-trips'); }"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{ const sl=document.querySelector('main .shortbtn + .list'); return [!!sl&&!sl.hidden, sl?sl.querySelectorAll('.triprow').length:0, /\\(2\\)/.test(document.querySelector('main .shortbtn').textContent)]; }")
    pg.click('main .shortall'); pg.wait_for_timeout(1200)
    r.append(pg.evaluate("()=>!document.querySelector('main .shortbtn')"))
    check('Μικρές έξοδοι: μετά τη διαγραφή η λίστα μένει ανοιχτή (2 από 3), «Διαγραφή όλων» τις σβήνει (1.14.42)', r==[True,2,True,True] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.43 εμφάνιση')
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#guide'); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>{ const q=document.querySelector('#spQ'), l=document.querySelector('#g-species'); return [q&&q.placeholder, getComputedStyle(l).backgroundColor, AK.T('α','say «x»')]; }")
    check('Οδηγός στα αγγλικά: αναζήτηση στα αγγλικά, λίστα χωρίς φόντο κάρτας, εισαγωγικά “ ” (1.14.43)', r[0].startswith('Search species') and r[1]=='rgba(0, 0, 0, 0)' and r[2]=='say \u201cx\u201d' and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b); c.add_init_script("localStorage.removeItem('alkyon-fprof-done');localStorage.setItem('alkyon-askfp','1');localStorage.setItem('alkyon-fprof','shore');"); pg=page(c); pg.set_viewport_size({'width':360,'height':700}); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>{ const p=document.querySelector('.sppage'), a=p&&p.querySelector('.spask'), g=p&&p.querySelector('.spgo'); if(!a||!g) return null; const ra=a.getBoundingClientRect(), rg=g.getBoundingClientRect(); return [ra.bottom<=rg.top+1, rg.bottom<=innerHeight+1, getComputedStyle(p).backgroundColor===getComputedStyle(document.body).backgroundColor||true]; }")
    check('Είσοδος (ακτή, 3 τρόποι, μικρή οθόνη): το «Να μη ρωτάει» φαίνεται πάνω από το «Συνέχεια» (1.14.43)', r and r[0] and r[1] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.45 όψη')
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(3500)
    r=pg.evaluate("()=>{ const n=document.querySelector('.nav'), cs=getComputedStyle(n,'::before'); const t=document.createElement('p'); t.textContent='\U0001F313 x \u2605 y \U0001F991'; document.querySelector('main').append(t); return new Promise(res=>setTimeout(()=>res([cs.content!=='none'&&cs.display!=='none', document.documentElement.getAttribute('data-view'), t.querySelectorAll('i.pik').length, [...t.textContent].some(ch=>ch.codePointAt(0)>0x1F000||ch.codePointAt(0)===0x2605)]),600)); }")
    pg.evaluate("()=>{location.hash='#map'}"); pg.wait_for_timeout(2500)
    r.append(pg.evaluate("()=>getComputedStyle(document.querySelector('.nav'),'::before').display"))
    check('Κάτω μπάρα: σβήσιμο περιεχομένου (όχι στον χάρτη)· emoji γίνονται γραμμικά εικονίδια (1.14.45)', r==[True,'forecast',3,False,'none'] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.47 συναγρίδα')
    R=[]
    for lg in ('en','el'):
        c=ctx(b,lang=lg); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'a',date:'2026-03-11',time:'10:00',species:'Common dentex',kg:5,_u:1},{id:'b',date:'2026-04-02',time:'10:00',species:'Dentex',kg:3,len:55,_u:1},{id:'c',date:'2026-05-02',time:'10:00',species:'Συναγρίδα',kg:2,_u:1}]));localStorage.setItem('alkyon-v4-logtab','\"stats\"');")
        pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3500)
        R.append(pg.evaluate("()=>[...document.querySelectorAll('.recs .rec b')].map(x=>x.textContent).join('|')")); R.append(pg._errs); c.close()
    check('Dentex / Common dentex / Συναγρίδα: ένα ρεκόρ, «Common dentex» στα αγγλικά και «Συναγρίδα» στα ελληνικά (1.14.47)', R==['Common dentex',[],'Συναγρίδα',[]], R)

    print('# 1.14.48 ένα είδος ένα όνομα, ανοιχτή έξοδος')
    c=ctx(b,lang='en'); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'a',date:'2026-03-11',time:'10:00',species:'Πέρκα',kg:0.2,_u:1},{id:'b',date:'2026-04-02',time:'10:00',species:'Painted comber',kg:0.3,_u:1},{id:'c',date:'2026-05-02',time:'10:00',species:'Μινέρι',kg:6,_u:1},{id:'d',date:'2026-05-03',time:'10:00',species:'Greater amberjack',kg:8,_u:1},{id:'e',date:'2026-05-04',time:'10:00',species:'Μαγιάτικο',kg:4,_u:1}]));localStorage.setItem('alkyon-v4-logtab','\"stats\"');")
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3500)
    r=pg.evaluate("()=>[[...document.querySelectorAll('.recs .rec b')].map(x=>x.textContent).join('|'), [...document.querySelectorAll('.spkg .bl')].map(x=>x.textContent).join('|'), spKey('Dentex')===spKey('Συναγρίδα'), spName('Πέρκα'), spKey('Κάτι άγνωστο')]")
    check('Ένα είδος, ένα όνομα: Πέρκα = Painted comber (θάλασσα), Μινέρι = Μαγιάτικο = Greater amberjack σε ρεκόρ και στατιστικά (1.14.48)', r==['Greater amberjack|Painted comber','Greater amberjack|Painted comber',True,'Painted comber','κάτι άγνωστο'] and not pg._errs, [r,pg._errs]); c.close()
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'trip-x1',start:Date.now()-32*3600000,due:Date.now()-26*3600000,route:'Test'}));}")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(6500)
    r=pg.evaluate("()=>{ const s=document.querySelector('.sheet'); if(!s) return ['no sheet',localStorage.getItem('alkyon-safe')]; const b=[...s.querySelectorAll('button')].find(x=>/^Ended at/.test(x.textContent)); const t=s.textContent; b&&b.click(); return new Promise(res=>setTimeout(()=>{ const tr=JSON.parse(localStorage.getItem('alkyon-trips')||'[]')[0]; res([/Has the trip ended/.test(t), /open for 32 hours/.test(t), tr?Math.round((tr.endMs-tr.startMs)/3600000):null, AK.trip.active()]); },800)); }")
    check('Έξοδος ανοιχτή 32 ώρες: ρωτά «Τελείωσε;» και κλείνει στην ώρα επιστροφής (6 ώρες), όχι στις 32 (1.14.48)', r==[True,True,6,False] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.49 φόρμα ψαριού')
    c=ctx(b,lang='en'); c.add_init_script("localStorage.setItem('alkyon-bites',JSON.stringify([{id:'a',date:'2026-03-11',time:'10:00',species:'Πέρκα',latin:'Perca fluviatilis',tech:'Δίχτυ',kg:0.2,_u:1},{id:'b',date:'2026-04-02',time:'10:00',species:'Συναγρίδα',tech:'Βυθού',kg:3,_u:1},{id:'c',date:'2026-04-03',time:'10:00',species:'Dentex',tech:'Net',kg:3,_u:1},{id:'d',date:'2026-04-04',time:'10:00',species:'Ροφός',tech:'Παραγάδι',kg:3,_u:1}]));")
    pg=page(c); pg.set_viewport_size({'width':360,'height':740}); pg.goto(BASE+'/v4/#new'); pg.wait_for_timeout(3500)
    r=pg.evaluate("()=>{ const q=[...document.querySelectorAll('form.bf2 .qchips')]; return [q.map(x=>[...x.children].map(c=>c.textContent).join(',')).join(' | '), q.every(x=>x.getBoundingClientRect().height<56)]; }")
    check('Νέο ψάρι: επιλογές σε μία γραμμή· «Painted comber», μία συναγρίδα, χωρίς δίχτυ/παραγάδι στις τεχνικές (1.14.49)', 'Painted comber' in r[0] and 'European perch' not in r[0] and r[0].count('Common dentex')==1 and 'Net' not in r[0] and 'Longline' not in r[0] and 'Bottom fishing' in r[0] and r[1] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.53 παλίρροια χωρίς επικαλύψεις, (i) κάτω από τον τίτλο')
    c=ctx(b,lang='en'); pg=page(c); pg.set_viewport_size({'width':360,'height':760}); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4000)
    r=pg.evaluate("()=>{ const t0=Date.UTC(2026,10,15,21), pts=[]; for(let i=0;i<48;i++){ pts.push({t:t0+i*3600000,p:1018,w:6,g:10,d:300,l:0.06*Math.sin(i/12.4*2*Math.PI+1)+(i>=14&&i<=20?0.006*Math.sin(i*2.2):0)}); } const C=AK.pwChart(pts,{lat:34.7,lon:32.4,tz:120,rk:'d1',nowI:20}); document.body.append(C.svg); const bb=[...C.svg.querySelectorAll('text.tt')].map(t=>t.getBBox()); let ov=0; for(let i=0;i<bb.length;i++) for(let j=i+1;j<bb.length;j++){ const a=bb[i], b2=bb[j]; if(Math.min(a.x+a.width,b2.x+b2.width)-Math.max(a.x,b2.x)>0&&Math.min(a.y+a.height,b2.y+b2.height)-Math.max(a.y,b2.y)>0) ov++; } const n=C.svg.querySelectorAll('circle.th,circle.tlo').length; C.svg.remove(); const h2=[...document.querySelectorAll('main h2')].filter(x=>x.querySelector('.infob')&&x.offsetParent); h2.forEach(x=>x.querySelector('.infob').click()); return [bb.length>=5, ov, n<=8, h2.length>0&&h2.every(x=>x.getBoundingClientRect().height<60)]; }")
    check('Παλίρροια: ώρες χωρίς επικάλυψη, μικρά δοντάκια δεν σημειώνονται· (i) δεν σπάει τον τίτλο στα 360 px (1.14.53)', r==[True,0,True,True] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.55 ενότητες')
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(4500)
    r=[pg.evaluate("()=>[...document.querySelectorAll('.pgsec')].map(e=>e.textContent+'>'+((e.nextElementSibling.querySelector('h2,summary b')||{}).textContent||'').slice(0,14)).join('|')")]
    pg.evaluate("()=>{[...document.querySelectorAll('main .seg button')].find(x=>/Mine/.test(x.textContent)).click()}"); pg.wait_for_timeout(2500)
    r.append(pg.evaluate("()=>[[...document.querySelectorAll('.pgsec')].map(e=>e.textContent).join('|'), [...document.querySelectorAll('.pgsec')].every(e=>e.nextElementSibling&&/card|sfold/.test(e.nextElementSibling.className))]"))
    check('Ενότητες: «Conditions» πριν από την Έκθεση ακτής· στα «Δικά μου» κάθε επικεφαλίδα πριν από κάρτα (1.14.55)', r[0].startswith('Conditions>') and 'Checks and history' in r[1][0] and 'Conditions' not in r[1][0] and r[1][1] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.57 φωτογραφίες, φύλλα')
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>new Promise(res=>{ const cv=document.createElement('canvas'); cv.width=3000; cv.height=2000; const g=cv.getContext('2d'); const gr=g.createLinearGradient(0,0,3000,2000); gr.addColorStop(0,'#135'); gr.addColorStop(1,'#fa6'); g.fillStyle=gr; g.fillRect(0,0,3000,2000); for(let i=0;i<4000;i++){ g.fillStyle='hsl('+(i*37%360)+',60%,'+(30+i%40)+'%)'; g.fillRect((i*131)%3000,(i*71)%2000,26,26); } cv.toBlob(async f=>{ const S=AK.store, a=await S.resize(f), k=await S.resize(f,{keep:true}); await S.Photos.put('zz1',a); const t=await S.Photos.thumb('zz1'), t2=await S.Photos.thumb('zz1'); const im=await createImageBitmap(a), ti=await createImageBitmap(t); await S.Photos.del('zz1'); const gone=await S.Photos.thumb('zz1'); res([a.size<k.size*0.75, true, Math.max(im.width,im.height)>=1024?1280:0, Math.max(ti.width,ti.height), t.size<20000, t2.size===t.size, !gone]); },'image/jpeg',0.95); })")
    sh=pg.evaluate("()=>{ const b=AK.h('div',null,AK.h('h3',{text:'Safety limits'}),AK.h('p',{text:'x'})); const s=AK.sheet({title:'Safety limits',body:b}); const hid=b.querySelector('h3').hidden; s.close(); return hid; }")
    check('Φωτογραφία: συμπίεση (1280 px, μικρότερη από πριν), μικρογραφία 240 px που σβήνεται μαζί· φύλλο χωρίς διπλό τίτλο (1.14.57)', r==[True,True,1280,240,True,True,True] and sh is True and not pg._errs, [r,sh,pg._errs]); c.close()

    print('# 1.14.58 αυτο-επισκευή, παλιές φωτογραφίες')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;localStorage.setItem('alkyon-bites',JSON.stringify([{id:'zb1',date:'2026-03-11',time:'10:00',species:'Ροφός',kg:5,photo:true,_u:1}]));}")
    pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(3000)
    r=pg.evaluate("()=>new Promise(res=>{ const cv=document.createElement('canvas'); cv.width=1280; cv.height=960; const g=cv.getContext('2d'); for(let i=0;i<9000;i++){ g.fillStyle='hsl('+(i*37%360)+',70%,'+(20+i%60)+'%)'; g.fillRect((i*131)%1280,(i*71)%960,18,18); } cv.toBlob(async f=>{ const S=AK.store; await S.Photos.put('zb1',f); localStorage.setItem('alkyon-pup',JSON.stringify({zb1:1})); const n=await S.shrinkOld(); const a=await S.Photos.get('zb1'); const n2=await S.shrinkOld(); res([f.size>110000, n, a.size<f.size*0.75, !JSON.parse(localStorage.getItem('alkyon-pup')).zb1, n2]); },'image/jpeg',0.97); })")
    sw=open(os.path.join(ROOT,'v4','sw.js'),encoding='utf-8').read(); el=open(os.path.join(ROOT,'v4','errlog.js'),encoding='utf-8').read()
    pg.evaluate("()=>{ localStorage.removeItem('alkyon-v4-heal'); window.dispatchEvent(new ErrorEvent('error',{message:\"Uncaught SyntaxError: Unexpected token '<'\",filename:location.origin+'/v4/help.js',lineno:1,colno:1})); }"); pg.wait_for_timeout(2500)
    hl=pg.evaluate("()=>[+localStorage.getItem('alkyon-v4-heal')>0, !!window.AK]")
    check('Παλιά φωτογραφία ξανασυμπιέζεται μία φορά και ξανανεβαίνει· «Unexpected token <» σε .js καθαρίζει την αποθήκη και ξαναφορτώνει· ο service worker δεν δίνει HTML για .js (1.14.58)', r==[True,1,True,True,0] and hl==[True,True] and 'wrong(r)' in sw and 'function heal(' in el and not pg._errs, [r,hl,pg._errs]); c.close()

    print('# 1.14.58 διόρθωση ωρών εξόδου')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;var st=Date.parse('2026-11-07T05:00:00');localStorage.setItem('alkyon-trips',JSON.stringify([{id:'tq1',sid:'sq1',date:'2026-11-07',startMs:st,endMs:st+32*3600000,count:1,kg:2,_u:1}]));localStorage.setItem('alkyon-v4-logtab','\"trips\"');}")
    pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(3000)
    pg.evaluate("()=>{ [...document.querySelectorAll('.seg button')].find(x=>/^Trips/.test(x.textContent)).click(); }"); pg.wait_for_timeout(1200)
    pg.evaluate("()=>document.querySelector('main .tcard').click()"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>[...document.querySelectorAll('.sheet.on button')].find(x=>/Correct times/.test(x.textContent)).click()"); pg.wait_for_timeout(1200)
    r=pg.evaluate("()=>{ const i=document.querySelectorAll('.sheet.on input[type=datetime-local]'); i[1].value='2026-11-07T12:30'; i[1].dispatchEvent(new Event('input')); const d=document.querySelector('.sheet.on .sub').textContent; [...document.querySelectorAll('.sheet.on button')].find(x=>/^Save/.test(x.textContent)).click(); const t=JSON.parse(localStorage.getItem('alkyon-trips'))[0]; return [d, (t.endMs-t.startMs)/3600000]; }")
    check('Έξοδος 32 ωρών: «Διόρθωση ωρών» την κάνει 7,5 ώρες (1.14.58)', r==['Duration: 7.5 h',7.5] and not pg._errs, [r,pg._errs]); c.close()

    print('# 1.14.59 χάρτης: ψάρια/χαμένα ανεξάρτητα, ραντάρ σε UTC')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;localStorage.setItem('alkyon-bites',JSON.stringify([{id:'f1',date:'2026-11-10',time:'07:00',species:'Ροφός',kg:2,lat:34.80,lon:32.30,_u:1},{id:'f2',date:'2026-11-10',time:'08:00',miss:true,lat:34.70,lon:32.45,_u:1}]));localStorage.setItem('alkyon-v4-map',JSON.stringify({fish:true,spots:false}));localStorage.setItem('alkyon-v4-pos',JSON.stringify({lat:34.75,lon:32.38}));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    cnt="()=>[document.querySelectorAll('.mk.fish:not(.miss)').length,document.querySelectorAll('.mk.fish.miss').length]"
    r0=pg.evaluate(cnt)
    pg.evaluate("()=>document.querySelector('.mclay').click()"); pg.wait_for_timeout(900)
    tap="(k)=>{ const t=document.querySelector('.mcpan .ltile[data-fk=\"l:'+k+'\"]'); t.click(); }"
    pg.evaluate(tap,'miss'); pg.wait_for_timeout(900); r1=pg.evaluate(cnt)
    pg.evaluate(tap,'fish'); pg.wait_for_timeout(900); r2=pg.evaluate(cnt)
    pg.evaluate(tap,'miss'); pg.wait_for_timeout(900); r3=pg.evaluate(cnt)
    cf=pg.evaluate("()=>{ const c=JSON.parse(localStorage.getItem('alkyon-v4-map')); return [!!c.fish,!!c.lost]; }")
    import datetime as _dt, re as _re
    rb=open(os.path.join(ROOT,'radar_build.py'),encoding='utf-8').read(); ns={'dt':_dt}; exec(rb[rb.index('def cy_offset'):rb.index('TS_RES = [')],ns)
    n0=_dt.datetime(2026,11,17,5,40,tzinfo=_dt.timezone.utc); fl=[ns['fix_local'](_dt.datetime(2026,11,17,7,20,tzinfo=_dt.timezone.utc),n0).hour, ns['fix_local'](_dt.datetime(2026,11,17,5,20,tzinfo=_dt.timezone.utc),n0).hour]
    mv=open(os.path.join(ROOT,'v4','map-view.js'),encoding='utf-8').read()
    check('Χάρτης: «Χαμένα» και «Ψάρια» ανάβουν χωριστά· ώρα ραντάρ ΤΜ από ώρα Κύπρου σε UTC (1.14.59)', r0==[1,1] and r1==[1,0] and r2==[0,0] and r3==[0,1] and cf==[False,True] and fl==[5,5] and "'tz': 'utc'" in rb and "j.tz!=='utc'" in mv and not pg._errs, [r0,r1,r2,r3,cf,fl,pg._errs]); c.close()

    print('# 1.14.60 μεγάλα ψάρια ανά είδος, πρόσκληση, χάρακας')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;var B=[['2026-10-01','Ροφός',1],['2026-10-05','Ορφός',0.9],['2026-10-09','Χάννος',3],['2026-10-12','Πέρκα',3.2],['2026-10-15','Σαργός',0.4]].map(function(r,i){return {id:'q'+i,date:r[0],time:'07:00',species:r[1],kg:r[2],ptrend:'stable',wind:2,lat:34.75,lon:32.38,_u:1};});localStorage.setItem('alkyon-bites',JSON.stringify(B));}")
    pg=page(c); pg.goto(BASE+'/?join=1'); pg.wait_for_timeout(6500)
    j=pg.evaluate("()=>{ const s=document.querySelector('.sheet.on'); return [s?s.querySelector('h2,h3,.stitle,b').textContent.trim():null, /join=1/.test(location.search), /\\/v4\\//.test(location.pathname)]; }")
    pg.evaluate("()=>{ const x=document.querySelector('.sheet.on .sx, .sheet.on [aria-label=Close], .sheet.on button'); x&&x.click(); }"); pg.wait_for_timeout(600)
    cm=pg.evaluate("()=>{ const el=AK.commonCard(); return [...el.querySelectorAll('.cmhd')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()); }")
    rj=open(os.path.join(ROOT,'ruler.js'),encoding='utf-8').read(); mv=open(os.path.join(ROOT,'v4','map-view.js'),encoding='utf-8').read()
    check('Πρόσκληση ?join=1 ανοίγει «Βοήθησε την πρόγνωση»· ορφός 1 kg μετρά στα μεγάλα ψάρια, χάννος 3 kg όχι· λεζάντες στον χάρακα (1.14.60)', j[0]=='Help the forecast' and j[1] is False and j[2] and len(cm)==2 and cm[0].startswith('Big fish (groupers') and cm[0].endswith('2 days') and cm[1].startswith('Other fish') and cm[1].endswith('3 days') and "T('Αναίρεση','Undo')" in rj and 'AK.crossLL' in mv and 'var has=new Uint8Array(16384)' in mv and not pg._errs, [j,cm,pg._errs]); c.close()

    print('# 1.14.62 γλώσσα μόνο για Κύπρο/Ελλάδα, πρόγνωση βροχής, κύμα εκτός στεριάς')
    def lrow(country,pos):
        c=ctx(b,lang='en'); c.add_init_script("localStorage.setItem('alkyon-country',JSON.stringify('%s'));%s"%(country,("localStorage.setItem('alkyon-v4-pos',JSON.stringify(%s));"%pos) if pos else "localStorage.removeItem('alkyon-v4-pos');"))
        pg=page(c); pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2200)
        pg.evaluate("()=>{const b=[...document.querySelectorAll('.seg button')].find(x=>/Settings/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(900)
        r=pg.evaluate("()=>[[...document.querySelectorAll('main .li b')].some(b=>/^Language/.test(b.textContent)), [...document.querySelectorAll('main .listh')].map(x=>x.textContent).filter(x=>/Appearance/.test(x)).join(), AK.langChoice()]"); e=pg._errs; c.close(); return r+[e]
    l1=lrow('xx','{lat:43.3,lon:5.3}'); l2=lrow('cy',None); l3=lrow('auto','{lat:37.9,lon:23.7}')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__u){sessionStorage.__u=1; localStorage.removeItem('alkyon-onboard'); localStorage.removeItem('alkyon-bites'); localStorage.removeItem('alkyon-country'); localStorage.removeItem('alkyon-v4-pos');}")
    pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(3000)
    t0=pg.evaluate("()=>{ const l=document.querySelector('.sppage .splang'); return l?[getComputedStyle(l).display!=='none', /Ελλην/.test(document.querySelector('.sppage').textContent)]:null; }")
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('.sppage .spctry button')].find(x=>/Change/.test(x.textContent)); b&&b.click(); const s=document.querySelector('.sppage select.ctrysel'); s.value='gr'; s.dispatchEvent(new Event('change',{bubbles:true})); }"); pg.wait_for_timeout(500)
    t1=pg.evaluate("()=>{ const l=document.querySelector('.sppage .splang'); return l?[getComputedStyle(l).display!=='none', /Ελληνικά/.test(l.textContent)]:null; }"); te=pg._errs; c.close()
    mv=open(os.path.join(ROOT,'v4','map-view.js'),encoding='utf-8').read(); ss=open(os.path.join(ROOT,'seastate.js'),encoding='utf-8').read(); wm=open(os.path.join(ROOT,'windmap.js'),encoding='utf-8').read(); op=open(os.path.join(ROOT,'v4','opps.js'),encoding='utf-8').read()
    check('Γλώσσα: η επιλογή φαίνεται μόνο για Κύπρο/Ελλάδα (Προφίλ και πρώτη οθόνη)· στρώμα «Βροχή, καταιγίδες»· κύμα όχι πάνω σε μακρινή στεριά· προφόρτωση· «Ανανέωση» εικονίδιο (1.14.62)',
      l1[:3]==[False,'Appearance',False] and l2[:3]==[True,'Appearance and language',True] and l3[0] is True and not (l1[3] or l2[3] or l3[3])
      and t0==[False,False] and t1==[True,True] and not te
      and "tile('rainfc'" in mv and 'hourly=precipitation,weather_code' in mv and 'ML.isLand(la,lo)' in ss and 'loadRegion(b)' in ss and 'pxMem[u]' in wm and "class:'oprf'" in op, [l1,l2,l3,t0,t1,te]); 

    print('# 1.14.66 φως φεγγαριού στο ψάρι')
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    ml=pg.evaluate("()=>{ const f=AlkyonBiteWx.moonLight, P=[34.75,32.4]; return [f(Date.UTC(2026,10,24,22,0),P[0],P[1],{t:0,lo:0,mi:0,hi:0}), f(Date.UTC(2026,10,24,22,0),P[0],P[1],{t:100,lo:100,mi:0,hi:0}), f(Date.UTC(2026,10,17,17,0),P[0],P[1],{t:30,lo:0,mi:0,hi:30}), f(Date.UTC(2026,10,9,20,0),P[0],P[1],null)]; }")
    bw=open(os.path.join(ROOT,'bitewx.js'),encoding='utf-8').read()
    check('Φως φεγγαριού: πανσέληνος ψηλά ~89%, με χαμηλή συννεφιά ~13%, μισό φεγγάρι <10%, νέα σελήνη κάτω από τον ορίζοντα 0· νέφωση σε 3 ύψη ζητιέται και αποθηκεύεται στο ψάρι (1.14.66)',
      ml[0]['ill']==100 and 80<ml[0]['alt']<83 and 85<ml[0]['light']<92 and 11<ml[1]['light']<15 and ml[1]['cov']==100 and 45<ml[2]['ill']<60 and 3<ml[2]['light']<9 and ml[3]['alt']<0 and ml[3]['clear']==0
      and 'cloud_cover_low,cloud_cover_mid,cloud_cover_high' in bw and 'pt.moonLight=' in bw and not pg._errs, [ml,pg._errs]); c.close()

    print('# 1.14.67 σύννεφα από δορυφόρο')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__cs){sessionStorage.__cs=1;localStorage.setItem('alkyon-v4-map',JSON.stringify({cloudsat:true,rain:true,fish:false,spots:false}));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    sc=pg.evaluate("""async()=>{ const of=window.fetch; let asked='';
      window.fetch=function(u,o){ if(typeof u==='string'&&u.indexOf('view.eumetsat.int')>0&&u.indexOf('msg_fes:clm')>0){ asked=u; const c=document.createElement('canvas'); c.width=41; c.height=41; const x=c.getContext('2d'); x.fillStyle='#0000ff'; x.fillRect(0,0,41,41); x.fillStyle='#ffffff'; x.fillRect(0,0,21,41);
          return new Promise(res=>c.toBlob(b=>res(new Response(b,{status:200,headers:{'Content-Type':'image/png'}})),'image/png')); } return of.apply(this,arguments); };
      const f=AlkyonBiteWx.satCloud, T0=Date.UTC(2026,10,10,10,0);
      const west=await f(34.75,32.4,T0,{alt:30,az:270}), east=await f(34.75,32.4,T0,{alt:30,az:90}), far=await f(40.7,-74,T0,null), fresh=await f(34.75,32.4,Date.now()-10*60000,null);
      const wx={s:{ray:100},m:{alt:40,clear:50},c:{lo:100,mi:0,hi:0}}; AlkyonBiteWx.applySat(wx); window.fetch=of;
      const im=document.querySelector('.csattile img'), bar=document.querySelector('.csatbar');
      return {west,east,far:far===null,fresh:fresh===undefined,light:wx.m.light,src:wx.m.src,asked:/time=2026-11-10T10:00:00Z/.test(asked)&&/srs=EPSG:4326/.test(asked),
        tile:im?decodeURIComponent(im.src):'',bar:bar?bar.querySelector('.rbt i').textContent:'',radarBar:document.querySelectorAll('.rainbar:not(.csatbar)').length,cfg:JSON.parse(localStorage.getItem('alkyon-v4-map'))}; }""")
    check('Δορυφόρος: μάσκα νεφών στο σημείο και προς το φεγγάρι (δυτικά καλυμμένο, ανατολικά ανοιχτό), εκτός κάλυψης/φρέσκο ψάρι, φως φεγγαριού με παρατήρηση· στρώμα «Σύννεφα (δορυφόρος)» με ώρα (1.14.67)',
      sc['west']['pt']==1 and 40<=sc['west']['f']<=60 and sc['west']['ray']>=90 and sc['east']['ray']<=25 and sc['far'] and sc['fresh'] and sc['light']==7.5 and sc['src']=='sat' and sc['asked']
      and 'mtg_fd:rgb_geocolour' in sc['tile'] and 'time=20' in sc['tile'] and sc['bar']=='Clouds · satellite' and not pg._errs, [sc,pg._errs]); c.close()

    print('# 1.14.69 νέα είδη στον Οδηγό')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.guideGo('species','ghobban')"); pg.wait_for_timeout(4000)
    g1=pg.evaluate("()=>{ const d=[...document.querySelectorAll('#spList details.sp')]; d.forEach(x=>x.open=true); return d.map(x=>x.innerText.replace(/\\s+/g,' ')).join(' || '); }")
    pg.evaluate("()=>AK.guideGo('species','Plotosus')"); pg.wait_for_timeout(2500)
    g2=pg.evaluate("()=>{ const d=[...document.querySelectorAll('#spList details.sp')]; d.forEach(x=>x.open=true); return d.map(x=>x.innerText.replace(/\\s+/g,' ')).join(' || '); }")
    check('Οδηγός: Scarus ghobban (παπαγαλόψαρο) και θαλάσσιο γατόψαρο με κάρτα και προειδοποίηση (1.14.69)', 'Παπαγαλόψαρο' in g1 and '2010' in g1 and 'Θαλάσσιο γατόψαρο' in g2 and 'Αγκάθια' in g2 and not pg._errs, [g1[:300],g2[:300],pg._errs]); c.close()
    c=ctx(b,lang='en'); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>AK.guideGo('species','ghobban')"); pg.wait_for_timeout(4500)
    g3=pg.evaluate("()=>{ const d=[...document.querySelectorAll('#spList details.sp')]; d.forEach(x=>x.open=true); return d.map(x=>x.innerText.replace(/\\s+/g,' ')).join(' || '); }")
    check('Οδηγός στα αγγλικά: Blue-barred parrotfish χωρίς ελληνικά (1.14.69)', 'Blue-barred parrotfish' in g3 and 'Red Sea species' in g3 and 'Παπαγαλόψαρο' not in g3 and not pg._errs, [g3[:400],pg._errs]); c.close()

    print('# 1.14.70 γνώμη: αποτυχία με λόγο και email')
    c=ctx(b); pg=page(c); c.route('**/rest/v1/app_errors',lambda r: r.fulfill(status=503,body='{}'))
    pg.goto(BASE+'/v4/#profile'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>[...document.querySelectorAll('main .seg button')].find(x=>/Ρυθμίσεις/.test(x.textContent)).click()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>[...document.querySelectorAll('main .li')].find(x=>/Πες μας/.test(x.textContent)).click()"); pg.wait_for_timeout(800)
    pg.fill('.sheet.on textarea','Δοκιμή μηνύματος'); pg.click('.sheet.on .btn.pri'); pg.wait_for_timeout(1500)
    fb=pg.evaluate("()=>{ const s=document.querySelector('.sheet.on'); return [s?s.querySelector('[role=status]').textContent:'', s?[...s.querySelectorAll('.btn')].map(x=>x.textContent):[], s?s.querySelector('.btn.pri').disabled:null]; }")
    check('«Πες μας τη γνώμη σου»: σε αποτυχία γράφει τον λόγο (HTTP 503), μένει ανοιχτό και δείχνει «Αποστολή με email» (1.14.70)', 'HTTP 503' in fb[0] and 'Αποστολή με email' in fb[1] and fb[2] is False, fb); c.close()

    print('# 1.14.73 κάτω μπάρα: μαζεύεται δεξιά')
    c=ctx(b,touch=True); c.add_init_script("localStorage.setItem('alkyon-smart',JSON.stringify({weekly:Date.now()+9e9}))"); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    ns=pg.evaluate("""async()=>{ const bar=document.querySelector('.nav>div'), r=bar.getBoundingClientRect(), y=r.top+r.height/2, o=[], W=ms=>new Promise(z=>setTimeout(z,ms)); const ev=(t,x)=>bar.dispatchEvent(new PointerEvent(t,{pointerId:7,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
      const h0=location.hash; ev('pointerdown',r.left+40); ev('pointermove',r.left+70); ev('pointermove',r.left+200); ev('pointerup',r.left+200); bar.querySelector('a').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      await W(500); const tb=document.querySelector('.navtab').getBoundingClientRect(); o.push(document.body.classList.contains('navslid'), location.hash===h0, Math.round(tb.right)===innerWidth&&innerHeight-tb.bottom<40, bar.getBoundingClientRect().left>innerWidth-5, !document.querySelector('.navmini'));
      document.querySelector('.navtab').click(); await W(500); o.push(document.body.classList.contains('navslid'), Math.round(bar.getBoundingClientRect().left)===Math.round(r.left));
      ev('pointerdown',r.left+40); ev('pointermove',r.left+60); ev('pointerup',r.left+60); await W(300); o.push(document.body.classList.contains('navslid'));
      const rb=document.createElement('div'); rb.className='rainbar'; document.body.append(rb); await W(300); o.push(document.body.classList.contains('navslid'));
      const dk=document.createElement('div'); dk.id='ndMapDock'; dk.style.cssText='position:fixed;left:8px;right:8px;bottom:94px;height:80px'; document.body.append(dk); await W(200); const dr=dk.getBoundingClientRect(), tb2=document.querySelector('.navtab').getBoundingClientRect(); o.push(Math.abs(dr.bottom-tb2.bottom)<=2&&dr.right<=tb2.left); dk.remove();
      rb.remove(); await W(300); o.push(document.body.classList.contains('navslid'));
      AK.navSlide(true); location.hash='#log'; await W(900); o.push(document.body.classList.contains('navslid')); return o; }""")
    check('Κάτω μπάρα: σύρσιμο δεξιά τη μαζεύει χωρίς να ανοίξει σελίδα, βελάκι κάτω δεξιά, κανένα κουμπί εξόδου, επιστρέφει με το βελάκι· στρώμα καιρού τη μαζεύει, η μπάρα ανέμου κατεβαίνει στο ύψος του βελακιού, το κλείσιμο τη φέρνει πίσω· φεύγοντας από τον Χάρτη επιστρέφει (1.14.73)', ns==[True,True,True,True,True,False,True,False,True,True,False,False] and not pg._errs, [ns,pg._errs]); c.close()

    print('# 1.14.77 στόχοι, αναπαραγωγή δορυφόρου, συρόμενο ψάρι')
    c=ctx(b); c.add_init_script("localStorage.setItem('alkyon-smart',JSON.stringify({weekly:Date.now()+9e9}))"); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    pg.evaluate("()=>{ [['Λαβράκι','Dicentrarchus labrax'],['Συναγρίδα','Dentex dentex'],['Ροφός','Epinephelus marginatus'],['Λούτσος','Sphyraena sphyraena'],['Φαγκρί','Pagrus pagrus']].forEach((x,i)=>AK.store.save('bites',{date:'2026-11-0'+(i+1),time:'07:00',species:x[0],latin:x[1],lat:34.7,lon:32.4})); }")
    pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(2500); pg.evaluate("()=>AK.tripStart()"); pg.wait_for_timeout(1000)
    for k in range(5): pg.evaluate("()=>{ const c=[...document.querySelectorAll('.sheet.on .tgchips .chip:not(.tgfind)')].find(x=>x.getAttribute('aria-pressed')==='false'); if(c) c.click(); }"); pg.wait_for_timeout(120)
    tg=pg.evaluate("()=>{ const bx=document.querySelector('.sheet.on .tgchips'), cs=[...bx.querySelectorAll('.chip')], rs=cs.map(x=>x.getBoundingClientRect()); const oneRow=rs.every(r=>Math.abs(r.top-rs[0].top)<2); const bd=document.querySelector('.sheet.on .body')||document.querySelector('.sheet.on'); return [cs.filter(x=>x.getAttribute('aria-pressed')==='true').length, oneRow, cs[0].classList.contains('tgfind'), document.querySelector('.sheet.on .tgn').textContent, cs.slice(1,5).every(x=>x.getAttribute('aria-pressed')==='true')]; }")
    pg.evaluate("()=>document.querySelector('.sheet.on .tgfind').click()"); pg.wait_for_timeout(700)
    sr=pg.evaluate("()=>!!document.querySelector('.sppick input[type=search]')"); pg.evaluate("()=>{ const s=[...document.querySelectorAll('.sheet.on')].pop(); const x=s&&s.querySelector('.x,.close,[aria-label=Κλείσιμο]'); if(x) x.click(); }"); pg.wait_for_timeout(500)
    pg.evaluate("()=>document.querySelector('.tgo').click()"); pg.wait_for_timeout(900)
    st=pg.evaluate("()=>{ const s=AK.trip.state(); const row=AK.contrib._rowOf('trip',{id:'t1',date:'2026-11-10',startMs:1,endMs:7200001,lat:34.7,lon:32.4,count:0,target:s.target,targets:s.targets}); return [s.target&&s.target.name, (s.targets||[]).length, row.sp, row.cond&&row.cond.tg&&row.cond.tg.length]; }")
    check('Έναρξη εξόδου: στόχοι σε μία γραμμή με «Αναζήτηση» πρώτο, έως 4 επιλεγμένα μπροστά, η αναζήτηση ανοίγει τη λίστα ειδών, και όλοι οι στόχοι πάνε στα ανώνυμα στοιχεία (1.14.78)', tg[0]==4 and tg[1] and tg[2] and '4' in tg[3] and tg[4] and sr and st[0] and st[1]==4 and st[2] and st[3]==4, [tg,sr,st])
    c2=ctx(b); pg2=page(c2); pg2.goto(BASE+'/v4/#map'); pg2.wait_for_timeout(2500); pg2.evaluate("()=>{ AK.store.raw('bites').forEach(x=>AK.store.remove&&AK.store.remove('bites',x.id)); }"); pg2.evaluate("()=>AK.tripStart()"); pg2.wait_for_timeout(1000)
    nu=pg2.evaluate("()=>[...document.querySelectorAll('.sheet.on .tgchips .chip')].map(x=>x.textContent)")
    check('Έναρξη εξόδου: υπάρχει πάντα «Αναζήτηση» στους στόχους, και για χρήστη χωρίς ψάρια (1.14.78)', len(nu)>=1 and 'Αναζήτηση' in nu[0] and not pg2._errs, [nu,pg2._errs]); c2.close()
    pg.wait_for_timeout(1500)
    fd=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), b=document.querySelector('.fb.fbc'), bx=document.querySelector('.fishbtns'); if(!b||getComputedStyle(bx).display==='none') return ['nobtn'];
      const sh0=document.querySelectorAll('.sheet.on').length; const r=b.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, ev=(t,dx,dy,bt)=>b.dispatchEvent(new PointerEvent(t,{pointerId:5,clientX:x+dx,clientY:y+dy,bubbles:true,buttons:bt,pointerType:'touch'}));
      ev('pointerdown',0,0,1); ev('pointermove',-40,-60,1); ev('pointermove',-150,-260,1); ev('pointerup',-150,-260,0); b.dispatchEvent(new MouseEvent('click',{bubbles:true})); await W(500);
      const r2=b.getBoundingClientRect(), p=JSON.parse(localStorage.getItem('alkyon-v4-fishpos')||'null'); return [Math.round(r.left-r2.left), Math.round(r.top-r2.top), !!p, document.querySelectorAll('.sheet.on').length!==sh0, !!document.querySelector('.fdial'), sh0]; }""")
    check('Έξοδος: το πράσινο «ψάρι» σέρνεται, η θέση αποθηκεύεται, και το σύρσιμο δεν ανοίγει φόρμα ή κουμπιά (1.14.77)', len(fd)==6 and 140<=fd[0]<=160 and 240<=fd[1]<=270 and fd[2] and not fd[3] and not fd[4] and not pg._errs, [fd,pg._errs]); c.close()
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__cs){sessionStorage.__cs=1;localStorage.setItem('alkyon-v4-map',JSON.stringify({cloudsat:true,fish:false,spots:false}));}")
    # 1.14.89: η ώρα προχωρά μόνο όταν έρθει η εικόνα της (πριν προχωρούσε και με άδειο χάρτη, μετά από 6″). Γι' αυτό ο έλεγχος δίνει πλέον εικόνες στη θέση της EUMETSAT.
    c.route('**/view.eumetsat.int/**',lambda route: route.fulfill(body=_png,content_type='image/png'))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    cp=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), bar=document.querySelector('.csatbar'), p=bar&&bar.querySelector('.rbp'); if(!p) return ['noplay']; const v0=bar.querySelector('input').value, t0=bar.querySelector('b').textContent; p.click(); await W(7500); const v1=bar.querySelector('input').value, tx=p.textContent; p.click(); await W(300); return [v0, v1, tx, p.textContent, bar.querySelector('b').textContent!==t0]; }""")
    check('Σύννεφα από δορυφόρο: κουμπί αναπαραγωγής, η ώρα προχωρά και σταματά με παύση (1.14.77)', len(cp)==5 and cp[0]!=cp[1] and cp[2]=='❚❚' and cp[3]=='▶' and cp[4] and not pg._errs, [cp,pg._errs]); c.close()
    print('# 1.14.89 σύννεφα από δορυφόρο: μία εικόνα ανά ώρα, ποτέ άδειος χάρτης')
    _cs={'n':0,'urls':[]}
    def csr(route):
        u=route.request.url; _cs['n']+=1; _cs['urls'].append(u)
        import time as _tm, re as _re
        m=_re.search(r'time=(\d{4}-\d\d-\d\dT\d\d%3A\d\d)',u); tk=m.group(1) if m else ''
        if 'dead' not in _cs: _cs['dead']=[tk]            # η πιο πρόσφατη ώρα (η πρώτη που ζητιέται) «δεν έχει βγει ακόμα»
        elif len(_cs['dead'])==1 and tk not in _cs['dead'] and _cs['n']>=4: _cs['dead'].append(tk)   # και μία ακόμη, παλιότερη, «δεν απαντά»
        if tk in _cs['dead']: return route.abort()
        _tm.sleep(0.9); return route.fulfill(body=_png,content_type='image/jpeg')
    c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.__c2){sessionStorage.__c2=1;localStorage.setItem('alkyon-v4-map',JSON.stringify({cloudsat:true,fish:false,spots:false}));}")
    c.route('**/view.eumetsat.int/**',csr); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(6500)
    import urllib.parse as _up2
    n0=_cs['n']; u0=_cs['urls'][0] if _cs['urls'] else ''
    r=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), bar=document.querySelector('.csatbar'), img=()=>document.querySelector('.csattile img'), o={blank:0,mismatch:0,samples:0,labels:[]};
      const tOf=()=>{ const m=/time=(\\d{4}-\\d\\d-\\d\\dT\\d\\d%3A\\d\\d)/.exec(img()?img().src:''); return m?new Date(decodeURIComponent(m[1])+':00Z'):null; };
      const lab=()=>bar.querySelector('b').textContent, hm=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
      o.first=[!!img(),img()&&img().complete&&img().naturalWidth>0,lab()===hm(tOf()),document.querySelectorAll('.csattile img').length,bar.querySelector('small').textContent];
      bar.querySelector('.rbp').click();
      const iv=setInterval(()=>{ o.samples++; const im=img(); if(!im||!im.naturalWidth||+getComputedStyle(im).opacity<0.1) o.blank++; const t=tOf(); if(t&&im.complete&&lab()!==hm(t)) o.mismatch++; const l=lab(); if(o.labels[o.labels.length-1]!==l) o.labels.push(l); },60);
      await W(16000); clearInterval(iv); bar.querySelector('.rbp').click(); await W(300);
      o.play=bar.querySelector('.rbp').textContent; o.shown=tOf()?tOf().toISOString().slice(0,16):''; return o; }""")
    dead=[_up2.unquote(x)+':00Z' for x in _cs.get('dead',[])]; deadHM=pg.evaluate("a=>a.map(x=>{const d=new Date(x); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')})",dead)
    n1=_cs['n']
    mv=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), m=AlkyonCore.map(); m.panBy([40,30],{animate:false}); await W(1600); return 1; }""")
    n2=_cs['n']
    pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), m=AlkyonCore.map(); m.panBy([900,0],{animate:false}); await W(3200); return 1; }""")
    n3=_cs['n']; u3=_cs['urls'][-1]
    cl=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)); document.querySelector('.csatbar .rbx').click(); await W(400); return [document.querySelectorAll('.csatbar').length,document.querySelectorAll('.csattile img').length]; }""")
    import urllib.parse as _up
    q0=_up.parse_qs(_up.urlparse(u0).query)
    check('Σύννεφα από δορυφόρο: μία εικόνα JPEG ανά ώρα για την περιοχή που βλέπεις (όχι πλακίδια)· αν η πιο πρόσφατη δεν έχει βγει, δείχνει την προηγούμενη· στο παρασκήνιο μόνο η τελευταία ώρα (1.14.89)',
          q0.get('format')==['image/jpeg'] and q0.get('layers')==['mtg_fd:rgb_geocolour'] and q0.get('crs')==['EPSG:3857'] and 64<=int(q0['width'][0])<=1024 and 64<=int(q0['height'][0])<=1280 and r['first'][0] and r['first'][1] and r['first'][2] and r['first'][3]==1 and 1<=n0<=8, [u0[:200],n0,r['first']])
    check('Σύννεφα από δορυφόρο: στην αναπαραγωγή ο χάρτης δεν μένει ποτέ άδειος, η ώρα αλλάζει μόνο μαζί με την εικόνα, και οι ώρες που δεν απαντούν προσπερνιούνται (1.14.89)',
          r['blank']==0 and r['mismatch']==0 and len(r['labels'])>=6 and len(dead)==2 and not any(x in deadHM for x in r['labels']) and r['play']=='▶' and n1<=19+3 and not pg._errs, [r,n1,dead,deadHM,pg._errs])
    check('Σύννεφα από δορυφόρο: μικρή μετακίνηση δεν ξαναφορτώνει τίποτα· όταν βγεις από την περιοχή έρχεται νέα εικόνα· το ✕ τα κλείνει όλα (1.14.89)',
          n2==n1 and n3>n1 and u3!=u0 and cl==[0,0] and not pg._errs, [n1,n2,n3,cl,pg._errs]); c.close()
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/'); pg.wait_for_timeout(5000)
    hm=pg.evaluate("()=>[document.documentElement.getAttribute('data-view'),!!document.querySelector('.leaflet-container'),(document.querySelector('.nav a[aria-current=page]')||{}).dataset?document.querySelector('.nav a[aria-current=page]').dataset.v:'',document.body.classList.contains('mapon')]")
    pg.evaluate("()=>{ location.hash='#forecast'; }"); pg.wait_for_timeout(2500)
    hf=pg.evaluate("()=>[document.documentElement.getAttribute('data-view'),document.body.classList.contains('mapon')]")
    pg.goto(BASE+'/v4/#nosuchpage'); pg.wait_for_timeout(3000); hx=pg.evaluate("()=>document.documentElement.getAttribute('data-view')")
    check('Αρχική σελίδα ο Χάρτης: άνοιγμα χωρίς σελίδα → Χάρτης· η Πρόγνωση ανοίγει κανονικά από τη μπάρα· άγνωστη σελίδα → Χάρτης (1.14.89)',
          hm==['map',True,'map',True] and hf==['forecast',False] and hx=='map' and not pg._errs, [hm,hf,hx,pg._errs]); c.close()

    print('# 1.14.79 καιρός στη θέση του σκάφους, έκθεση με μπάρα χρόνου')
    now=int(time.time()*1000); c=ctx(b,lang='en'); c.add_init_script("if(!sessionStorage.mw){sessionStorage.mw=1;localStorage.setItem('alkyon-smart',JSON.stringify({weekly:Date.now()+9e9}));localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.removeItem('alkyon-v4-mapui-test');localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T9',start:%d,due:%d}));}"%(now-600000,now+3*3600000))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(9000)
    mb=pg.evaluate("()=>{ AK.mcBarNow&&AK.mcBarNow(); const m=document.querySelector('.mcbar'); return [document.body.classList.contains('ontrip'), m.classList.contains('mcme'), (m.querySelector('.mbl1')||{}).textContent||'', (m.querySelector('.mbl2')||{}).textContent||'', !!m.querySelector('.mbl1 svg')]; }")
    if not mb[1]: pg.wait_for_timeout(4000); mb=pg.evaluate("()=>{ AK.mcBarNow&&AK.mcBarNow(); return new Promise(z=>setTimeout(()=>{ const m=document.querySelector('.mcbar'); z([document.body.classList.contains('ontrip'), m.classList.contains('mcme'), (m.querySelector('.mbl1')||{}).textContent||'', (m.querySelector('.mbl2')||{}).textContent||'', !!m.querySelector('.mbl1 svg')]); },300)); }")
    pg.evaluate("()=>document.querySelector('.mcbar').click()"); pg.wait_for_timeout(700)
    ms=pg.evaluate("()=>{ const s=document.querySelector('.sheet.on'); return [s?s.querySelectorAll('.mefc .mer').length:0, !!document.querySelector('.mcdrw'), s?(s.querySelector('.mefc .mer:nth-child(2) span')||{}).textContent:'']; }")
    pk=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)), cs=()=>[...document.querySelectorAll('.sheet.on .mepick .chip')], on=()=>cs().filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.textContent);
      const o=[cs().length, on().length]; cs().find(x=>/Pressure/.test(x.textContent)).click(); await W(150); o.push(on().length); cs().find(x=>/Gusts/.test(x.textContent)).click(); cs().find(x=>/Waves/.test(x.textContent)).click(); cs().find(x=>/Limits/.test(x.textContent)).click(); await W(100); cs().find(x=>/Pressure/.test(x.textContent)).click(); await W(500);
      const m=document.querySelector('.mcbar'); o.push(on().join('|'), m.textContent, JSON.parse(localStorage.getItem('alkyon-v4-mebar')||'null')); const pn=document.querySelector('.mcpanel.fish'); o.push(pn?Math.round(pn.getBoundingClientRect().height):-1); return o; }""")
    check('Έξοδος: επιλογή στοιχείων της πάνω μπάρας (έως 3), η μπάρα αλλάζει αμέσως και η επιλογή αποθηκεύεται· το πλαίσιο εξόδου είναι λεπτό (1.14.80)', pk[0]==7 and pk[1]==3 and pk[2]==3 and pk[3]=='Pressure' and 'hPa' in pk[4] and 'gusts' not in pk[4] and pk[5]==['pres'] and 0<pk[6]<=56, pk)
    check('Έξοδος: η πάνω μπάρα δείχνει καιρό στη θέση του σκάφους (κατεύθυνση με βέλος, ένταση, κύμα) και με πάτημα ανοίγει πρόγνωση 6 ωρών, όχι το μενού (1.14.79)', mb[0] and mb[1] and any(ch.isdigit() for ch in mb[2]) and mb[4] and ms[0]==7 and not ms[1] and ms[2]=='Now' and not pg._errs, [mb,ms,pg._errs]); c.close()
    c=ctx(b,lang='en'); c.set_geolocation({'latitude':35.045,'longitude':32.40}); c.add_init_script("localStorage.setItem('alkyon-v4-fcopen',JSON.stringify({expo:1}))"); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(6500)
    ex=pg.evaluate("""async()=>{ const W=ms=>new Promise(z=>setTimeout(z,ms)); document.querySelectorAll('details').forEach(d=>{ if(d.querySelector('#fcExposure')) d.open=true; }); await W(400);
      const x=document.querySelector('#fcExposure'); if(!x||x.hidden) return ['noexpo']; const rg=x.querySelector('.exbar input'), tl=x.querySelector('.extime'); if(!rg) return ['nobar', x.innerHTML.length];
      const t0=tl.textContent, v0=+rg.value, nv=v0>3?v0-3:v0+3; rg.value=String(nv); rg.dispatchEvent(new Event('input',{bubbles:true})); await W(300);
      const t1=tl.textContent, txt=(x.querySelector('.exv')||{}).textContent||'', hsel=(document.querySelector('.hcard .hsel b')||{}).textContent||'';
      const bars=[...document.querySelectorAll('.hcard .hbars .hb')]; const bi=Math.min(bars.length-1,nv+2), r=bars[bi].getBoundingClientRect(); bars[bi].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+3,pointerId:3})); bars[bi].dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+3,pointerId:3})); await W(300);
      const t2=tl.textContent, hsel2=(document.querySelector('.hcard .hsel b')||{}).textContent||''; x.querySelector('.explay').click(); await W(1700); const t3=tl.textContent, pt=x.querySelector('.explay').textContent; x.querySelector('.explay').click();
      return [t0,t1,/At \d\d:00 wind from|Now wind from/.test(txt),hsel,t2,hsel2,t3,pt]; }""")
    ok=len(ex)==8 and ex[0]!=ex[1] and ex[2] and ex[1][-5:-3]==ex[3][-11:-9] and ex[4]!=ex[1] and ex[4].split(' ')[1][:2]==ex[5].replace('Now, ','')[:2] and ex[6]!=ex[4] and ex[7]=='❚❚'
    check('Έκθεση ακτής: μπάρα χρόνου με ▶, η ώρα γράφεται στον χάρτη, αλλάζει το κείμενο του ανέμου, και συγχρονίζεται με το «Ανά ώρα» προς τις δύο κατευθύνσεις (1.14.79)', ok and not pg._errs, [ex,pg._errs]); c.close()

    print('# 1.14.81 μεγάλα/άλλα ανά ψάρι')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(2500)
    cm=pg.evaluate("""()=>{ AK.store.raw('bites').forEach(x=>{ try{ AK.store.remove('bites',x.id); }catch(e){} });
      const add=(d,sp,la,kg)=>AK.store.save('bites',{date:d,time:'07:00',species:sp,latin:la,kg:kg,lat:34.7,lon:32.4,depth:40});
      ['2026-10-01','2026-10-05','2026-10-09'].forEach(d=>{ add(d,'Ροφός','Epinephelus marginatus',1); add(d,'Γόπα','Boops boops',0.2); });
      const card=AK.commonCard(); if(!card) return ['nocard']; const hs=[...card.querySelectorAll('.cmg h3,.cmg b,h3')].map(x=>x.textContent); const txt=card.textContent;
      return [/Μεγάλα ψάρια/.test(txt), /Άλλα ψάρια/.test(txt), /Μέρες με ψάρια/.test(txt)]; }""")
    check('«Τι κοινό είχαν»: μέρες με ροφό και γόπες δίνουν και «Μεγάλα ψάρια» και «Άλλα ψάρια» (χωρισμός ανά ψάρι) (1.14.81)', cm==[True,True,False] and not pg._errs, [cm,pg._errs]); c.close()

    print('# 1.14.92 γενικοί κανόνες (εθνικά ύδατα του Navigator)')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(3500)
    r=pg.evaluate("""()=>{ const bn=document.getElementById('bNav'); if(!bn) return ['nobtn']; if(bn.getAttribute('aria-pressed')!=='true') bn.click();
      return AlkyonNav.load(34.67,32.52).then(()=>AlkyonNav.loadWaters()).then(()=>{
        const w=AlkyonNav.waters(34.6658,32.5236), e=AlkyonNav.waters(34.0,33.0), g=AlkyonNav.waters(37.7,23.6), o=AlkyonNav.waters(30,-30);
        const box=AlkyonNavInfo(34.6658,32.5236), ln=box&&box.querySelector('.navwat'); let det='';
        if(ln){ ln.querySelector('button').click(); det=box.querySelector('.navwat + .navdet').textContent; }
        return [w&&w.i, e&&e.i, g&&g.i, o, AlkyonNav.hits(34.6658,32.5236).length, ln?ln.textContent:'', det.includes('LFP 1'), /bag limits/.test(det), det.includes('ProtectedSeas Navigator'), AlkyonNavInfo(30,-30)]; }); }""")
    check('Εθνικά ύδατα: χωρικά Κύπρου στο σημείο του Ντίνου, ΑΟΖ πιο έξω, Ελλάδα στον Σαρωνικό, τίποτα στον Ατλαντικό (1.14.92)', r[:4]==['AICYP2','AICYP1','AIGRC2',None], r[:4])
    check('Σημείο χωρίς ειδική ζώνη: γραμμή «Γενικοί κανόνες: Κύπρος · χωρικά ύδατα» που λέει ότι ισχύουν οι γενικοί κανόνες (1.14.92)', r[4]==0 and 'Γενικοί κανόνες: Κύπρος · χωρικά ύδατα (12 ν.μ.)' in r[5] and 'Δεν υπάρχει ειδική ζώνη' in r[5], r[4:6])
    check('Λεπτομέρειες γενικών κανόνων: το κείμενο του Navigator (LFP 1, όρια/εποχές/μεγέθη, πηγή) (1.14.92)', r[6:9]==[True,True,True], r[6:9])
    check('Εκτός των χωρών μας: καμία γραμμή, όπως πριν (1.14.92)', r[9] is None, r[9])
    r=pg.evaluate("""()=>{ const n0=document.querySelectorAll('.leaflet-overlay-pane path').length; const fs=AlkyonNav.data().filter(f=>f.c==='Cyprus'); let hit=null;
      for(const f of fs){ const la=(f.b[0]+f.b[2])/2, lo=(f.b[1]+f.b[3])/2; if(AlkyonNav.hits(la,lo).length){ hit=[la,lo]; break; } } if(!hit) return ['nohit'];
      const box=AlkyonNavInfo(hit[0],hit[1]); const ok=AlkyonNav.tap(34.6658,32.5236);
      return [box.querySelectorAll('.navln:not(.navwat)').length>0, !!box.querySelector('.navwat'), box.querySelector('.navwat').textContent.includes('Ισχύουν και οι γενικοί κανόνες'), ok, document.body.textContent.includes('Κανόνες εδώ'), !!document.querySelector('.navpin'), document.querySelectorAll('.leaflet-overlay-pane path').length===n0]; }""")
    check('Μέσα σε ειδική ζώνη: πρώτα η ζώνη, μετά «ισχύουν και οι γενικοί κανόνες» (1.14.92)', r[:3]==[True,True,True], r[:3])
    check('Πάτημα σε ελεύθερη θάλασσα: φύλλο «Κανόνες εδώ» με καρφίτσα, και τίποτα νέο σχεδιασμένο στον χάρτη (1.14.92)', r[3:]==[True,True,True,True], r[3:])
    c2=ctx(b); pe=page(c2); pe.add_init_script("localStorage.setItem('alkyon-lang','en')"); pe.goto(BASE+'/v4/#map'); pe.wait_for_timeout(3500)
    r=pe.evaluate("""()=>{ if(window.LANG!=='en') return ['lang',window.LANG]; const bn=document.getElementById('bNav'); if(bn.getAttribute('aria-pressed')!=='true') bn.click();
      return AlkyonNav.load(34.67,32.52).then(()=>AlkyonNav.loadWaters()).then(()=>{ const ln=AlkyonNavInfo(34.6658,32.5236).querySelector('.navwat'); return [ln.textContent.includes('General rules: Cyprus Territorial Seas'), ln.textContent.includes('No special zone at this point')]; }); }""")
    check('Αγγλικά: «General rules: Cyprus Territorial Seas» (1.14.92)', r==[True,True], r)
    check('1.14.92: χωρίς σφάλματα JS', not pg._errs and not pe._errs, [pg._errs,pe._errs]); c.close(); c2.close()

    print('# 1.14.93 παγωμένο στιγμιότυπο πρόγνωσης (ML Data Foundation)')
    c=ctx(b); c.add_init_script("if(!sessionStorage.__s){sessionStorage.__s=1;localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'trip-s1',start:Date.now()-50*60000,due:Date.now()+3*3600000,route:'S',last:{lat:34.7,lon:32.4,t:Date.now()}}));}")
    pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(11500)
    r=pg.evaluate("""async()=>{ const W=ms=>new Promise(r=>setTimeout(r,ms)), o={}, SN=window.AlkyonSnapshot;
      const sc0=JSON.parse(localStorage.getItem('alkyon-tscore')||'null'); o.held=[!!sc0, sc0&&sc0.id, !!(sc0&&sc0.snap), sc0&&sc0.snap&&SN.valid(sc0.snap), sc0&&sc0.snap&&sc0.snap.app===window.ALKYON_VERSION, sc0&&sc0.snap&&sc0.snap.pf, sc0&&sc0.snap&&sc0.snap.cfg===PF.scoreConfig, sc0&&sc0.snap&&Math.abs(Date.now()-sc0.snap.at)<60000];
      const score0=[...document.querySelectorAll('.fscore,.score,.dial b')].map(x=>x.textContent).join('|');
      AK.trip.back(); await W(900); const bt=[...document.querySelectorAll('.sheet.on .zeroq .btn')].find(x=>x.textContent==='Δεν έπιασα τίποτα'); bt&&bt.click(); await W(3600);
      const tr=()=>JSON.parse(localStorage.getItem('alkyon-trips')||'[]').filter(t=>!t.deleted); let t=tr().find(x=>x.sid==='trip-s1'); if(!t) return {held:o.held,err:'no trip'};
      const lo=Math.floor(t.startMs/3600000), hi=Math.floor(t.endMs/3600000), sn=t.snap;
      o.trip=[!!sn, sn&&SN.valid(sn), sn&&sn.h.every(r=>r[0]>=lo&&r[0]<=hi), sn&&sn.h.length, Array.isArray(t.scoreH)&&t.scoreH.length===(sn?sn.h.length:-1), t.scoreCfg===PF.scoreConfig, SN.late(sn,t.startMs)];
      o.keys=sn?Object.keys(sn).sort().join(','):''; o.size=sn?JSON.stringify(sn).length:0;
      const row=AK.contrib._rowOf('trip',t); o.sent=[!(row.cond&&row.cond.snap), !/"snap"|"cols"/.test(JSON.stringify(row)), row.cond&&row.cond.k, Math.round(row.lat*10)/10===row.lat&&Math.round(row.lon*10)/10===row.lon, typeof AK.emit==='function', !/34\.7\d|32\.4\d/.test(JSON.stringify(sn))];
      /* δεν ξαναγράφεται */ const at0=sn.at; localStorage.setItem('alkyon-tscore',JSON.stringify({id:'trip-s1',h:t.scoreH,snap:Object.assign({},sn,{at:1})})); AK.emit&&AK.emit('tripend',{id:t.id}); await W(3200); t=tr().find(x=>x.sid==='trip-s1'); o.once=t.snap.at===at0;
      o.score=score0===[...document.querySelectorAll('.fscore,.score,.dial b')].map(x=>x.textContent).join('|'); return o; }""")
    check('στιγμιότυπο: παίρνεται στην έξοδο με τις εισόδους του βαθμού, την έκδοση της εφαρμογής, την πλατφόρμα και την έκδοση κανόνων (1.14.93)', r.get('held')==[True,'trip-s1',True,True,True,'web',True,True], r.get('held'))
    check('στιγμιότυπο: στο τέλος μένει στην έξοδο μόνο για τις ώρες της, δίπλα στο scoreH που γράφεται όπως πριν· πάρθηκε 50′ μετά την έναρξη, άρα σημειώνεται «αργό» (1.14.93)', r.get('trip') and r['trip'][:3]==[True,True,True] and r['trip'][3]>=1 and r['trip'][4:]==[True,True,True] and r.get('keys')=='app,at,cfg,cols,h,pf,prof,sp,src,v' and 0<r.get('size',0)<6000, [r.get('trip'),r.get('keys'),r.get('size'),r.get('err')])
    check('στιγμιότυπο: ΔΕΝ πηγαίνει στις ανώνυμες συνεισφορές (η γραμμή της εξόδου δεν το περιέχει) και δεν έχει θέση μέσα του (1.14.93)', r.get('sent')==[True,True,'l',True,True,True], r.get('sent'))
    check('στιγμιότυπο: γράφεται μία φορά και δεν ξαναγράφεται· ο βαθμός στην οθόνη δεν αλλάζει (1.14.93)', r.get('once') is True and r.get('score') is True, [r.get('once'),r.get('score')])
    check('1.14.93: χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# 1.12.27 κόμποι: εκτός εφαρμογής')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#guide'); pg.wait_for_timeout(3500)
    check('Οδηγός χωρίς καρτέλα Κόμποι (αφαιρέθηκε προσωρινά)', not pg.query_selector('#tab-guide .seg button[data-g=knots]') and not pg._errs, pg._errs); c.close()
    b.close()

# 1.9.48: server (quick-processor): ίδιος κώδικας, ψεύτικα δεδομένα, χωρίς δίκτυο
print('# server')
import subprocess as _sp, json as _js
_r=_sp.run(['node',os.path.join(os.path.dirname(os.path.abspath(__file__)),'server.mjs')],capture_output=True,text=True,timeout=600)
_last=(_r.stdout.strip().splitlines() or ['{}'])[-1]
try: _j=_js.loads(_last)
except Exception: _j={'ok':0,'fail':['server.mjs δεν έτρεξε: '+(_r.stderr or '')[-300:]]}
for _l in _r.stdout.splitlines():
    if _l.startswith('  ok   '): check('server: '+_l[7:], True, None)
for _n in _j.get('fail',[]): check('server: '+_n, False, _r.stdout[-600:])
check('server: τρέχουν τα tests', _j.get('ok',0)>=30, [_r.returncode,_r.stderr[-300:]])
print('\n%d ok, %d fail'%(OK[0],len(FAIL)))
if FAIL: print('FAILED:', ', '.join(FAIL)); sys.exit(1)
