const GAS_URL = "https://script.google.com/macros/s/AKfycbyQrjOZz_KQcPTSyUo8XOVoIYJFcHVzdhPetDOeDn342rv8UoabKhU_CNjJzXPbAiDZ/exec";
let currentUser = null;
let stream = null;
let rekapCache = [];
let bulanAktif = new Date();
let offlineQueue = JSON.parse(localStorage.getItem('offlineAbsen') || '[]');

// 1. LOGOUT + 4. DARK MODE + 5. OFFLINE
window.onload = () => {
  initTheme();
  checkOfflineStatus();
  window.addEventListener('online', syncOfflineData);
  window.addEventListener('offline', () => {
    document.getElementById('offlineBadge').classList.add('active');
  });
  
  const savedUser = localStorage.getItem('userPamili');
  if(savedUser){
    currentUser = JSON.parse(savedUser);
    showPage('home');
    document.getElementById('namaKaryawan').textContent = currentUser.nama;
    document.getElementById('namaAbsen').textContent = currentUser.nama;
    const fotoEl = document.getElementById('fotoProfil');
    const fotoAbsenEl = document.getElementById('fotoProfilAbsen');
    if(currentUser.fotoProfil){
      if(fotoEl){ fotoEl.src = currentUser.fotoProfil; fotoEl.style.display = 'block'; }
      if(fotoAbsenEl){ fotoAbsenEl.src = currentUser.fotoProfil; fotoAbsenEl.style.display = 'block'; }
    }
    document.getElementById('bottomNav').classList.remove('hidden');
    loadProfil();
    updateSyncCard();
  } else {
    showPage('login');
  }
  updateJam();
  setInterval(updateJam, 1000);
}

function initTheme(){
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btnDarkMode');
  if(btn) btn.textContent = theme === 'dark'? '☀️' : '🌙';
}

function toggleDarkMode(){
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark'? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('btnDarkMode').textContent = next === 'dark'? '☀️' : '🌙';
}

function checkOfflineStatus(){
  if(!navigator.onLine) document.getElementById('offlineBadge').classList.add('active');
  else document.getElementById('offlineBadge').classList.remove('active');
}

function updateSyncCard(){
  const card = document.getElementById('syncCard');
  const text = document.getElementById('syncText');
  if(offlineQueue.length > 0){
    card.style.display = 'block';
    text.textContent = `Ada ${offlineQueue.length} data offline`;
  } else {
    card.style.display = 'none';
  }
}

async function syncOfflineData(){
  if(offlineQueue.length === 0) return;
  document.getElementById('offlineBadge').classList.remove('active');
  showLoading(true);
  
  let sukses = 0;
  for(let i = offlineQueue.length - 1; i >= 0; i--){
    try{
      const res = await fetch(GAS_URL, {method:'POST', body:JSON.stringify(offlineQueue[i])});
      const h = await res.json();
      if(h.status === 'sukses'){
        offlineQueue.splice(i, 1);
        sukses++;
      }
    }catch(e){
      console.log('Sync gagal:', e);
    }
  }
  
  localStorage.setItem('offlineAbsen', JSON.stringify(offlineQueue));
  updateSyncCard();
  showLoading(false);
  if(sukses > 0){
    showNotif(`${sukses} data offline berhasil disync`, false);
    playTing();
  }
}

function updateJam(){
  const now = new Date();
  const jamEl = document.getElementById('jamSekarang');
  const tglEl = document.getElementById('tglSekarang');
  if(jamEl) jamEl.textContent = now.toLocaleTimeString('id-ID',{hour12:false});
  if(tglEl) tglEl.textContent = now.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  const jamAbsen = document.getElementById('jamAbsen');
  const tglAbsen = document.getElementById('tglAbsen');
  if(jamAbsen) jamAbsen.textContent = now.toLocaleTimeString('id-ID',{hour12:false});
  if(tglAbsen) tglAbsen.textContent = now.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}

document.getElementById('btnLogin').onclick = async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const status = document.getElementById('loginStatus');
  const btn = document.getElementById('btnLogin');

  if(!username ||!password){
    status.textContent = 'Isi username dan password';
    status.className = 'status gagal';
    status.classList.remove('hidden');
    return;
  }

  showLoading(true);
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  status.classList.add('hidden');

  try{
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({action:'login', username, password})
    });
    const hasil = await res.json();

    if(hasil.status === 'sukses'){
      currentUser = hasil.data;
      localStorage.setItem('userPamili', JSON.stringify(currentUser));
      document.getElementById('namaKaryawan').textContent = currentUser.nama;
      document.getElementById('namaAbsen').textContent = currentUser.nama;
      const fotoEl = document.getElementById('fotoProfil');
      const fotoAbsenEl = document.getElementById('fotoProfilAbsen');
      if(currentUser.fotoProfil){
        if(fotoEl){ fotoEl.src = currentUser.fotoProfil; fotoEl.style.display = 'block'; }
        if(fotoAbsenEl){ fotoAbsenEl.src = currentUser.fotoProfil; fotoAbsenEl.style.display = 'block'; }
      }
      showPage('home');
      document.getElementById('bottomNav').classList.remove('hidden');
      playTing();
    } else {
      throw new Error(hasil.pesan);
    }
  } catch(err){
    status.textContent = err.message || 'Login gagal';
    status.className = 'status gagal';
    status.classList.remove('hidden');
  } finally {
    showLoading(false);
    btn.disabled = false;
    btn.textContent = 'Login';
  }
};

function showLoading(show){
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function logout(){
  if(confirm('Yakin mau logout?')){
    localStorage.removeItem('userPamili');
    currentUser = null;
    location.reload();
  }
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById('page-'+page);
  if(el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(page==='home'){
  document.querySelectorAll('.nav-item')[0].classList.add('active');
  updateStatusHome();
}
  if(page==='absensi'){
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    cekStatusHariIni();
  }
  if(page==='rekap'){
    document.querySelectorAll('.nav-item')[2].classList.add('active');
    loadRekapBulanan();
  }
  
  if(page!== 'absensi') stopKamera();
}

async function updateStatusHome(){
  if(!currentUser) return;
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'rekap', nama:currentUser.nama, jumlahHari:31})
    });
    const hasil = await res.json();
    
    const btn = document.getElementById('btnAbsenCepat');
    const icon = document.getElementById('iconAbsenCepat');
    const text = document.getElementById('textAbsenCepat');
    const im = document.getElementById('homeItemMasuk');
    const ip = document.getElementById('homeItemPulang');
    
    im.classList.remove('active','done');
    ip.classList.remove('active','done');
    btn.disabled = false;
    
    if(hasil.status==='sukses' && hasil.data.length > 0){
      const tglHariIni = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
      const d = hasil.data.find(x => x.tanggal === tglHariIni);
      
      if(d && d.masuk!=='-'){
        im.classList.add('done');
        document.getElementById('homeWaktuMasuk').textContent = d.masuk;
        if(d.pulang!=='-'){
          ip.classList.add('done');
          document.getElementById('homeWaktuPulang').textContent = d.pulang;
          btn.disabled = true;
          icon.textContent = 'check_circle';
          text.textContent = 'ABSEN SELESAI';
        } else {
          ip.classList.add('active');
          document.getElementById('homeWaktuPulang').textContent = '-';
          icon.textContent = 'logout';
          text.textContent = 'ABSEN PULANG';
          btn.dataset.tipe = 'out';
        }
      } else {
        im.classList.add('active');
        document.getElementById('homeWaktuMasuk').textContent = '-';
        document.getElementById('homeWaktuPulang').textContent = '-';
        icon.textContent = 'login';
        text.textContent = 'ABSEN MASUK';
        btn.dataset.tipe = 'in';
      }
    } else {
      im.classList.add('active');
      document.getElementById('homeWaktuMasuk').textContent = '-';
      document.getElementById('homeWaktuPulang').textContent = '-';
      icon.textContent = 'login';
      text.textContent = 'ABSEN MASUK';
      btn.dataset.tipe = 'in';
    }
  }catch(e){
    console.log('Update status home error:', e);
  }
}

function absenCepatDariHome(){
  const btn = document.getElementById('btnAbsenCepat');
  if(btn.disabled) return;
  showPage('absensi');
  // Auto trigger absen setelah pindah page
  setTimeout(()=>{
    document.getElementById('btnAksiUtama').click();
  }, 300);
}

async function cekStatusHariIni(){
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'rekap', nama:currentUser.nama, jumlahHari:31})
    });
    const hasil = await res.json();

    const btn = document.getElementById('btnAksiUtama');
    const im = document.getElementById('itemMasuk');
    const ip = document.getElementById('itemPulang');

    im.classList.remove('active','done');
    ip.classList.remove('active','done');
    btn.disabled = false;

    if(hasil.status==='sukses' && hasil.data.length > 0){
      const tglHariIni = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
      const d = hasil.data.find(x => x.tanggal === tglHariIni);

      if(d && d.masuk!=='-'){
        im.classList.add('done');
        document.getElementById('waktuMasuk').textContent = d.masuk;
        if(d.pulang!=='-'){
          ip.classList.add('done');
          document.getElementById('waktuPulang').textContent = d.pulang;
          btn.disabled = true;
          document.getElementById('judulAksi').textContent = 'SELESAI';
          document.getElementById('subAksi').textContent = 'Absen hari ini lengkap';
          document.getElementById('iconAksi').textContent = 'check_circle';
          btn.dataset.tipe = 'done';
        } else {
          ip.classList.add('active');
          btn.dataset.tipe = 'out';
          document.getElementById('judulAksi').textContent = 'PULANG';
          document.getElementById('subAksi').textContent = 'Tap untuk absen pulang';
          document.getElementById('iconAksi').textContent = 'logout';
        }
      } else {
        im.classList.add('active');
        document.getElementById('waktuMasuk').textContent = 'Belum absen';
        document.getElementById('waktuPulang').textContent = 'Belum absen';
        btn.dataset.tipe = 'in';
        document.getElementById('judulAksi').textContent = 'MASUK';
        document.getElementById('subAksi').textContent = 'Tap untuk absen masuk';
        document.getElementById('iconAksi').textContent = 'login';
      }
    } else {
      im.classList.add('active');
      btn.dataset.tipe = 'in';
      document.getElementById('judulAksi').textContent = 'MASUK';
      document.getElementById('subAksi').textContent = 'Tap untuk absen masuk';
      document.getElementById('iconAksi').textContent = 'login';
    }
  }catch(e){
    console.error('Cek status error:', e);
  }
}

document.getElementById('btnAksiUtama').onclick = () => {
  const tipe = document.getElementById('btnAksiUtama').dataset.tipe;
  if(tipe==='done') return;
  bukaKameraAbsen(tipe);
};

async function bukaKameraAbsen(tipe){
  document.getElementById('tombolUtamaAbsen').classList.add('hidden');
  document.getElementById('kameraArea').classList.remove('hidden');
  document.getElementById('notifAbsen').classList.add('hidden');
  document.getElementById('preview').classList.add('hidden');

  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'user', width:{ideal:640}, height:{ideal:480}},
      audio:false
    });
    document.getElementById('video').srcObject = stream;
    startWatermark();
  }catch(e){
    showNotif('Kamera error: '+e.message, true);
    batalFoto();
  }
}

function startWatermark(){
  const updateWM = () => {
    const n = new Date();
    document.getElementById('wmJamBox').textContent = n.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).replace(':','.');
    document.getElementById('wmTanggal').textContent = n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  };
  updateWM();
  window.wmInterval = setInterval(updateWM, 1000);

  navigator.geolocation.getCurrentPosition(p=>{
    document.getElementById('wmGps').textContent = `${Math.abs(p.coords.latitude).toFixed(6)}°S, ${Math.abs(p.coords.longitude).toFixed(6)}°E`;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`)
.then(r=>r.json())
.then(d=>{document.getElementById('wmAlamat').textContent = d.display_name||''});
  });
}

document.getElementById('btnAmbilFoto').onclick = () => {
  const v = document.getElementById('video');
  const c = document.getElementById('canvas');
  const max = 600;
  let w = v.videoWidth, h = v.videoHeight;
  if(w > max){ h = (h * max) / w; w = max; }
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  const foto = c.toDataURL('image/jpeg', 0.6);
  stopKamera();
  document.getElementById('preview').src = foto;
  document.getElementById('preview').classList.remove('hidden');
  kirimAbsenCepat(document.getElementById('btnAksiUtama').dataset.tipe, foto);
};

document.getElementById('btnBatalFoto').onclick = batalFoto;

function batalFoto(){
  clearInterval(window.wmInterval);
  stopKamera();
  document.getElementById('kameraArea').classList.add('hidden');
  document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
}

function stopKamera(){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
}

async function kirimAbsenCepat(tipe, foto){
  showNotif('Mengirim Foto...Stay Tuned...', false, true);
  document.getElementById('kameraArea').classList.add('hidden');

  const gps = await new Promise(r=>{
    navigator.geolocation.getCurrentPosition(
      p=>r({lat:p.coords.latitude, lng:p.coords.longitude}),
      ()=>r({lat:0,lng:0}),
      {timeout:2000}
    )
  });

  const data = {
    action:'absen',
    nama:currentUser.nama,
    tipe,
    jam:new Date().toLocaleTimeString('id-ID',{hour12:false,timeZone:'Asia/Jakarta'}),
    lat:gps.lat,
    lng:gps.lng,
    foto
  };

  if(!navigator.onLine){
    offlineQueue.push({...data, timestamp: Date.now()});
    localStorage.setItem('offlineAbsen', JSON.stringify(offlineQueue));
    updateSyncCard();
    showNotif('Disimpan offline. Akan dikirim otomatis saat online', false);
    document.getElementById('offlineBadge').classList.add('active');
    setTimeout(()=>{
      cekStatusHariIni();
      document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
      document.getElementById('preview').classList.add('hidden');
    }, 800);
    return;
  }

  try{
    const res = await fetch(GAS_URL,{method:'POST', body:JSON.stringify(data)});
    const h = await res.json();
    if(h.status==='sukses'){
      showNotif(tipe==='in'?'Absen Masuk Berhasil!':'Absen Pulang Berhasil!', false);
      playTing();
      setTimeout(()=>{
        cekStatusHariIni();
        document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
        document.getElementById('preview').classList.add('hidden');
      }, 800);
    } else {
      showNotif(h.pesan, true);
      document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
    }
  } catch(e){
    showNotif('Gagal kirim: '+e.message, true);
    document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
  }
}

function showNotif(txt, err=false, load=false){
  const n = document.getElementById('notifAbsen');
  const ic = document.getElementById('notifIcon');
  document.getElementById('notifText').textContent = txt;
  n.classList.remove('error');
  
  // Ganti icon text jadi emoji biar gak muncul hourglass_empty
  if(load){
    ic.textContent = '⏳'; // emoji jam pasir
  } else if(err){
    ic.textContent = '❌';
  } else {
    ic.textContent = '✅';
  }
  
  if(err) n.classList.add('error');
  n.classList.remove('hidden');
  if(!load) setTimeout(()=>n.classList.add('hidden'), 3000);
}

// REKAP BULANAN - GANTI 7/14/30 HARI
function gantiBulan(delta){
  bulanAktif.setMonth(bulanAktif.getMonth() + delta);
  loadRekapBulanan();
}

async function loadRekapBulanan(){
  showLoading(true);
  const tahun = bulanAktif.getFullYear();
  const bulan = bulanAktif.getMonth();
  const namaBulan = bulanAktif.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  document.getElementById('namaBulan').textContent = namaBulan;
  
  const hariDalamBulan = new Date(tahun, bulan + 1, 0).getDate();
  
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'rekap', nama:currentUser.nama, jumlahHari:60})
    });
    const h = await res.json();
    
    if(h.status=='sukses'){
      rekapCache = h.data;
      renderTabelBulanan(tahun, bulan, hariDalamBulan);
    }
  }catch(e){
    console.error('Load rekap error:', e);
    document.getElementById('rekapEmpty').classList.remove('hidden');
  }finally{
    showLoading(false);
  }
}

function renderTabelBulanan(tahun, bulan, jumlahHari){
  const tbody = document.getElementById('rekapBody');
  const hariList = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  let html = '';
  let totalHadir = 0;
  let totalMenitKerja = 0;
  
  for(let tgl = 1; tgl <= jumlahHari; tgl++){
    const date = new Date(tahun, bulan, tgl);
    const tglStr = `${String(tgl).padStart(2,'0')}/${String(bulan+1).padStart(2,'0')}/${tahun}`;
    const hari = hariList[date.getDay()];
    const isWeekend = date.getDay() === 0;
    
    const data = rekapCache.find(x => x.tanggal === tglStr) || {masuk:'-', pulang:'-'};
    const durasi = hitungDurasi(data.masuk, data.pulang);
    
    if(data.masuk!== '-') totalHadir++;
    totalMenitKerja += menitKeAngka(data.masuk, data.pulang);
    
    const rowClass = isWeekend? 'weekend' : '';
    const hariClass = isWeekend? 'hari-min' : '';
    
    html += `
      <tr class="${rowClass}">
        <td>${tglStr}</td>
        <td class="${hariClass}">${hari}</td>
        <td style="color:${data.masuk==='-'?'var(--text2)':'#198754'};font-weight:600">${data.masuk}</td>
        <td style="color:${data.pulang==='-'?'var(--text2)':'#DC3545'};font-weight:600">${data.pulang}</td>
        <td style="color:${durasi==='-'?'var(--text2)':'var(--primary)'};font-weight:700">${durasi}</td>
      </tr>
    `;
  }
  
  tbody.innerHTML = html;
  
  const totalJam = Math.floor(totalMenitKerja/60);
  const sisaMenit = totalMenitKerja%60;
  document.getElementById('totalMasuk').textContent = totalHadir;
  document.getElementById('totalJam').textContent = `${totalJam}j ${sisaMenit}m`;
  
  document.getElementById('rekapEmpty').classList.toggle('hidden', totalHadir > 0);
}

function hitungDurasi(jamMasuk, jamPulang){
  if(!jamMasuk || !jamPulang || jamMasuk=='-' || jamPulang=='-') return '-';
  
  // Normalisasi format: ganti . jadi : dan ambil jam:menit aja
  const normalJam = (j) => {
    return j.replace(/\./g,':').split(':').slice(0,2).map(Number);
  }
  
  const [h1,m1] = normalJam(jamMasuk);
  const [h2,m2] = normalJam(jamPulang);
  
  if(isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return '-';
  
  const menit1 = h1*60 + m1;
  const menit2 = h2*60 + m2;
  const selisih = menit2 - menit1;
  
  if(selisih <= 0) return '-';
  const jam = Math.floor(selisih/60);
  const menit = selisih%60;
  return `${jam}j ${menit}m`;
}

function menitKeAngka(jamMasuk, jamPulang){
  if(!jamMasuk || !jamPulang || jamMasuk=='-' || jamPulang=='-') return 0;
  
  const normalJam = (j) => {
    return j.replace(/\./g,':').split(':').slice(0,2).map(Number);
  }
  
  const [h1,m1] = normalJam(jamMasuk);
  const [h2,m2] = normalJam(jamPulang);
  
  if(isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  
  const selisih = (h2*60+m2) - (h1*60+m1);
  return selisih > 0 ? selisih : 0;
}

async function loadProfil(){
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'getProfil', nama:currentUser.nama})
    });
    const h = await res.json();
    if(h.status==='sukses'){
      const fotoEl = document.getElementById('fotoProfil');
      const fotoAbsenEl = document.getElementById('fotoProfilAbsen');
      if(h.data.fotoProfil){
        const u = h.data.fotoProfil + '?t=' + Date.now();
        if(fotoEl){ fotoEl.src = u; fotoEl.style.display = 'block'; }
        if(fotoAbsenEl){ fotoAbsenEl.src = u; fotoAbsenEl.style.display = 'block'; }
      }
    }
  }catch(e){
    console.error('Load profil error:', e);
  }
}

function playTing(){
  const a = document.getElementById('audioTing');
  a.currentTime = 0;
  a.play().catch(()=>{});
}

function togglePassword(){
  const i = document.getElementById('password');
  const ic = event.target;
  if(i.type=='password'){i.type='text';ic.textContent='👁️'}
  else{i.type='password';ic.textContent='👁️‍🗨️'}
}
