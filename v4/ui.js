/* Alkyon 4 · κοινά στοιχεία οθόνης: εικονίδια, μήνυμα, φύλλο από κάτω, επιλογή όψης */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T;

/* εικονίδια γραμμής (24×24, χρώμα από το κείμενο) */
var P={
  pin:'<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  gps:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  trash:'<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  map:'<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  wave:'<path d="M2.5 9c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2"/><path d="M2.5 15c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2"/>',
  forecast:'<path d="M3 17c3-6 5.5-9 9-9s6 3 9 9"/><path d="M12 3v2M5.6 5.6l1.4 1.4M18.4 5.6 17 7M3 21h18"/>',
  log:'<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h7M9 14h7M9 18h4"/>',
  user:'<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/>',
  fish:'<path d="M2.5 12c3-4.6 7.8-6.4 12.3-4.4 1.8.8 3.2 2.3 4.2 4.4-1 2.1-2.4 3.6-4.2 4.4C10.3 18.4 5.5 16.6 2.5 12z"/><path d="M19 12l3-3v6z"/><circle cx="14.6" cy="10.8" r=".9"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  out:'<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'
};
function iconSvg(n){ return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(P[n]||'')+'</svg>'; }
function icon(n){ var w=document.createElement('span'); w.innerHTML=iconSvg(n); return w.firstChild; }

/* μήνυμα στο κάτω μέρος */
var tEl=null, tT=0;
function toast(msg,ms,act){
  if(!tEl){ tEl=h('div',{class:'toast',role:'status','aria-live':'polite'}); document.body.appendChild(tEl); }
  tEl.replaceChildren(h('span',{text:msg})); tEl.classList.toggle('act',!!act);
  if(act) tEl.append(h('button',{type:'button',class:'tact',text:act.label,onclick:function(){ clearTimeout(tT); tEl.classList.remove('on'); act.fn(); }}));
  clearTimeout(tT); requestAnimationFrame(function(){ tEl.classList.add('on'); });
  tT=setTimeout(function(){ tEl.classList.remove('on'); },ms||Math.min(9000,Math.max(act?5000:2600,String(msg||'').length*60)));
}
/* σύρσιμο προς τα αριστερά για διαγραφή (λίστες): content = το στοιχείο της γραμμής, onDel = διαγραφή */
function swipeDel(content,onDel){
  var w=h('div',{class:'swp'}), bg=h('button',{class:'swbg',type:'button',tabindex:'-1','aria-hidden':'true',text:T('Διαγραφή','Delete'),onclick:function(){ go(); }}), fg=h('div',{class:'swfg'},content);
  w.append(bg,fg); var x0=null, y0=0, dx=0, drag=false, open=false;
  function set(v,anim){ fg.style.transition=anim?'transform .2s ease':'none'; fg.style.transform=v?'translateX('+v+'px)':''; }
  function go(){ fg.style.transition='transform .2s ease'; fg.style.transform='translateX(-110%)'; w.classList.add('gone'); setTimeout(function(){ w.style.height=w.offsetHeight+'px'; requestAnimationFrame(function(){ w.style.height='0px'; }); setTimeout(function(){ w.remove(); onDel(); },220); },180); }
  fg.addEventListener('touchstart',function(e){ var t=e.touches[0]; x0=t.clientX; y0=t.clientY; dx=0; drag=false; },{passive:true});
  fg.addEventListener('touchmove',function(e){ if(x0==null) return; var t=e.touches[0], mx=t.clientX-x0, my=t.clientY-y0; if(!drag){ if(Math.abs(mx)>10&&Math.abs(mx)>Math.abs(my)*1.4) drag=true; else if(Math.abs(my)>10){ x0=null; return; } }
    if(drag){ dx=Math.min(0,mx+(open?-96:0)); set(dx,false); } },{passive:true});
  fg.addEventListener('touchend',function(){ if(x0==null) return; x0=null; if(!drag) return; if(dx<-170){ go(); } else if(dx<-50){ open=true; set(-96,true); } else { open=false; set(0,true); } });
  fg.addEventListener('click',function(e){ if(open){ e.stopPropagation(); e.preventDefault(); open=false; set(0,true); } },true);
  return w;
}

/* φύλλο από κάτω: sheet({title, body:Node}) → {close} */
var openSheet=null;
function sheet(o){
  var parent=null; if(o.stack&&openSheet){ parent=openSheet; } else if(openSheet) openSheet.close(true);
  var scrim=h('div',{class:'scrim'+(parent?' stk':'')}), box=h('section',{class:'sheet'+(parent?' stk':''),role:'dialog','aria-modal':'true','aria-label':o.title});
  var x=h('button',{class:'iconbtn',type:'button','aria-label':T('Κλείσιμο','Close'),html:iconSvg('close')});
  box.append(h('div',{class:'grab'}),h('header',null,h('h2',{text:o.title}),x),h('div',{class:'body'},o.body));
  document.body.append(scrim,box);
  var prevFocus=document.activeElement;
  requestAnimationFrame(function(){ scrim.classList.add('on'); box.classList.add('on'); var f=box.querySelector(o.focus||'.body button,.body input'); if(f&&o.focus) f.focus(); });
  var api={close:function(quick){
    if(openSheet!==api) return; openSheet=parent; document.removeEventListener('keydown',key);
    scrim.classList.remove('on'); box.classList.remove('on');
    setTimeout(function(){ scrim.remove(); box.remove(); },quick?0:260);
    try{ if(prevFocus&&prevFocus.focus) prevFocus.focus(); }catch(e){}
    if(o.onclose) o.onclose(); }, el:box};
  function key(e){ if(e.key==='Escape') api.close(); }
  document.addEventListener('keydown',key);
  scrim.addEventListener('click',function(){ api.close(); }); x.addEventListener('click',function(){ api.close(); });
  /* κλείσιμο σέρνοντας τη λαβή προς τα κάτω */
  var y0=null, dy=0, grab=box.querySelector('.grab'), hd=box.querySelector('header');
  [grab,hd].forEach(function(z){
    z.addEventListener('touchstart',function(e){ y0=e.touches[0].clientY; dy=0; box.style.transition='none'; },{passive:true});
    z.addEventListener('touchmove',function(e){ if(y0==null) return; dy=Math.max(0,e.touches[0].clientY-y0); box.style.transform='translateY('+dy+'px)'; },{passive:true});
    z.addEventListener('touchend',function(){ box.style.transition=''; box.style.transform=''; if(dy>90) api.close(); y0=null; });
  });
  openSheet=api; return api;
}

/* επιλογή όψης: seg([[key,label],...], current, onChange) */
function seg(items,cur,fn,label){
  var w=h('div',{class:'seg',role:'group','aria-label':label||null});
  items.forEach(function(it){ var b=h('button',{type:'button','aria-pressed':String(it[0]===cur),text:it[1]});
    b.addEventListener('click',function(){ if(b.getAttribute('aria-pressed')==='true') return; [].forEach.call(w.children,function(x){ x.setAttribute('aria-pressed',String(x===b)); }); fn(it[0]); });
    w.appendChild(b); });
  return w;
}

/* παρατεταμένο πάτημα */
function longPress(el,fn){ var t=0; function st(){ t=setTimeout(function(){ t=0; el.dataset.lp='1'; fn(); },550); } function en(){ clearTimeout(t); }
  el.addEventListener('touchstart',st,{passive:true}); el.addEventListener('touchend',en); el.addEventListener('touchmove',en,{passive:true}); el.addEventListener('contextmenu',function(e){ e.preventDefault(); fn(); });
  el.addEventListener('click',function(e){ if(el.dataset.lp){ e.stopImmediatePropagation(); e.preventDefault(); delete el.dataset.lp; } },true); }

/* επιβεβαίωση (μικρό φύλλο) */
function ask(q,okText,danger){ return new Promise(function(res){ var done=false;
  var ok=h('button',{class:'btn full'+(danger?'':' pri'),type:'button',text:okText||T('Εντάξει','OK'),style:danger?{color:'var(--poor)'}:null});
  var no=h('button',{class:'btn full',type:'button',text:T('Άκυρο','Cancel')});
  /* μεγάλη ερώτηση: ο τίτλος κρατά μόνο την ερώτηση, η εξήγηση πάει από κάτω σε κανονικά γράμματα */
  var title=String(q||'').trim(), sub=null;
  if(title.length>64){ var qs=title.match(/[^.!;?\n]*[;?]/g), lq=qs&&qs[qs.length-1].trim();
    if(lq&&lq.length>=8&&lq.length<=80){ var at=title.lastIndexOf(lq); sub=(title.slice(0,at)+' '+title.slice(at+lq.length)).replace(/[ \t]+/g,' ').trim(); title=lq; if(!sub) sub=null; }
    else { sub=title; title=T('Επιβεβαίωση','Confirm'); } }
  var sh=sheet({title:title,body:h('div',{style:{display:'grid',gap:'10px',paddingTop:'4px'}},sub?h('p',{class:'sub asksub',text:sub}):null,ok,no),onclose:function(){ if(!done) res(false); }});
  ok.addEventListener('click',function(){ done=true; sh.close(); res(true); }); no.addEventListener('click',function(){ sh.close(); });
}); }

Object.assign(B,{icon:icon,iconSvg:iconSvg,toast:toast,swipeDel:swipeDel,sheet:sheet,closeSheet:function(){ if(openSheet) openSheet.close(true); },seg:seg,longPress:longPress,ask:ask});
})();
