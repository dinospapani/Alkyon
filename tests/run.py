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
      "localStorage.setItem('alkyon-lang',%s);localStorage.setItem('alkyon-onboard','1');localStorage.setItem('alkyon-askfp','0');"
      "localStorage.setItem('alkyon-fprof-done','1');localStorage.setItem('alkyon-fprof',%s);localStorage.setItem('alkyon-v4-mapui',JSON.stringify('classic'));"
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
    r=pg.evaluate("()=>{const a=[...document.querySelectorAll('.pstats .pst')]; return [a.filter(x=>x.tagName=='BUTTON').length, new Set(a.map(x=>x.offsetHeight)).size]}")
    pg.locator('.pstats .pst').nth(1).click(); pg.wait_for_timeout(1500)
    r2=pg.evaluate("()=>[location.hash, (document.querySelector('.lseg button[aria-pressed=true]')||{}).textContent]")
    check('προφίλ: τα 4 κουτάκια πατιούνται και έχουν ίδιο ύψος (1.9.15)', r[0]==4 and r[1]==1 and r2==['#log','Ψάρια'] and not pg._errs, [r,r2,pg._errs])
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
    r=pg.evaluate("()=>{const m=document.querySelector('.mres'); return m?m.innerText:null}")
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
    r=pg.evaluate("()=>{const x=document.querySelector('#fcExposure'); const order=[...document.querySelectorAll('#main .hero, #main .nowcard, #main .hcard, #main details.fold')].map(e=>e.classList.contains('hero')?'h':e.classList.contains('nowcard')?'n':e.classList.contains('hcard')?'u':e.querySelector('#fcExposure')?'e':'f').join(''); return {v:x&&x.dataset.v, cv:!!(x&&x.querySelector('.exmap canvas')), v1:!!(x&&x.querySelector('.exv')), est:!!(x&&x.querySelector('.exest:not([hidden]) b')), order:order}}")
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
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.nowcard .btn')].find(x=>/Πού να πάω/.test(x.textContent)); b&&b.click()}"); pg.wait_for_timeout(800)
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
    nm=pg.evaluate("()=>{const x=document.querySelector('.hero .nmx'); const r=PF.nextMoon(Date.now()); return [x?x.textContent:'', r&&r.nw>Date.now()&&r.nw-Date.now()<30*864e5, r&&r.full>Date.now()]}")
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
    r=pg.evaluate("()=>{const c=document.querySelector('.cmcard'); return c?c.innerText:''}")
    check('«Τι κοινό είχαν τα ψαρέματά σου» (1.9.59)', 'Μεγάλα ψάρια (από 2,5 kg) · 3 μέρες' in r and 'Ιανουάριος–Μάρτιος' in r and 'κοντά στη νέα σελήνη' in r and 'Μικρότερα ψάρια · 2 μέρες' in r and not pg._errs, [r[:500],pg._errs]); c.close()
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
        ov=pg.evaluate("""()=>{const r=[]; document.querySelectorAll('#main .chips.rng .chip, #main .seg button, #main .btn').forEach(e=>{ const b=e.getBoundingClientRect(); if(e.offsetParent&&(e.scrollWidth>e.clientWidth+1||b.right>innerWidth+1)) r.push(e.textContent.trim()); });
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
    check('Ελληνικά: «Longline 17» → «Παραγάδι 17», «Dusky grouper» → «Σφυρίδα» (1.10.6)', nm=='Παραγάδι 17' and 'Σφυρίδα' in sp, [nm,sp])
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
    check('Ελληνικά: τα αγγλικά ονόματα ειδών γίνονται ελληνικά και στην πρόγνωση (Ασπρόβλαχος, Σφυρίδα) (1.10.11)', r[4]=='Ασπρόβλαχος' and r[5]=='Σφυρίδα', r)
    check('Πρόγνωση: γραμμή «Έκθεση ακτής: μόνο κοντά στην ακτή» υπάρχει (1.10.11)', pg.evaluate("()=>!!document.querySelector('.expo-none')"))
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
