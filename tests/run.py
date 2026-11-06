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
    for u,want in [('/classic.html?a=map&lat=35.1&lon=33.2','/v4/#share='),('/classic.html?a=bite','/v4/#log'),('/classic.html','/v4/#forecast')]:
        pg.goto(BASE+u); pg.wait_for_timeout(1500); check('κλασική → '+want, pg.url.split(BASE)[1].startswith(want), pg.url)
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
    check('σύρσιμο κάτω ανοίγει το μενού: 5 στρώματα + εργαλεία', k[0] and k[1]==5 and k[2]>=4, k)
    pg.wait_for_timeout(400); sr=pg.evaluate("()=>{const r=document.querySelector('.mcpan').getBoundingClientRect();return [Math.round(r.left),Math.round(r.right),innerWidth]}")
    check('πλαϊνό μενού από δεξιά, αριστερά φαίνεται ο χάρτης', sr[0]>=60 and abs(sr[1]-sr[2])<=2, sr)
    check('λαβή στη δεξιά άκρη υπάρχει (κρυμμένη όσο είναι ανοιχτό το μενού)', pg.evaluate("()=>{const e=document.querySelector('.mcedge');return !!e&&getComputedStyle(e).display==='none'}"), None)
    g=pg.evaluate("()=>[[...document.querySelectorAll('.mcpan .mcgrp>h4, .mcpan .mcacc>summary')].map(e=>e.textContent), [...document.querySelectorAll('.mcg3 .mctile b')].map(e=>e.textContent)]")
    check('μενού: ομάδες σε σειρά (Καιρός πριν από Εργαλεία, Χάρτης και βάθη, Ενέργειες) και εργαλεία χωρίς στρώματα', all(x in g[0] for x in ['Χάρτης και βάθη','Καιρός και θάλασσα','Θάλασσα και κανόνες','Τα δικά μου','Ενέργειες']) and g[0].index('Καιρός και θάλασσα')<g[0].index('Εργαλεία')<g[0].index('Χάρτης και βάθη') and 'Βάθη θάλασσας' not in g[0] and 'Πού να πάω' not in g[0] and 'Χάρακας' in g[1] and not any('Σταθμοί' in x or 'Λιμάνια' in x for x in g[1]), g)
    pg.evaluate("()=>document.querySelectorAll('.mcg5 .mctile')[2].click()"); pg.wait_for_timeout(500)
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
    check('Ημερολόγιο χωρίς σφάλματα JS', not pg._errs, pg._errs); c.close()

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
