/* Ενιαίο παράθυρο επιβεβαίωσης της εφαρμογής (αντί για το παράθυρο του browser). window.AlkyonAsk(μήνυμα, {title, ok, cancel, danger}) → Promise<boolean> */
(function(){
'use strict';
var EN=window.LANG==='en';
var root=null, busy=null;
function build(){
  root=document.createElement('div'); root.className='askov'; root.hidden=true; root.setAttribute('role','alertdialog'); root.setAttribute('aria-modal','true');
  root.innerHTML='<div class="askbox"><div class="asktitle"></div><div class="asktext"></div><div class="askbtns"><button type="button" class="btn ghost askno"></button><button type="button" class="btn askyes"></button></div></div>';
  document.body.appendChild(root);
}
function ask(msg,o){
  o=o||{}; if(!root) build();
  if(busy){ busy(false); busy=null; }
  return new Promise(function(res){
    var t=root.querySelector('.asktitle'), x=root.querySelector('.asktext'), y=root.querySelector('.askyes'), n=root.querySelector('.askno');
    t.textContent=o.title||'Alkyon'; x.textContent=msg; x.style.whiteSpace='pre-line';
    y.textContent=o.ok||(EN?'OK':'Εντάξει'); n.textContent=o.cancel||(EN?'Cancel':'Άκυρο');
    y.className='btn askyes'+(o.danger?' danger':' acc'); n.hidden=(o.cancel===false);
    function done(v){ root.hidden=true; busy=null; y.onclick=n.onclick=root.onclick=null; document.removeEventListener('keydown',kd); res(v); }
    function kd(e){ if(e.key==='Escape') done(false); }
    busy=done; y.onclick=function(){ done(true); }; n.onclick=function(){ done(false); };
    root.onclick=function(e){ if(e.target===root) done(false); };
    document.addEventListener('keydown',kd);
    root.hidden=false; try{ (o.danger?n:y).focus(); }catch(e){}
  });
}
/* Παράθυρο εισαγωγής κειμένου: AlkyonAsk.prompt(μήνυμα,{value,title,ok,cancel,max}) → Promise<string|null> */
function prompt_(msg,o){
  o=o||{}; if(!root) build();
  var box=root.querySelector('.askbox'), inp=box.querySelector('.askin');
  if(!inp){ inp=document.createElement('input'); inp.type='text'; inp.className='askin'; inp.autocomplete='off'; box.insertBefore(inp,box.querySelector('.askbtns')); }
  inp.hidden=false; inp.value=o.value||''; inp.maxLength=o.max||80;
  return ask(msg,{title:o.title,ok:o.ok,cancel:o.cancel}).then(function(v){ var r=v?inp.value:null; inp.hidden=true; return r; });
}
ask.prompt=function(msg,o){ var p=prompt_(msg,o); setTimeout(function(){ var i=root&&root.querySelector('.askin'); if(i){ try{ i.focus(); i.select(); }catch(e){} } },60); return p; };
window.AlkyonAsk=ask;
})();
