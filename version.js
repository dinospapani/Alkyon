/* Έκδοση εφαρμογής (ίδια με το όνομα cache στο sw.js) */
window.ALKYON_VERSION='1.9.52';
(function(){ function put(){ var e=document.getElementById('appVer'); if(e) e.textContent='Alkyon '+window.ALKYON_VERSION; } if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',put); else put(); })();
