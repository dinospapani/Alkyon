"""Alkyon · απογραφή: μαζεύει κάθε κουμπί/επιλογή/τίτλο που φαίνεται σε κάθε οθόνη και κάθε μενού.
python3 tests/inventory.py save   → γράφει tests/inventory-base.json (η «φωτογραφία» της παλιάς έκδοσης)
python3 tests/inventory.py check  → συγκρίνει την τωρινή έκδοση με τη φωτογραφία· ό,τι λείπει πρέπει να
                                    εξηγείται στο tests/inventory-moved.json (π.χ. «Νυχτερινή» → «κουμπί ☀/☾»)
Χρησιμοποιείται και από το tests/run.py."""
import sys, os, json, re, unicodedata
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)

JS_LABELS=r"""(sel)=>{ const out=new Set(); const root=sel?document.querySelector(sel):document.body; if(!root) return [];
  const vis=e=>{ const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'; };
  root.querySelectorAll('button,a[href],summary,[role=tab],[role=switch],label,select option,h2,h3,h4,.lyh,.mcsub').forEach(e=>{
    if(e.closest('.toast')) return; if(e.tagName!=='OPTION'&&!vis(e)) return;
    let t=(e.getAttribute('aria-label')||'')+' | '+(e.innerText||e.textContent||'');
    t.split('|').forEach(x=>{ x=x.split('\n')[0].trim(); if(x&&x.length>1) out.add(x); }); });
  return [...out]; }"""

def norm(t):
    t=''.join(ch for ch in unicodedata.normalize('NFD',t) if unicodedata.category(ch)!='Mn')
    t=re.sub(r'[\d.,:%°′″+\-–·•›‹▾✓✕×()«»"\'/]+',' ',t.lower())
    t=re.sub(r'\s+',' ',t).strip()
    return t[:40]

def crawl(b, BASE, ctx, page):
    inv={}
    def grab(pg,key,sel=None):
        try: L=pg.evaluate(JS_LABELS,sel)
        except Exception: L=[]
        s=inv.setdefault(key,set())
        for x in L:
            n=norm(x)
            if len(n)>=2: s.add(n)
    def opensheets(pg,key,selector,limit=60):
        n=pg.evaluate("s=>document.querySelectorAll(s).length",selector)
        for i in range(min(n,limit)):
            h0=pg.evaluate("()=>location.hash")
            ok=pg.evaluate("([s,i])=>{const e=document.querySelectorAll(s)[i]; if(!e||e.closest('.sheet')) return false; const r=e.getBoundingClientRect(); if(!r.width) return false; e.click(); return true;}",[selector,i])
            if not ok: continue
            pg.wait_for_timeout(450)
            if pg.evaluate("()=>!!document.querySelector('.sheet')"):
                grab(pg,key+' › φύλλα','.sheet')
                pg.evaluate("()=>{try{AK.closeSheet&&AK.closeSheet()}catch(e){}; document.querySelectorAll('.sheet,.scrim').forEach(x=>x.remove())}")
                pg.wait_for_timeout(250)
            if pg.evaluate("()=>location.hash")!=h0:
                pg.evaluate("h=>location.hash=h",h0); pg.wait_for_timeout(1200)
    c=ctx(b); pg=page(c); pg.goto(BASE+'/v4/#forecast'); pg.wait_for_timeout(2500)
    for r in ['forecast','log','profile','alerts','inbox','boat','guide','check','tackle','help']:
        pg.evaluate("h=>location.hash=h",'#'+r); pg.wait_for_timeout(1800)
        pg.evaluate("()=>{document.querySelectorAll('#main details').forEach(d=>d.open=true)}"); pg.wait_for_timeout(200)
        grab(pg,'#'+r,'#main')
        nt=pg.evaluate("()=>document.querySelectorAll('#main [role=tab], #main .tabs button, #main .seg button').length")
        for i in range(min(nt,12)):
            pg.evaluate("i=>{const e=document.querySelectorAll('#main [role=tab], #main .tabs button, #main .seg button')[i]; e&&e.click()}",i); pg.wait_for_timeout(500)
            pg.evaluate("()=>{document.querySelectorAll('#main details').forEach(d=>d.open=true)}")
            grab(pg,'#'+r,'#main')
        if r in ('profile','boat','log','forecast'):
            opensheets(pg,'#'+r,'#main .li, #main .row, #main button.card, #main .set')
    # χάρτης κλασικός: στρώματα
    pg.evaluate("h=>location.hash=h",'#map'); pg.wait_for_timeout(3500)
    grab(pg,'#map','#main')
    pg.evaluate("()=>{const b=document.querySelector('.mapbar .iconbtn'); b&&b.click()}"); pg.wait_for_timeout(700)
    grab(pg,'#map › στρώματα','.sheet')
    c.close()
    # χάρτης καθαρός: μενού
    c=ctx(b); c.add_init_script("if(!sessionStorage.mi){sessionStorage.mi=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));}")
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(4500)
    grab(pg,'#map καθαρός','#main')
    pg.evaluate("()=>{const b=document.querySelector('.mcbar'); b&&b.click()}"); pg.wait_for_timeout(800)
    grab(pg,'#map › μενού','.mcpan, .mcdrw, .sheet')
    for i in range(pg.evaluate("()=>document.querySelectorAll('.mctabs [role=tab]').length")):
        pg.evaluate("i=>document.querySelectorAll('.mctabs [role=tab]')[i].click()",i); pg.wait_for_timeout(300); grab(pg,'#map › μενού','.mcpan')
    c.close()
    # σε έξοδο
    import time
    now=int(time.time()*1000)
    c=ctx(b); c.add_init_script("if(!sessionStorage.mt){sessionStorage.mt=1;localStorage.setItem('alkyon-v4-mapui',JSON.stringify('clean'));localStorage.setItem('alkyon-safe',JSON.stringify({active:true,id:'T2',start:%d,due:%d}));}"%(now-600000,now+3600000))
    pg=page(c); pg.goto(BASE+'/v4/#map'); pg.wait_for_timeout(6000)
    grab(pg,'#map σε έξοδο')
    pg.evaluate("()=>{const b=document.querySelector('.mcbar'); b&&b.click()}"); pg.wait_for_timeout(800)
    grab(pg,'#map σε έξοδο › μενού','.mcpan, .mcdrw, .sheet')
    for i in range(pg.evaluate("()=>document.querySelectorAll('.mctabs [role=tab]').length")):
        pg.evaluate("i=>document.querySelectorAll('.mctabs [role=tab]')[i].click()",i); pg.wait_for_timeout(300); grab(pg,'#map σε έξοδο › μενού','.mcpan')
    pg.evaluate("()=>{try{AK.closeSheet&&AK.closeSheet()}catch(e){}; document.querySelectorAll('.mcdrw').forEach(x=>x.remove())}")
    pg.evaluate("h=>location.hash=h",'#trip'); pg.wait_for_timeout(2000)
    grab(pg,'#trip')
    c.close()
    return {k:sorted(v) for k,v in inv.items()}

def compare(base, now, moved):
    allnow=set(x for v in now.values() for x in v)
    miss=[]
    for k,v in base.items():
        for x in v:
            if x in allnow or x in moved: continue
            miss.append((k,x))
    return miss

if __name__=='__main__':
    sys.path.insert(0,HERE)
    import run_env as E
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b=p.chromium.launch(); inv=crawl(b,E.BASE,E.ctx,E.page); b.close()
    if sys.argv[1:]==['save']:
        json.dump(inv,open(os.path.join(HERE,'inventory-base.json'),'w'),ensure_ascii=False,indent=1)
        print('αποθηκεύτηκε:',sum(len(v) for v in inv.values()),'στοιχεία σε',len(inv),'οθόνες')
    else:
        base=json.load(open(os.path.join(HERE,'inventory-base.json')))
        mp=os.path.join(HERE,'inventory-moved.json'); moved=json.load(open(mp)) if os.path.exists(mp) else {}
        m=compare(base,inv,moved)
        for k,x in m: print('ΛΕΙΠΕΙ',k,'→',x)
        print(len(m),'λείπουν από',sum(len(v) for v in base.values()))
