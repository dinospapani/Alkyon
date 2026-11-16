/* 1.14.48: ένα είδος, ένα όνομα. Το ίδιο ψάρι γράφεται με πολλούς τρόπους (Dentex / Common dentex / Συναγρίδα,
   Μαγιάτικο / Μινέρι, Πέρκα / Painted comber). Το spKey δίνει το ίδιο κλειδί σε όλες τις γραφές (το λατινικό όνομα),
   για να μετρούν μαζί σε ρεκόρ και στατιστικά· το spName δίνει ένα όνομα ανά γλώσσα. Τα δεδομένα δεν αλλάζουν. */
(function(){
  var EN=window.LANG==='en', M=null, L=null, N=-1, base=window.spName, baseD=window.dataName;
  /* γραφές που δεν υπάρχουν στις λίστες */
  var EXTRA={'dentex':'dentex dentex','synagrida':'dentex dentex','sea bass':'dicentrarchus labrax','seabass':'dicentrarchus labrax','amberjack':'seriola dumerili','barracuda':'sphyraena sphyraena','squid':'loligo vulgaris','calamari':'loligo vulgaris','octopus':'octopus vulgaris','grouper':'epinephelus marginatus'};
  /* κυπριακά ονόματα (από τη λίστα του Τμήματος Αλιείας) για είδη που οι άλλες λίστες έχουν με άλλο όνομα· η πλήρης λίστα φορτώνει αργότερα */
  var CYN={"γόππα":"boops boops","γύλος":"coris julis","δράκαινα":"trachinus draco","κοκκαλάρης":"squalus acanthias","κολαούζος":"polyprion americanus","κουρκούνα άσπρη":"siganus rivulatus","κουρκούνα μαύρη":"siganus luridus","λυθρίνι":"pagellus erythrinus","μάκερελ":"scomberomorus commerson","μελάνα":"oblada melanura","μινέρι":"seriola dumerili","μουγγρί":"conger conger","μουδιάστρα":"torpedo marmorata","μούρμουρος":"lithognathus mormyrus","μπαλάς":"pagellus bogaraveo","μυλοκόπι":"umbrina cirrosa","ούγενα":"diplodus puntazzo","παπαπέτρος":"zeus faber","πεζουνόψαρο":"myliobatis aquila","πιθκιαύλι":"fistularia commersonii","πιλότος":"naucrates ductor","ράζα":"raja clavata","σάρπα":"sarpa salpa","σκαθάρι":"spondyliosoma cantharus","σκορπιός":"helicolenus dactylopterus","σορκός":"diplodus sargus","σορκός φαραώ":"diplodus cervinus","στρίλια":"mullus barbatus","σφύρνα":"sphyraena sphyraena","τονάκι":"thunnus alalunga","τούνα":"thunnus thynnus","φατσούκλι":"pagellus acarne","φρίσσα":"sardinella aurita","χάννος":"serranus cabrilla","χαρατζίδα":"diplodus vulgaris","χοίρος":"balistes capriscus"};
  /* ελληνικά ονόματα που στη θάλασσα σημαίνουν άλλο ψάρι από ό,τι στο γλυκό νερό */
  var SEA={'πέρκα':'serranus scriba','λούτσος':'sphyraena sphyraena'}, LAKE={'πέρκα':'perca fluviatilis','λούτσος':'esox lucius'};
  function cnt(){ return ((window.SPKB||[]).length)+((window.SPECIES_DB||[]).length)+((window.CY100||[]).length); }
  function lake(){ try{ return JSON.parse(localStorage.getItem('alkyon-fprof')||'""')==='lake'; }catch(e){ return false; } }
  function build(){ M={}; L={}; N=cnt();
    function rec(el,en,lat){ if(!lat) return; var lk=String(lat).trim().toLowerCase(), c=L[lk]||(L[lk]={en:'',el:''});
      var els=String(el||'').split('/').map(function(x){ return x.trim(); }).filter(Boolean), ens=String(en||'').split(/[\/,]/).map(function(x){ return x.trim(); }).filter(Boolean);
      if(!c.en&&ens[0]) c.en=ens[0]; if(!c.el&&els[0]) c.el=els[0];
      els.concat(ens,[lk]).forEach(function(x){ var k=x.toLowerCase(); if(k.length>=3&&!M[k]) M[k]=lk; }); }
    (window.SPKB||[]).forEach(function(x){ rec(x.n,x.en,x.l); }); (window.SPECIES_DB||[]).forEach(function(e){ rec(e[0],e[1],e[2]); }); (window.CY100||[]).forEach(function(x){ rec(x.n,x.e,x.l); });
    Object.keys(EXTRA).forEach(function(k){ if(!M[k]&&L[EXTRA[k]]) M[k]=EXTRA[k]; });
    Object.keys(CYN).forEach(function(k){ if(!M[k]&&L[CYN[k]]) M[k]=CYN[k]; });
    var O=lake()?LAKE:SEA; Object.keys(O).forEach(function(k){ if(L[O[k]]) M[k]=O[k]; }); }
  function lat(n){ if(!M||N!==cnt()) build(); return M[String(n).trim().toLowerCase()]||null; }
  /* το ίδιο κλειδί για κάθε γραφή του ίδιου είδους */
  window.spKey=function(n){ if(!n) return ''; var k=String(n).trim().toLowerCase(); return lat(k)||k; };
  window.spLatin=function(n){ return n?lat(n):null; };
  function name(n,prev){ if(!n) return n; var s=String(n), l=lat(s), c=l&&L[l];
    if(c){ if(EN){ if(c.en) return c.en; } else if(/[A-Za-z]{3}/.test(s)&&c.el) return c.el; }   /* στα ελληνικά μένει όπως το έγραψες (Μινέρι μένει Μινέρι) */
    return prev?prev(n):n; }
  window.spName=function(n){ return name(n,base); };
  if(!EN||baseD) window.dataName=function(n){ return name(n,baseD); }; else window.dataName=function(n){ return name(n,function(x){ /* 1.14.57: στα αγγλικά και τα δολώματα/τεχνικές που γράφτηκαν ελληνικά (π.χ. «Ζωντανή σουπιά») */ try{ return window.AlkyonTr?window.AlkyonTr(x):x; }catch(e){ return x; } }); };
})();
