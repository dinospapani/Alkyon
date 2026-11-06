"""Κοινό περιβάλλον για tests/inventory.py (ίδιο με το tests/run.py)."""
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
