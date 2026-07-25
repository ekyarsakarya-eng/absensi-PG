const GAS_URL = 'https://script.google.com/macros/s/AKfycbyVDXgzGGOeEkm205monVjShLmXQv1MPbUbBuVQS2OcdhUpNHgZF_wUoyLKSl96eqCC/exec';
let currentUser = null;
let stream = null;
let gpsData = null;
let alamatData = '';
let jamInterval = null;
let statusHariIni = {masuk:'', pulang:''};
let currentBulan = new Date().getMonth();
let currentTahun = new Date().getFullYear();
let locationLockData = null;
let slipList = [];

function showLoading(show){
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`.nav-item[onclick="showPage('${page}')"]`)?.classList.add('active');
  
  if(page!=='login') document.getElementById('bottomNav').classList.remove('hidden');
  else document.getElementById('bottomNav').classList.add('hidden');

  if(page === 'home') { updateJam(); updateStatusHome(); checkOfflineData(); }
  if(page === 'absensi') initAbsensi();
  if(page === 'rekap') loadRekap();
  if(page === 'profil') loadProfil();
  if(page === 'slip') loadSlipGaji();
}

function updateJam(){
  if(jamInterval) clearInterval(jamInterval);
  const update = ()=>{
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID',{hour12:false});
    const tgl = now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const elJam = document.getElementById('jamSekarang');
    if(elJam) elJam.textContent = jam;
    const elTgl = document.getElementById('tglSekarang');
    if(elTgl) elTgl.textContent = tgl;
    const elTglAbsen = document.getElementById('tglAbsen');
    if(elTglAbsen) elTglAbsen.textContent = tgl;
    const elJamAbsen = document.getElementById('jamAbsen');
    if(elJamAbsen) elJamAbsen.textContent = jam;
    const elWmJam = document.getElementById('wmJamBox');
    if(elWmJam) elWmJam.textContent = jam.replace(/:/g,'.');
    const elWmTgl = document.getElementById('wmTanggal');
    if(elWmTgl) elWmTgl.textContent = now.toLocaleDateString('id-ID');
  };
  update();
  jamInterval = setInterval(update, 1000);
}

function toggleDarkMode(){
  const html = document.documentElement;
  const btn = document.getElementById('btnDarkMode');
  if(html.getAttribute('data-theme')==='dark'){
    html.removeAttribute('data-theme');
    btn.textContent = '🌙';
    localStorage.setItem('theme','light');
  } else {
    html.setAttribute('data-theme','dark');
    btn.textContent = '☀️';
    localStorage.setItem('theme','dark');
  }
}

if(localStorage.getItem('theme')==='dark'){
  document.documentElement.setAttribute('data-theme','dark');
  document.getElementById('btnDarkMode').textContent = '☀️';
}

document.getElementById('btnLogin').addEventListener('click', async ()=>{
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const status = document.getElementById('loginStatus');

  if(!u||!p){ status.textContent = 'Isi username dan password'; status.classList.remove('hidden'); return; }

  showLoading(true);
  status.classList.add('hidden');

  try{
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({action:'login',username:u,password:p}) });
    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      currentUser = {
        nama: hasil.data.nama, username: hasil.data.username,
        foto: hasil.data.fotoProfil || hasil.data.foto || '',
        nohp: hasil.data.nohp || '', alamat: hasil.data.alamat || '',
        rekening: hasil.data.rekening || '', ttl: hasil.data.ttl || ''
      };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      document.getElementById('namaKaryawan').textContent = currentUser.nama;
      document.getElementById('namaAbsen').textContent = currentUser.nama;
      if(currentUser.foto){
        document.getElementById('fotoProfil').src = currentUser.foto;
        document.getElementById('fotoProfil').style.display = 'block';
        document.getElementById('fotoProfilAbsen').src = currentUser.foto;
        document.getElementById('fotoProfilAbsen').style.display = 'block';
      }
      showPage('home');
    } else {
      status.textContent = hasil.message || hasil.pesan || 'Login gagal';
      status.classList.remove('hidden');
    }
  }catch(e){
    showLoading(false);
    status.textContent = 'Koneksi error: '+e.message;
    status.classList.remove('hidden');
  }
});

function logout(){
  currentUser = null;
  statusHariIni = {masuk:'', pulang:''};
  localStorage.removeItem('currentUser');
  localStorage.removeItem('cachedGPS');
  Object.keys(localStorage).forEach(k=>{ if(k.startsWith('statusHariIni_')) localStorage.removeItem(k); });
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
  showPage('login');
}

async function checkOfflineData(){
  const data = JSON.parse(localStorage.getItem('offlineAbsen')||'[]');
  const card = document.getElementById('syncCard');
  if(data.length > 0){
    document.getElementById('syncText').textContent = `Ada ${data.length} data offline`;
    card.style.display = 'block';
    document.getElementById('offlineBadge').classList.add('active');
  } else {
    card.style.display = 'none';
    document.getElementById('offlineBadge').classList.remove('active');
  }
}

async function syncOfflineData(){
  const data = JSON.parse(localStorage.getItem('offlineAbsen')||'[]');
  if(data.length===0) return;
  showLoading(true);
  let sukses = 0;
  for(const d of data){
    try{
      const res = await fetch(GAS_URL,{method:'POST',body:JSON.stringify(d)});
      const hasil = await res.json();
      if(hasil.status==='sukses') sukses++;
    }catch(e){}
  }
  showLoading(false);
  localStorage.setItem('offlineAbsen','[]');
  checkOfflineData();
  alert(`Sync selesai: ${sukses}/${data.length} data berhasil`);
}

async function updateStatusHome(){
  if(!currentUser) return;
  const btn = document.getElementById('btnAbsenCepat');
  const icon = document.getElementById('iconAbsenCepat');
  const text = document.getElementById('textAbsenCepat');
  btn.disabled = true; text.textContent = 'Cek status...'; icon.textContent = 'hourglass_empty';

  try{
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({action:'getStatusHariIni', nama:currentUser.nama}) });
    const hasil = await res.json();
    if(hasil.status==='sukses'){
      statusHariIni.masuk = hasil.data.masuk || '';
      statusHariIni.pulang = hasil.data.pulang || '';
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({ ...statusHariIni, tgl: hasil.data.tanggal }));
    }
  }catch(e){
    statusHariIni = {masuk:'', pulang:''};
    const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
    if(cached) {
      const c = JSON.parse(cached);
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();
      if(c.tgl === todayStr) statusHariIni = c;
    }
  }

  document.getElementById('homeWaktuMasuk').textContent = statusHariIni.masuk || '-';
  document.getElementById('homeWaktuPulang').textContent = statusHariIni.pulang || '-';
  const itemM = document.getElementById('homeItemMasuk');
  const itemP = document.getElementById('homeItemPulang');
  itemM.classList.remove('active','done'); itemP.classList.remove('active','done');

  if(statusHariIni.masuk){
    itemM.classList.add('done');
    if(statusHariIni.pulang){
      itemP.classList.add('done'); btn.disabled = true; icon.textContent = 'check_circle'; text.textContent = 'SUDAH ABSEN LENGKAP';
    } else {
      itemP.classList.add('active'); btn.disabled = false; icon.textContent = 'logout'; text.textContent = 'ABSEN PULANG';
    }
  } else {
    itemM.classList.add('active'); btn.disabled = false; icon.textContent = 'login'; text.textContent = 'ABSEN MASUK';
  }
}

async function cekStatusHariIni(){
  if(!currentUser) return;
  const btn = document.getElementById('btnAksiUtama');
  btn.disabled = true;
  try{
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({action:'getStatusHariIni', nama:currentUser.nama}) });
    const hasil = await res.json();
    if(hasil.status==='sukses'){
      statusHariIni.masuk = hasil.data.masuk || '';
      statusHariIni.pulang = hasil.data.pulang || '';
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({ ...statusHariIni, tgl: hasil.data.tanggal }));
    }
  }catch(e){
    statusHariIni = {masuk:'', pulang:''};
    const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
    if(cached) {
      const c = JSON.parse(cached);
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();
      if(c.tgl === todayStr) statusHariIni = c;
    }
  }
  document.getElementById('waktuMasuk').textContent = statusHariIni.masuk || 'Belum absen';
  document.getElementById('waktuPulang').textContent = statusHariIni.pulang || 'Belum absen';
  const itemM = document.getElementById('itemMasuk');
  const itemP = document.getElementById('itemPulang');
  itemM.classList.remove('active','done'); itemP.classList.remove('active','done');
  if(statusHariIni.masuk){
    itemM.classList.add('done');
    if(statusHariIni.pulang) itemP.classList.add('done');
    else itemP.classList.add('active');
  } else { itemM.classList.add('active'); }
}

async function absenCepatDariHome(){
  showPage('absensi');
  setTimeout(()=>{ document.getElementById('btnAksiUtama').click(); },300);
}

// === OPTIMIZED: initAbsensi dengan parallel execution ===
async function initAbsensi(){
  const wmAlamat = document.getElementById('wmAlamat');
  
  // JALANKAN GPS, LOCATION LOCK, DAN STATUS CHECK SECARA PARALEL
  const promises = [
    getGPS(),
    checkLocationLock(),
    cekStatusHariIni()
  ];
  
  await Promise.all(promises);
  
  // Reverse geocoding hanya jika online & GPS ada (tidak blocking)
  if(gpsData && navigator.onLine){
    getAlamat().then(()=>{
      // Alamat sudah di-set, tidak perlu await
    });
  } else {
    if(wmAlamat) wmAlamat.textContent = 'Alamat tidak tersedia';
  }
  
  updateTombolUtama();
}

// === OPTIMIZED: getGPS dengan cache & fallback ===
async function getGPS(forceHighAccuracy = false){
  return new Promise((resolve)=>{
    if(!navigator.geolocation){
      gpsData = null;
      const wmGps = document.getElementById('wmGps');
      if(wmGps) wmGps.textContent = 'GPS tidak support';
      resolve();
      return;
    }
    
    // CEK CACHE GPS (max 30 detik)
    const cachedGPS = localStorage.getItem('cachedGPS');
    if(cachedGPS && !forceHighAccuracy){
      const parsed = JSON.parse(cachedGPS);
      if(Date.now() - parsed.timestamp < 30000){ // 30 detik
        gpsData = parsed.data;
        const wmGps = document.getElementById('wmGps');
        if(wmGps) wmGps.textContent = `${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)} (cached ±${Math.round(gpsData.accuracy)}m)`;
        resolve();
        return;
      }
    }
    
    const wmGps = document.getElementById('wmGps');
    if(wmGps) wmGps.textContent = 'Mencari GPS...';
    
    // TIMEOUT DINAMIS: 5 detik jika ada cache, 10 detik jika tidak
    const timeout = cachedGPS ? 5000 : 10000;
    
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        gpsData = {
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        // SIMPAN KE CACHE
        localStorage.setItem('cachedGPS', JSON.stringify({
          data: gpsData,
          timestamp: Date.now()
        }));
        if(wmGps) {
          wmGps.textContent = `${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)} (±${Math.round(gpsData.accuracy)}m)`;
        }
        resolve();
      },
      (err)=>{
        // FALLBACK: gunakan cache lama jika ada
        if(cachedGPS){
          const parsed = JSON.parse(cachedGPS);
          gpsData = parsed.data;
          if(wmGps) wmGps.textContent = `${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)} (cache lama ±${Math.round(gpsData.accuracy)}m)`;
          resolve();
          return;
        }
        gpsData = null;
        let errorMsg = 'GPS error';
        if(err.code===1) errorMsg = 'Izin GPS ditolak';
        else if(err.code===2) errorMsg = 'GPS tidak tersedia';
        else if(err.code===3) errorMsg = 'GPS timeout';
        if(wmGps) wmGps.textContent = errorMsg;
        resolve();
      },
      {
        enableHighAccuracy: forceHighAccuracy,
        timeout: timeout,
        maximumAge: 30000
      }
    );
  });
}

async function getAlamat(){
  if(!gpsData){ alamatData = 'Alamat tidak tersedia'; const wmAlamat = document.getElementById('wmAlamat'); if(wmAlamat) wmAlamat.textContent = alamatData; return; }
  if(!navigator.onLine){ alamatData = 'Offline'; const wmAlamat = document.getElementById('wmAlamat'); if(wmAlamat) wmAlamat.textContent = alamatData; return; }
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${gpsData.lat}&lon=${gpsData.lng}`);
    const data = await res.json();
    alamatData = data.display_name || 'Alamat tidak ditemukan';
    const wmAlamat = document.getElementById('wmAlamat');
    if(wmAlamat) wmAlamat.textContent = alamatData;
  }catch(e){
    alamatData = 'Gagal ambil alamat';
    const wmAlamat = document.getElementById('wmAlamat');
    if(wmAlamat) wmAlamat.textContent = alamatData;
  }
}

function updateTombolUtama(){
  const btn = document.getElementById('btnAksiUtama');
  const icon = document.getElementById('iconAksi');
  const judul = document.getElementById('judulAksi');
  const sub = document.getElementById('subAksi');
  if(statusHariIni.masuk && statusHariIni.pulang){
    btn.disabled = true; icon.textContent = 'check_circle'; judul.textContent = 'SELESAI'; sub.textContent = 'Sudah absen masuk & pulang'; btn.textContent = 'SUDAH ABSEN LENGKAP';
  } else if(statusHariIni.masuk){
    btn.disabled = false; btn.dataset.tipe = 'out'; icon.textContent = 'logout'; judul.textContent = 'PULANG'; sub.textContent = 'Tap untuk absen pulang'; btn.textContent = 'ABSEN PULANG';
  } else {
    btn.disabled = false; btn.dataset.tipe = 'in'; icon.textContent = 'login'; judul.textContent = 'MASUK'; sub.textContent = 'Tap untuk absen masuk'; btn.textContent = 'ABSEN MASUK';
  }
}

document.getElementById('btnAksiUtama').addEventListener('click', async ()=>{
  document.getElementById('tombolUtamaAbsen').classList.add('hidden');
  document.getElementById('kameraArea').classList.remove('hidden');
  document.getElementById('btnAmbilFoto').disabled = true;
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}},audio:false});
    const video = document.getElementById('video');
    video.srcObject = stream;
    await video.play().catch(()=>{});
    video.onloadedmetadata = () => { document.getElementById('btnAmbilFoto').disabled = false; };
    setTimeout(()=>{ document.getElementById('btnAmbilFoto').disabled = false; }, 1500);
  }catch(e){
    alert('Gagal buka kamera: '+e.message);
    batalFoto();
  }
});

document.getElementById('btnBatalFoto').addEventListener('click', batalFoto);

function batalFoto(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
  document.getElementById('kameraArea').classList.add('hidden');
  document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
  document.getElementById('preview').classList.add('hidden');
}

// === OPTIMIZED: btnAmbilFoto dengan resolusi lebih kecil ===
document.getElementById('btnAmbilFoto').addEventListener('click', async ()=>{
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // OPTIMIZED: Resolusi lebih kecil untuk upload cepat
  const maxWidth = 800;
  const maxHeight = 600;
  let width = video.videoWidth || 640;
  let height = video.videoHeight || 480;
  
  if(width > maxWidth || height > maxHeight){
    const ratio = Math.min(maxWidth/width, maxHeight/height);
    width = width * ratio;
    height = height * ratio;
  }
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(10, canvas.height-80, 250, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(document.getElementById('wmJamBox').textContent, 15, canvas.height-60);
  ctx.font = '12px Arial';
  ctx.fillText(document.getElementById('wmTanggal').textContent, 15, canvas.height-45);
  ctx.fillText(document.getElementById('wmGps').textContent, 15, canvas.height-30);
  ctx.fillText(document.getElementById('wmAlamat').textContent.substring(0,35), 15, canvas.height-15);

  // OPTIMIZED: Kualitas 0.5 untuk upload lebih cepat
  const b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
  document.getElementById('preview').src = canvas.toDataURL('image/jpeg', 0.5);
  document.getElementById('preview').classList.remove('hidden');
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
  document.getElementById('kameraArea').classList.add('hidden');
  await kirimAbsenCepat(b64);
});

// === OPTIMIZED: kirimAbsenCepat dengan cleanup cache ===
async function kirimAbsenCepat(b64){
  const tipe = document.getElementById('btnAksiUtama').dataset.tipe;
  showNotif('Sabar ya, lagi upload foto keren kamu...', false, true);
  
  if(!gpsData){
    await getGPS(true);
  }

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({ action:'absen', nama:currentUser.nama, tipe:tipe, foto:b64, lat: gpsData? gpsData.lat.toString() : '', lng: gpsData? gpsData.lng.toString() : '', alamat: alamatData })
    });
    const hasil = await res.json();
    if(hasil.status==='sukses'){
      document.getElementById('audioTing').play();
      showNotif('✅ Absen berhasil jam '+hasil.jam, false, false);
      if(tipe==='in') statusHariIni.masuk = hasil.jam;
      else statusHariIni.pulang = hasil.jam;
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({ ...statusHariIni, tgl: todayStr }));
      
      // HAPUS CACHE GPS KARENA SUDAH ABSEN
      localStorage.removeItem('cachedGPS');
      
      await cekStatusHariIni();
      updateTombolUtama();
      setTimeout(()=>{ document.getElementById('tombolUtamaAbsen').classList.remove('hidden'); document.getElementById('preview').classList.add('hidden'); },2000);
    } else {
      const pesanError = hasil.pesan || hasil.message || 'Gagal absen';
      showNotif('❌ ' + pesanError, true, false);
      if(pesanError.includes('meter') || pesanError.includes('lokasi')) alert('⚠️ LOCATION LOCK AKTIF\n\n' + pesanError + '\n\nPastikan Anda berada di lokasi yang ditentukan.');
      setTimeout(batalFoto, 2000);
    }
  }catch(e){
    const offline = JSON.parse(localStorage.getItem('offlineAbsen')||'[]');
    offline.push({ action:'absen', nama:currentUser.nama, tipe:tipe, foto:b64, lat: gpsData? gpsData.lat.toString() : '', lng: gpsData? gpsData.lng.toString() : '', alamat: alamatData, timestamp: Date.now() });
    localStorage.setItem('offlineAbsen', JSON.stringify(offline));
    showNotif('📡 Offline, disimpan dulu. Nanti auto-sync', false, false);
    setTimeout(batalFoto, 2000);
  }
}

function showNotif(txt, err=false, load=false){
  const n = document.getElementById('notifAbsen');
  const ic = document.getElementById('notifIcon');
  document.getElementById('notifText').textContent = txt || (err? 'Terjadi kesalahan' : 'Berhasil');
  n.classList.remove('error');
  if(load) ic.textContent = '⏳';
  else if(err){ ic.textContent = '❌'; n.classList.add('error'); }
  else { ic.textContent = '✅'; }
  n.classList.remove('hidden');
  if(!load) setTimeout(()=>n.classList.add('hidden'), 3000);
}

async function loadRekap(){
  showLoading(true);
  try{
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({ action:'rekap', nama:currentUser.nama, jumlahHari:31, bulan: currentBulan+1, tahun: currentTahun }) });
    const hasil = await res.json();
    showLoading(false);
    if(hasil.status==='sukses') renderRekap(hasil.data);
    else { document.getElementById('rekapEmpty').classList.remove('hidden'); document.getElementById('rekapEmpty').textContent = hasil.pesan || 'Gagal load rekap'; }
  }catch(e){
    showLoading(false);
    document.getElementById('rekapEmpty').classList.remove('hidden');
    document.getElementById('rekapEmpty').textContent = 'Koneksi error: '+e.message;
  }
}

function renderRekap(data){
  const tbody = document.getElementById('rekapBody');
  const empty = document.getElementById('rekapEmpty');
  if(data.length===0){
    tbody.innerHTML = ''; empty.classList.remove('hidden');
    document.getElementById('totalMasuk').textContent = '0';
    document.getElementById('totalJam').textContent = '0j';
    return;
  }
  empty.classList.add('hidden');
  let totalHadir = 0; let totalMenit = 0;
  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('namaBulan').textContent = `${namaBulan[currentBulan]} ${currentTahun}`;
  tbody.innerHTML = data.map(d=>{
    const tgl = d.tanggal.split('/');
    const date = new Date(tgl[2], tgl[1]-1, tgl[0]);
    const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][date.getDay()];
    const isWeekend = date.getDay()===0 || date.getDay()===6;
    const isMin = d.durasi!== '-' && parseInt(d.durasi) < 8;
    if(d.masuk!=='-') totalHadir++;
    if(d.durasi!=='-'){
      const [j,m] = d.durasi.replace('j','').replace('m','').split(' ').map(Number);
      totalMenit += j*60 + (m||0);
    }
    return `<tr class="${isWeekend?'weekend':''} ${isMin?'hari-min':''}"><td>${d.tanggal}</td><td>${hari}</td><td>${d.masuk}</td><td>${d.pulang}</td><td>${d.durasi}</td></tr>`;
  }).join('');
  document.getElementById('totalMasuk').textContent = totalHadir;
  document.getElementById('totalJam').textContent = Math.floor(totalMenit/60)+'j';
}

function gantiBulan(delta){
  currentBulan += delta;
  if(currentBulan > 11){ currentBulan = 0; currentTahun++; }
  if(currentBulan < 0){ currentBulan = 11; currentTahun--; }
  loadRekap();
}

async function loadProfil(){
  if(!currentUser) return;
  document.getElementById('profilNama').textContent = currentUser.nama;
  document.getElementById('profilUsername').textContent = '@'+currentUser.username;
  const foto = currentUser.foto || '';
  document.getElementById('profilFotoBesar').src = foto || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Ccircle cx="60" cy="60" r="60" fill="%23ddd"/%3E%3C/svg%3E';
  document.getElementById('inputNoHP').value = currentUser.nohp || '';
  document.getElementById('inputAlamat').value = currentUser.alamat || '';
  document.getElementById('inputRekening').value = currentUser.rekening || '';
  document.getElementById('inputTTL').value = currentUser.ttl || '';
  document.getElementById('notifFoto').classList.add('hidden');
  document.getElementById('notifPass').classList.add('hidden');
  document.getElementById('notifData').classList.add('hidden');
  document.getElementById('passLama').value = '';
  document.getElementById('passBaru').value = '';
  document.getElementById('passBaru2').value = '';
}

document.getElementById('inputFotoProfil')?.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const notif = document.getElementById('notifFoto');
  notif.className = 'status loading';
  notif.innerHTML = '⏳ Upload foto... Sabar ya';
  notif.classList.remove('hidden');
  try{
    const b64 = await new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    showLoading(true);
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({ action:'updateFoto', username: currentUser.username, foto: b64 }) });
    const hasil = await res.json();
    showLoading(false);
    if(hasil.status==='sukses'){
      currentUser.foto = hasil.fotoUrl;
      document.getElementById('profilFotoBesar').src = hasil.fotoUrl;
      document.getElementById('fotoProfil').src = hasil.fotoUrl;
      document.getElementById('fotoProfil').style.display = 'block';
      document.getElementById('fotoProfilAbsen').src = hasil.fotoUrl;
      document.getElementById('fotoProfilAbsen').style.display = 'block';
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      notif.className = 'status sukses';
      notif.innerHTML = '✅ Foto profil berhasil diupdate!';
      setTimeout(()=>notif.classList.add('hidden'),3000);
    } else {
      notif.className = 'status error';
      notif.innerHTML = '❌ '+hasil.message;
    }
  }catch(e){
    showLoading(false);
    notif.className = 'status error';
    notif.innerHTML = '❌ Gagal upload: '+e.message;
  }
  e.target.value = '';
});

async function gantiPassword(){
  const lama = document.getElementById('passLama').value;
  const baru = document.getElementById('passBaru').value;
  const baru2 = document.getElementById('passBaru2').value;
  const notif = document.getElementById('notifPass');
  if(!lama ||!baru ||!baru2){ notif.className = 'status error'; notif.innerHTML = '❌ Semua field wajib diisi'; notif.classList.remove('hidden'); return; }
  if(baru!== baru2){ notif.className = 'status error'; notif.innerHTML = '❌ Password baru tidak cocok'; notif.classList.remove('hidden'); return; }
  if(baru.length < 5){ notif.className = 'status error'; notif.innerHTML = '❌ Password minimal 5 karakter'; notif.classList.remove('hidden'); return; }
  notif.className = 'status loading';
  notif.innerHTML = '⏳ Update password...';
  notif.classList.remove('hidden');
  try{
    showLoading(true);
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({ action:'updatePassword', username: currentUser.username, passwordLama: lama, passwordBaru: baru }) });
    const hasil = await res.json();
    showLoading(false);
    if(hasil.status==='sukses'){
      notif.className = 'status sukses';
      notif.innerHTML = '✅ Password berhasil diganti!';
      document.getElementById('passLama').value = '';
      document.getElementById('passBaru').value = '';
      document.getElementById('passBaru2').value = '';
      setTimeout(()=>notif.classList.add('hidden'),3000);
    } else {
      notif.className = 'status error';
      notif.innerHTML = '❌ '+hasil.message;
    }
  }catch(e){
    showLoading(false);
    notif.className = 'status error';
    notif.innerHTML = '❌ Gagal: '+e.message;
  }
}

async function updateDataPersonal(){
  const nohp = document.getElementById('inputNoHP').value.trim();
  const alamat = document.getElementById('inputAlamat').value.trim();
  const rekening = document.getElementById('inputRekening').value.trim();
  const ttl = document.getElementById('inputTTL').value.trim();
  const notif = document.getElementById('notifData');
  notif.className = 'status loading';
  notif.innerHTML = '⏳ Simpan data...';
  notif.classList.remove('hidden');
  try{
    showLoading(true);
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({ action:'updateDataPersonal', username: currentUser.username, nohp: nohp, alamat: alamat, rekening: rekening, ttl: ttl }) });
    const hasil = await res.json();
    showLoading(false);
    if(hasil.status==='sukses'){
      currentUser.nohp = nohp; currentUser.alamat = alamat; currentUser.rekening = rekening; currentUser.ttl = ttl;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      notif.className = 'status sukses';
      notif.innerHTML = '✅ Data personal berhasil disimpan!';
      setTimeout(()=>notif.classList.add('hidden'),3000);
    } else {
      notif.className = 'status error';
      notif.innerHTML = '❌ '+hasil.message;
    }
  }catch(e){
    showLoading(false);
    notif.className = 'status error';
    notif.innerHTML = '❌ Gagal: '+e.message;
  }
}

async function checkLocationLock(){
  try{
    const res = await fetch(GAS_URL,{ method:'POST', body:JSON.stringify({action:'getLocationLock'}) });
    const hasil = await res.json();
    if(hasil.status==='sukses' && hasil.data.latitude && hasil.data.longitude){
      locationLockData = hasil.data;
      const lockInfo = document.getElementById('locationLockInfo');
      if(lockInfo){
        lockInfo.classList.remove('hidden');
        document.getElementById('lockNamaLokasi').textContent = `Lokasi: ${hasil.data.namaLokasi || 'Kantor'}`;
        if(gpsData) updateJarakKeLokasi(hasil.data);
      }
      return hasil.data;
    } else {
      locationLockData = null;
      const lockInfo = document.getElementById('locationLockInfo');
      if(lockInfo) lockInfo.classList.add('hidden');
      return null;
    }
  }catch(e){ return null; }
}

function updateJarakKeLokasi(lockData){
  if(!gpsData || !lockData.latitude) return;
  const jarakEl = document.getElementById('lockJarak');
  if(!jarakEl) return;
  const R = 6371e3;
  const φ1 = gpsData.lat * Math.PI / 180;
  const φ2 = parseFloat(lockData.latitude) * Math.PI / 180;
  const Δφ = (parseFloat(lockData.latitude) - gpsData.lat) * Math.PI / 180;
  const Δλ = (parseFloat(lockData.longitude) - gpsData.lng) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const jarak = R * c;
  const radius = parseFloat(lockData.radiusMeter) || 100;
  if(jarak <= radius) jarakEl.innerHTML = `Jarak: <span style="color:#059669">${Math.round(jarak)}m dari lokasi ✓</span>`;
  else jarakEl.innerHTML = `Jarak: <span style="color:#dc2626">${Math.round(jarak)}m (Max: ${radius}m) ✗</span>`;
}

// ===== SLIP GAJI KARYAWAN =====
async function loadSlipGaji(){
  document.getElementById('slipOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'slipOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#f5f7fb;z-index:99999;overflow:auto';
  overlay.innerHTML = `<div style="background:#2563eb;color:white;padding:12px 16px;position:sticky;top:0;z-index:10">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="margin:0;font-size:18px">Slip Gaji</h2>
      <div>
        <button onclick="refreshSlip()" title="Refresh" style="background:rgba(255,255,255,.2);border:none;color:white;padding:6px 10px;border-radius:6px;margin-right:8px;font-size:16px">🔄</button>
        <button onclick="tutupSlip()" style="background:none;border:none;color:white;font-size:28px;line-height:1">×</button>
      </div>
    </div>
    <input id="cariSlip" oninput="renderSlipList(this.value)" placeholder="Cari periode..." style="width:100%;margin-top:10px;padding:10px;border:none;border-radius:8px;font-size:14px">
  </div>
  <div id="slipListContainer" style="padding:8px"></div>`;
  document.body.appendChild(overlay);

  const cacheKey = 'slip_' + currentUser.username;
  const hiddenKey = 'slip_hidden_' + currentUser.username;
  const container = document.getElementById('slipListContainer');
  const parseTgl = p => { const t = p.split(' - ')[0].split('/'); return new Date(t[2], t[1]-1, t[0]); };

  const tampilkan = (list) => {
    const hidden = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
    let data = list.filter(s => !hidden.includes(s.periode));
    data.sort((a,b) => parseTgl(b.periode) - parseTgl(a.periode));
    slipList = data;
    const total = data.reduce((s,x)=>s+Number(x.takeHome),0);
    container.innerHTML = `<div style="padding:8px 16px;color:#64748b;font-size:12px">Total ${data.length} slip • Total Penghasilan: Rp ${total.toLocaleString('id-ID')}</div>` + data.map((s,i)=>`
      <div style="background:white;margin:8px 12px;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);position:relative">
        <button onclick="hapusSlipTampilan('${s.periode}',event)" title="Sembunyikan" style="position:absolute;top:8px;right:8px;background:#fee2e2;border:none;color:#dc2626;width:26px;height:26px;border-radius:50%;font-size:16px;line-height:1">×</button>
        <div onclick="bukaSlip(${i})" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between">
            <div style="font-weight:700;font-size:15px;padding-right:30px">${s.periode}</div>
            ${i===0?'<span style="background:#2563eb;color:white;font-size:10px;padding:3px 8px;border-radius:12px;height:fit-content">TERBARU</span>':''}
          </div>
          <div style="font-size:12px;color:#64748b;margin:2px 0">Dikirim: ${s.tglKirim}</div>
          <div style="color:#2563eb;font-weight:700;margin-top:6px;font-size:16px">Rp ${Number(s.takeHome).toLocaleString('id-ID')}</div>
        </div>
      </div>`).join('');
  };

  window.renderSlipList = (q='') => {
    const all = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const f = all.filter(s => s.periode.toLowerCase().includes(q.toLowerCase()));
    tampilkan(f);
  };

  const cached = localStorage.getItem(cacheKey);
  if(cached){ try{ tampilkan(JSON.parse(cached)); }catch(e){} } else { container.innerHTML = '<div style="padding:40px;text-align:center">Memuat...</div>'; }

  try{
    const res = await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'getSlipGaji',username:currentUser.username})});
    const j = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(j.data||[]));
    tampilkan(j.data||[]);
  }catch(e){}
}

function refreshSlip(){
  const c = document.getElementById('slipListContainer');
  if(c) c.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b">Refresh...</div>';
  localStorage.removeItem('slip_' + currentUser.username);
  localStorage.removeItem('slip_hidden_' + currentUser.username);
  setTimeout(loadSlipGaji, 300);
}

function hapusSlipTampilan(periode, ev){
  ev.stopPropagation();
  const hiddenKey = 'slip_hidden_' + currentUser.username;
  const hidden = JSON.parse(localStorage.getItem(hiddenKey) || '[]');
  if(!hidden.includes(periode)) hidden.push(periode);
  localStorage.setItem(hiddenKey, JSON.stringify(hidden));
  renderSlipList(document.getElementById('cariSlip').value);
}

function tutupSlip(){
  document.getElementById('slipOverlay')?.remove();
  showPage('home');
}

function bukaSlip(i) {
  const s = slipList[i];
  if (!s) return;

  const fmt = n => Number(n || 0).toLocaleString('id-ID');

  const html = `
    <div id="slipContentDetail" style="font-family:'Plus Jakarta Sans',sans-serif;max-width:800px;margin:0 auto;background:white;color:#111;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 32px;color:white;text-align:center">
        <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:.5px">SLIP GAJI PAMILI GARMEN SEMARANG</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:13px">Jl. Semarang Indah Blok C.18 Nomer 8 Semarang</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;padding:20px 32px;border-bottom:2px solid #e5e7eb;gap:16px">
        <div><div style="font-size:11px;color:#64748b;font-weight:800;letter-spacing:1px;text-transform:uppercase">Periode Gaji</div><div style="font-weight:800;font-size:16px;margin-top:4px;color:#0f172a">${s.periode}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#64748b;font-weight:800;letter-spacing:1px;text-transform:uppercase">Nama Karyawan</div><div style="font-weight:800;font-size:16px;margin-top:4px;color:#0f172a">${s.nama.toUpperCase()}</div></div>
      </div>
      <div style="margin:20px 24px;border:2px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#d1fae5;padding:10px 16px;font-weight:800;color:#065f46;font-size:12px;letter-spacing:1px;text-transform:uppercase">Penghasilan</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:10px 16px;font-weight:800">Keterangan</th><th style="text-align:right;padding:10px 16px;font-weight:800">Per Hari</th><th style="text-align:right;padding:10px 16px;font-weight:800">Jml. Hari</th><th style="text-align:right;padding:10px 16px;font-weight:800">Jumlah</th></tr>
          <tr><td style="padding:14px 16px;font-weight:700;border-top:1px solid #e5e7eb">THP Mingguan</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${fmt(s.gajiHari)}</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${s.jmlHari}</td><td style="text-align:right;padding:14px 16px;font-weight:800;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${fmt(s.totalTHP)}</td></tr>
          <tr style="background:#f0fdf4"><td style="padding:14px 16px;font-weight:700">Tunjangan Tanggal Merah/Hari Besar</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums">${s.tunjanganUpah > 0 ? fmt(s.tunjanganUpah) : '-'}</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums">${s.tunjanganHari > 0 ? s.tunjanganHari : '-'}</td><td style="text-align:right;padding:14px 16px;font-weight:800;font-variant-numeric:tabular-nums">${s.totalTunjangan > 0 ? fmt(s.totalTunjangan) : '-'}</td></tr>
        </table>
      </div>
      <div style="margin:20px 24px;border:2px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#dbeafe;padding:10px 16px;font-weight:800;color:#1e40af;font-size:12px;letter-spacing:1px;text-transform:uppercase">Lembur & Bonus</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:10px 16px;font-weight:800">Keterangan</th><th style="text-align:right;padding:10px 16px;font-weight:800">Lembur/Jam</th><th style="text-align:right;padding:10px 16px;font-weight:800">Jml. Lembur</th><th style="text-align:right;padding:10px 16px;font-weight:800">Jumlah</th></tr>
          <tr><td style="padding:14px 16px;font-weight:700;border-top:1px solid #e5e7eb">Lembur S-K</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${fmt(s.upahLembur)}</td><td style="text-align:right;padding:14px 16px;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${s.jmlLembur}</td><td style="text-align:right;padding:14px 16px;font-weight:800;font-variant-numeric:tabular-nums;border-top:1px solid #e5e7eb">${s.totalLembur > 0 ? fmt(s.totalLembur) : '-'}</td></tr>
        </table>
      </div>
      <div style="margin:20px 24px;border:2px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#fef3c7;padding:10px 16px;font-weight:800;color:#92400e;font-size:12px;letter-spacing:1px;text-transform:uppercase">Potongan</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          ${s.potongan > 0 ? `<tr><td style="padding:14px 16px;font-weight:700;color:#dc2626">${s.potonganKet || 'Potongan'}</td><td style="text-align:right;padding:14px 16px;font-weight:800;color:#dc2626;font-variant-numeric:tabular-nums">${fmt(s.potongan)}</td></tr>` : ''}
          ${s.koperasi > 0 ? `<tr style="background:#fffbeb"><td style="padding:14px 16px;font-weight:700">Pinjaman Koperasi${s.koperasiKet ? ' - ' + s.koperasiKet : ''}</td><td style="text-align:right;padding:14px 16px;font-weight:800;font-variant-numeric:tabular-nums">${fmt(s.koperasi)}</td></tr>` : ''}
          ${(!s.potongan || s.potongan === 0) && (!s.koperasi || s.koperasi === 0) ? '<tr><td style="padding:14px 16px;color:#94a3b8" colspan="4">Tidak ada potongan</td></tr>' : ''}
        </table>
      </div>
      <div style="margin:20px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:white;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800;letter-spacing:1px;font-size:13px;text-transform:uppercase">Take Home Pay</div>
        <div style="font-size:24px;font-weight:800">Rp ${fmt(s.takeHome)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:32px 32px 16px;text-align:center;font-size:12px;color:#475569">
        <div><div style="margin-bottom:60px">Diterima Oleh</div><div style="border-top:2px solid #cbd5e1;padding-top:8px;font-weight:800;color:#0f172a;font-size:14px">${s.nama.toUpperCase()}</div><div style="margin-top:4px">Karyawan</div></div>
        <div><div style="margin-bottom:60px">Hormat Kami</div><div style="border-top:2px solid #cbd5e1;padding-top:8px;font-weight:800;color:#0f172a;font-size:14px">HRD / Finance</div><div style="margin-top:4px">Pamili Garmen Semarang</div></div>
      </div>
      <div style="text-align:center;padding:0 32px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;margin-top:16px;padding-top:16px">Slip gaji ini dicetak secara otomatis dan sah tanpa tanda tangan basah • Periode ${s.periode}</div>
    </div>
  `;

  const overlay = document.getElementById('slipOverlay');
  if (overlay) {
    overlay.innerHTML = `
      <div style="background:#2563eb;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10">
        <button onclick="loadSlipGaji()" style="background:none;border:none;color:white;font-size:16px;display:flex;align-items:center;gap:4px">
          <span style="font-size:20px">←</span> Kembali
        </button>
        <button onclick="downloadSlipDetail(${i})" style="background:white;color:#2563eb;border:none;padding:6px 12px;border-radius:6px;font-weight:600;font-size:13px;display:flex;align-items:center;gap:4px">
          <span style="font-size:16px">⬇</span> PDF
        </button>
      </div>
      <div style="background:#f1f5f9;padding:16px;min-height:calc(100vh -50px);overflow:auto">
        ${html}
      </div>
    `;
  }
}

function downloadSlipDetail(i) {
  const el = document.getElementById('slipContentDetail');
  const s = slipList[i];
  if (!el || !s) return;

  const originalText = event.target.innerHTML;
  event.target.innerHTML = `<span style="font-size:16px">⏳</span> Memproses...`;
  event.target.disabled = true;

  html2pdf().set({
    margin: 10,
    filename: `Slip_Gaji_${s.nama}_${s.periode.replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(el).save().then(() => {
    event.target.innerHTML = originalText;
    event.target.disabled = false;
  }).catch(err => {
    console.error("Gagal download PDF:", err);
    event.target.innerHTML = originalText;
    event.target.disabled = false;
    alert("Gagal mengunduh PDF. Pastikan koneksi internet stabil.");
  });
}

function formatRupiah(angka) {
  if (!angka) return '-';
  return new Intl.NumberFormat('id-ID').format(angka);
}

// Auto login jika ada session
window.addEventListener('load', ()=>{
  try{
    const saved = localStorage.getItem('currentUser');
    if(saved){
      currentUser = JSON.parse(saved);
      if(currentUser && currentUser.nama){
        const today = new Date();
        const todayStr = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();
        const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
        if(cached){
          const c = JSON.parse(cached);
          if(c.tgl === todayStr) statusHariIni = c;
          else { localStorage.removeItem('statusHariIni_'+currentUser.username); statusHariIni = {masuk:'', pulang:''}; }
        }
        document.getElementById('namaKaryawan').textContent = currentUser.nama;
        document.getElementById('namaAbsen').textContent = currentUser.nama;
        if(currentUser.foto){
          document.getElementById('fotoProfil').src = currentUser.foto;
          document.getElementById('fotoProfil').style.display = 'block';
          document.getElementById('fotoProfilAbsen').src = currentUser.foto;
          document.getElementById('fotoProfilAbsen').style.display = 'block';
        }
        showPage('home');
        // PRE-LOAD GPS saat login untuk absen lebih cepat
        setTimeout(()=>{ getGPS(); }, 1000);
        return;
      }
    }
  }catch(e){ localStorage.removeItem('currentUser'); }
  showPage('login');
});
