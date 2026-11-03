"""Alkyon · αυτόματοι έλεγχοι (τρέχουν στο GitHub Actions σε κάθε ανέβασμα, ή τοπικά: python3 tests/run.py).
Ανοίγει την εφαρμογή v4 σε headless Chromium (μέγεθος κινητού) με ψεύτικα δεδομένα καιρού και ελέγχει:
  1. κάθε σελίδα ανοίγει χωρίς σφάλμα
  2. τα κουμπιά που περνούν από μια σελίδα σε άλλη (Στον χάρτη, Πήγαινε εκεί, Επανάληψη εξόδου, Καλύτερα σημεία...)
  3. σύνδεσμοι (#trip, #new, #share=, #addfriend=) και το κεντρικό κουμπί εξόδου
  4. «Τι νέο υπάρχει» μετά από αλλαγή έκδοσης
  5. offline: με κλειστό δίκτυο, οι σελίδες ανοίγουν από το cache
  6. ελληνικά και αγγλικά
Βγαίνει με κωδικό 1 αν αποτύχει κάτι, ώστε το GitHub να στείλει ειδοποίηση."""
import sys, os, json, subprocess, time, socket, threading, http.server, functools
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); sys.path.insert(0,HERE)
from fakeom import respond
from playwright.sync_api import sync_playwright

def serve():
    s=socket.socket(); s.bind(('127.0.0.1',0)); port=s.getsockname()[1]; s.close()
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a): pass
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
      "localStorage.setItem('alkyon-lang',%s);localStorage.setItem('alkyon-onboard','1');localStorage.setItem('alkyon-askfp','0');"
      "localStorage.setItem('alkyon-fprof-done','1');localStorage.setItem('alkyon-fprof',%s);"
      "localStorage.setItem('alkyon-v4-news',JSON.stringify(%s||window.ALKYON_VERSION||'9.9.9'));"
      "localStorage.setItem('alkyon-bites',JSON.stringify([{id:'b1',date:'2026-10-20',time:'07:00',species:'Λαβράκι',kg:1.2,lat:35.1,lon:32.5,_u:1}]));}"
      )%(json.dumps(lang),json.dumps(prof),json.dumps(news))
def ctx(b, sw=False, **kw):
    c=b.new_context(viewport={'width':390,'height':844}, service_workers='allow' if sw else 'block')
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
    b=p.chromium.launch()
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
    def supa(route):
        u=route.request.url; m=route.request.method; body=route.request.post_data or ''
        if '/auth/v1/signup' in u: return route.fulfill(json={'id':'u1','email':'d@x.com'})
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
    pg.click('.sheet .authf .link >> nth=0'); pg.fill('.sheet input[type=email]','d@x.com'); pg.fill('.sheet input[type=password]','secret1'); pg.click('.sheet button[type=submit]'); pg.wait_for_timeout(800)
    check('εγγραφή → κωδικός από email', pg.evaluate("()=>!document.querySelector('.sheet .codebox').hidden"))
    pg.fill('.sheet .codein','000000'); pg.click('.sheet .codebox .btn.pri'); pg.wait_for_timeout(600)
    check('λάθος κωδικός: μήνυμα', 'κωδικός' in pg.evaluate("()=>document.querySelector('.sheet .err').textContent").lower() or 'code' in pg.evaluate("()=>document.querySelector('.sheet .err').textContent").lower())
    pg.fill('.sheet .codein','123456'); pg.click('.sheet .codebox .btn.pri'); pg.wait_for_timeout(1500)
    check('σωστός κωδικός: συνδεδεμένος', pg.evaluate("()=>!!AK.cloud.session()&&!document.querySelector('.sheet')"))
    check('λογαριασμός χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    for hs,want in [('#access_token=AT&refresh_token=RT&expires_in=3600&type=signup','session'),('#access_token=AT&refresh_token=RT&expires_in=3600&type=recovery','newpass'),('#error=access_denied&error_description=expired','expired')]:
        c=actx(); pg=page(c); pg.goto(BASE+'/'+hs); pg.wait_for_timeout(3500)
        s=pg.evaluate("()=>({h:location.hash, s:!!AK.cloud.session(), sh:(document.querySelector('.sheet')||{}).textContent||''})")
        okk=s['h']=='#profile' and ((want=='session' and s['s']) or (want=='newpass' and s['s'] and ('Νέος κωδικός' in s['sh'] or 'New password' in s['sh'])) or (want=='expired' and not s['s'] and s['sh']))
        check('σύνδεσμος email: '+want, okk and not pg._errs, (s,pg._errs)); c.close()

    print('# παλιά έξοδος και κλασική')
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#log'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>AK.pastTrip()"); pg.wait_for_timeout(500)
    pg.fill('.pasttrip input[type=date]','2026-10-25'); pg.fill('.pasttrip input[list=ptSpots]','Λατσί'); pg.fill('.pasttrip input[type=time] >> nth=0','06:30'); pg.fill('.pasttrip input[type=time] >> nth=1','10:00')
    pg.click('.pasttrip .btn.pri'); pg.wait_for_timeout(600)
    tr=pg.evaluate("()=>AK.store.raw('trips').map(t=>[t.date,t.spot,t.manual,(t.endMs-t.startMs)/3600000])")
    check('παλιά έξοδος αποθηκεύεται', tr==[['2026-10-25','Λατσί',True,3.5]], tr)
    for u,want in [('/classic.html?a=map&lat=35.1&lon=33.2','/v4/#share='),('/classic.html?a=bite','/v4/#log'),('/classic.html','/v4/#forecast')]:
        pg.goto(BASE+u); pg.wait_for_timeout(1500); check('κλασική → '+want, pg.url.split(BASE)[1].startswith(want), pg.url)
    check('παλιά έξοδος/κλασική χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

    print('# offline')
    c=ctx(b,sw=True); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(6000); pg.reload(); pg.wait_for_timeout(3000)
    c.set_offline(True)
    for r in ['map','help','friends','check','boat','tackle','guide','log','forecast']:
        s=go(pg,'#'+r,2200); check('offline #'+r, not s['fail'] and not s['loading'], s)
    pg.reload(); pg.wait_for_timeout(3000); s=go(pg,'#map',2500)
    check('offline μετά από ανανέωση: χάρτης', s['n']>15 and not s['fail'], s)
    check('offline χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()
    b.close()

print('\n%d ok, %d fail'%(OK[0],len(FAIL)))
if FAIL: print('FAILED:', ', '.join(FAIL)); sys.exit(1)
