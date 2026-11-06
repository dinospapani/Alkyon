/* Alkyon v4 · say.js (1.7.3): η εφαρμογή σου μιλάει (speechSynthesis του κινητού· δουλεύει και χωρίς ίντερνετ αν υπάρχει
   ελληνική φωνή στο κινητό). Είδη: troll (ρίξιμο/βυθός), speed (ταχύτητα συρτής), anchor (άγκυρα), nav (άφιξη). Ρυθμίσεις
   alkyon-say {on, vol, rate, k:{troll,speed,anchor,nav}}. Ίδια φράση όχι πιο συχνά από gap. Ο Chrome θέλει ένα πάτημα πρώτα:
   στο πρώτο άγγιγμα της οθόνης «ξεκλειδώνεται» με μια σιωπηλή φράση. */
(function(){
'use strict';
var B=window.AK, ls=B.ls, T=B.T, K='alkyon-say', DEF={on:true,vol:1,rate:1,k:{troll:true,speed:true,anchor:true,nav:true}};
var SS=window.speechSynthesis, last={}, unlocked=false, voice=null;
function cfg(){ var c=ls.get(K,null)||{}; var o=Object.assign({},DEF,c); o.k=Object.assign({},DEF.k,c.k||{}); return o; }
function put(c){ ls.set(K,c); }
function lang(){ return window.LANG==='en'?'en-GB':'el-GR'; }
function pick(){ if(!SS) return null; try{ var L=lang().slice(0,2), vs=SS.getVoices()||[]; voice=vs.filter(function(v){ return (v.lang||'').toLowerCase().indexOf(L)===0; }).sort(function(a,b){ return (b.localService?1:0)-(a.localService?1:0); })[0]||null; }catch(e){ voice=null; } return voice; }
if(SS){ pick(); try{ SS.addEventListener('voiceschanged',pick); }catch(e){} }
function unlock(){ if(unlocked||!SS) return; unlocked=true; try{ var u=new SpeechSynthesisUtterance(' '); u.volume=0; SS.speak(u); }catch(e){} }
['pointerdown','keydown'].forEach(function(ev){ document.addEventListener(ev,unlock,{once:true,capture:true}); });
/* say(text, kind, key, gapMs): key = ποια φράση (για να μη λέγεται ξανά και ξανά) */
function say(text,kind,key,gap){ var c=cfg(); if(!SS||!c.on||!text||(kind&&c.k[kind]===false)) return false;
  var k=(kind||'')+'|'+(key||text), now=Date.now(); if(last[k]&&now-last[k]<(gap==null?45000:gap)) return false; last[k]=now;
  try{ var u=new SpeechSynthesisUtterance(String(text)); u.lang=lang(); var v=voice||pick(); if(v) u.voice=v; u.volume=Math.max(0,Math.min(1,+c.vol||1)); u.rate=Math.max(0.6,Math.min(1.4,+c.rate||1));
    if(kind==='anchor'||kind==='troll'&&/βυθ|bottom/i.test(text)) SS.cancel(); SS.speak(u); return true; }catch(e){ return false; } }
/* αριθμοί όπως λέγονται: 2.5 → «δυόμισι», 3.5 → «τρεισήμισι» (αλλιώς η φωνή λέει «δύο κόμμα πέντε») */
function num(x){ x=Math.round(x*2)/2; if(window.LANG==='en') return String(x).replace('.5',' and a half'); var W=['μηδέν','ένα','δύο','τρία','τέσσερα','πέντε','έξι','επτά','οκτώ','εννιά','δέκα']; var n=Math.floor(x), half=x-n>=0.5;
  if(!half) return n<=10?W[n]:String(n); return ({0:'μισό',1:'ενάμισι',2:'δυόμισι',3:'τρεισήμισι',4:'τεσσερισήμισι',5:'πεντέμισι',6:'εξήμισι'})[n]||(n+' και μισό'); }
function sheet(){ var c=cfg(), sh;
  function sw(lab,sub,get,set){ var i=h('input',{type:'checkbox',checked:!!get()}); i.addEventListener('change',function(){ set(i.checked); }); return h('label',{class:'tg'},i,h('span',null,h('b',{text:lab}),sub?h('small',{class:'tgs',text:sub}):null)); }
  var h=B.h; var body=h('div',{class:'bform'},
    sw(T('Φωνητικές ειδοποιήσεις','Voice announcements'),T('Από το ηχείο του κινητού ή ακουστικό/Bluetooth','From the phone speaker or headphones/Bluetooth'),function(){ return c.on; },function(v){ c.on=v; put(c); }),
    sw(T('Συρτή βυθού','Bottom trolling'),T('«Σταμάτα στα 30», «Στον βυθό», «Βαράει βυθό, μάζεψε 2»','“Stop at 30”, “On the bottom”, “Hitting bottom, bring in 2”'),function(){ return c.k.troll; },function(v){ c.k.troll=v; put(c); }),
    sw(T('Ταχύτητα συρτής','Trolling speed'),T('«Ταχύτητα δυόμισι, ανέβασε»','“Speed two and a half, speed up”'),function(){ return c.k.speed; },function(v){ c.k.speed=v; put(c); }),
    sw(T('Άγκυρα','Anchor'),T('«Η άγκυρα σέρνει, 52 μέτρα»','“Anchor dragging, 52 metres”'),function(){ return c.k.anchor; },function(v){ c.k.anchor=v; put(c); }),
    sw(T('Πλοήγηση','Navigation'),T('«Φτάνεις σε δύο λεπτά», «Έφτασες»','“Arriving in two minutes”, “Arrived”'),function(){ return c.k.nav; },function(v){ c.k.nav=v; put(c); }),
    h('label',{class:'fld'},h('span',{text:T('Ένταση','Volume')}),(function(){ var r=h('input',{type:'range',min:'0.2',max:'1',step:'0.1',value:String(c.vol)}); r.addEventListener('change',function(){ c.vol=+r.value; put(c); }); return r; })()),
    h('button',{class:'btn full',type:'button',text:T('▶ Δοκιμή','▶ Test'),onclick:function(){ unlock(); last={}; say(T('Σταμάτα στα τριάντα μολύβια','Stop at thirty leads'),null,'test',0); }}),
    !SS?h('p',{class:'foot',text:T('Αυτό το κινητό/πρόγραμμα περιήγησης δεν έχει φωνή.','This phone/browser has no speech voice.')}):(!pick()?h('p',{class:'foot',text:T('Δεν βρέθηκε ελληνική φωνή στο κινητό: Ρυθμίσεις Android › Μετατροπή κειμένου σε ομιλία › Ελληνικά.','No Greek voice found on the phone: Android Settings › Text-to-speech › Greek.')}):null));
  sh=B.sheet({title:T('Φωνή','Voice'),body:body}); }
B.say=say; B.sayNum=num; B.sayCfg=cfg; B.saySheet=sheet; B.sayOk=!!SS;
})();
