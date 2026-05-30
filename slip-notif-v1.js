// slip-notif-v1.js - plugin notifikasi HP, tidak ganggu app.js v18
(function(){
  try {
    // daftar service worker (kalau belum ada)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }

    async function cekSlipBaru(){
      if (!window.GAS_URL ||!window.currentUser) return;
      if (!('Notification' in window)) return;

      if (Notification.permission!== 'granted') {
        try { await Notification.requestPermission(); } catch(e){}
      }
      if (Notification.permission!== 'granted') return;

      try {
        const res = await fetch(GAS_URL, {
          method:'POST',
          headers:{'Content-Type':'text/plain'},
          body:JSON.stringify({action:'getSlipGaji', username: currentUser.username})
        });
        const j = await res.json();
        if (!j.data ||!j.data.length) return;

        const parse = p => { const t = p.split(' - ')[0].split('/'); return new Date(t[2], t[1]-1, t[0]); };
        j.data.sort((a,b)=> parse(a.periode)-parse(b.periode));
        const terbaru = j.data[j.data.length-1].periode;
        const key = 'lastSlipNotified_' + currentUser.username;

        if (localStorage.getItem(key)!== terbaru) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('SLIP GAJI TERBARU READY', {
              body: 'Periode ' + terbaru + ' sudah bisa dibuka',
              icon: 'icon-192.png',
              badge: 'icon-192.png',
              vibrate: [200,100,200],
              tag: 'slip-gaji'
            });
          }).catch(()=>{});
          localStorage.setItem(key, terbaru);
        }
      } catch(e) { console.log('notif skip', e); }
    }

    // pasang ke showMainApp tanpa ubah app.js
    const _orig = window.showMainApp;
    if (typeof _orig === 'function') {
      window.showMainApp = function(){
        const r = _orig.apply(this, arguments);
        // tunggu 2 detik biar login selesai
        setTimeout(cekSlipBaru, 2000);
        return r;
      };
    }
  } catch(err) {
    console.error('slip-notif-v1 error (absensi aman):', err);
  }
})();
