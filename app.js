const GAS_URL = 'https://script.google.com/macros/s/AKfycbyVDXgzGGOeEkm205monVjShLmXQv1MPbUbBuVQS2OcdhUpNHgZF_wUoyLKSl96eqCC/exec';
let currentUser = null;
let stream = null;
let gpsData = null;
let alamatData = '';
let jamInterval = null;
let statusHariIni = {masuk:'', pulang:''};
let currentBulan = new Date().getMonth();
let currentTahun = new Date().getFullYear();

function showLoading(show){
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`.nav-item[onclick="showPage('${page}')"]`)?.classList.add('active');
  if(page === 'home') loadHomeData();
  if(page === 'history') loadHistory();
  if(page === 'slip') setTimeout(loadSlipGaji, 50); // <-- ini
}

function updateJam(){
  if(jamInterval) clearInterval(jamInterval);
  const update = ()=>{
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID',{hour12:false});
    const tgl = now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    document.getElementById('jamSekarang').textContent = jam;
    document.getElementById('tglSekarang').textContent = tgl;
    document.getElementById('tglAbsen').textContent = tgl;
    document.getElementById('jamAbsen').textContent = jam;
    document.getElementById('wmJamBox').textContent = jam.replace(/:/g,'.');
    document.getElementById('wmTanggal').textContent = now.toLocaleDateString('id-ID');
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
    btn.textContent = '☀';
    localStorage.setItem('theme','dark');
  }
}

if(localStorage.getItem('theme')==='dark'){
  document.documentElement.setAttribute('data-theme','dark');
  document.getElementById('btnDarkMode').textContent = '☀';
}

document.getElementById('btnLogin').addEventListener('click', async ()=>{
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const status = document.getElementById('loginStatus');

  if(!u||!p){
    status.textContent = 'Isi username dan password';
    status.classList.remove('hidden');
    return;
  }

  showLoading(true);
  status.classList.add('hidden');

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'login',username:u,password:p})
    });
    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      currentUser = {
        nama: hasil.data.nama,
        username: hasil.data.username,
        foto: hasil.data.fotoProfil || hasil.data.foto || '',
        nohp: hasil.data.nohp || '',
        alamat: hasil.data.alamat || '',
        rekening: hasil.data.rekening || '',
        ttl: hasil.data.ttl || ''
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
  // FIX: hapus semua cache status
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith('statusHariIni_')) localStorage.removeItem(k);
  });
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
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

  // FORCE DISABLE DULU SAMPE SELESAI CEK
  btn.disabled = true;
  text.textContent = 'Cek status...';
  icon.textContent = 'hourglass_empty';

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'getStatusHariIni', nama:currentUser.nama})
    });
    const hasil = await res.json();

    if(hasil.status==='sukses'){
      statusHariIni.masuk = hasil.data.masuk || '';
      statusHariIni.pulang = hasil.data.pulang || '';
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({
      ...statusHariIni,
        tgl: hasil.data.tanggal
      }));
    }
  }catch(e){
    statusHariIni = {masuk:'', pulang:''};
    const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
    if(cached) {
      const c = JSON.parse(cached);
      // Cek cache masih hari ini gak
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' +
                       String(today.getMonth()+1).padStart(2,'0') + '/' +
                       today.getFullYear();
      if(c.tgl === todayStr) statusHariIni = c;
    }
  }

  document.getElementById('homeWaktuMasuk').textContent = statusHariIni.masuk || '-';
  document.getElementById('homeWaktuPulang').textContent = statusHariIni.pulang || '-';

  const itemM = document.getElementById('homeItemMasuk');
  const itemP = document.getElementById('homeItemPulang');

  itemM.classList.remove('active','done');
  itemP.classList.remove('active','done');

  if(statusHariIni.masuk){
    itemM.classList.add('done');
    if(statusHariIni.pulang){
      itemP.classList.add('done');
      btn.disabled = true; // KUNCI TOTAL
      icon.textContent = 'check_circle';
      text.textContent = 'SUDAH ABSEN LENGKAP';
    } else {
      itemP.classList.add('active');
      btn.disabled = false;
      icon.textContent = 'logout';
      text.textContent = 'ABSEN PULANG';
    }
  } else {
    itemM.classList.add('active');
    btn.disabled = false;
    icon.textContent = 'login';
    text.textContent = 'ABSEN MASUK';
  }
}

async function cekStatusHariIni(){
  if(!currentUser) return;

  const btn = document.getElementById('btnAksiUtama');
  btn.disabled = true; // FORCE DISABLE

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({action:'getStatusHariIni', nama:currentUser.nama})
    });
    const hasil = await res.json();

    if(hasil.status==='sukses'){
      statusHariIni.masuk = hasil.data.masuk || '';
      statusHariIni.pulang = hasil.data.pulang || '';
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({
      ...statusHariIni,
        tgl: hasil.data.tanggal
      }));
    }
  }catch(e){
    statusHariIni = {masuk:'', pulang:''};
    const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
    if(cached) {
      const c = JSON.parse(cached);
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' +
                       String(today.getMonth()+1).padStart(2,'0') + '/' +
                       today.getFullYear();
      if(c.tgl === todayStr) statusHariIni = c;
    }
  }

  document.getElementById('waktuMasuk').textContent = statusHariIni.masuk || 'Belum absen';
  document.getElementById('waktuPulang').textContent = statusHariIni.pulang || 'Belum absen';

  const itemM = document.getElementById('itemMasuk');
  const itemP = document.getElementById('itemPulang');
  itemM.classList.remove('active','done');
  itemP.classList.remove('active','done');

  if(statusHariIni.masuk){
    itemM.classList.add('done');
    if(statusHariIni.pulang){
      itemP.classList.add('done');
    } else {
      itemP.classList.add('active');
    }
  } else {
    itemM.classList.add('active');
  }
}

async function absenCepatDariHome(){
  showPage('absensi');
  setTimeout(()=>{
    document.getElementById('btnAksiUtama').click();
  },300);
}

async function initAbsensi(){
  await getGPS();
  await getAlamat();
  await cekStatusHariIni(); // FIX: udah ada await, tapi pastiin urutan
  updateTombolUtama();
}

async function getGPS(){
  return new Promise((res)=>{
    if(!navigator.geolocation){
      gpsData = null;
      document.getElementById('wmGps').textContent = 'GPS tidak support';
      res();
      return;
    }
    navigator.geolocation.getCurrentPosition(pos=>{
      gpsData = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      document.getElementById('wmGps').textContent = `${gpsData.lat.toFixed(6)}, ${gpsData.lng.toFixed(6)}`;
      res();
    },err=>{
      gpsData = null;
      document.getElementById('wmGps').textContent = 'GPS error';
      res();
    },{enableHighAccuracy:true,timeout:5000});
  });
}

async function getAlamat(){
  if(!gpsData){
    alamatData = 'Alamat tidak tersedia';
    document.getElementById('wmAlamat').textContent = alamatData;
    return;
  }
  if(!navigator.onLine){
    alamatData = 'Offline';
    document.getElementById('wmAlamat').textContent = alamatData;
    return;
  }
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${gpsData.lat}&lon=${gpsData.lng}`);
    const data = await res.json();
    alamatData = data.display_name || 'Alamat tidak ditemukan';
    document.getElementById('wmAlamat').textContent = alamatData;
  }catch(e){
    alamatData = 'Gagal ambil alamat';
    document.getElementById('wmAlamat').textContent = alamatData;
  }
}

function updateTombolUtama(){
  const btn = document.getElementById('btnAksiUtama');
  const icon = document.getElementById('iconAksi');
  const judul = document.getElementById('judulAksi');
  const sub = document.getElementById('subAksi');

  if(statusHariIni.masuk && statusHariIni.pulang){
    btn.disabled = true;
    icon.textContent = 'check_circle';
    judul.textContent = 'SELESAI';
    sub.textContent = 'Sudah absen masuk & pulang';
    btn.textContent = 'SUDAH ABSEN LENGKAP';
  } else if(statusHariIni.masuk){
    btn.disabled = false;
    btn.dataset.tipe = 'out';
    icon.textContent = 'logout';
    judul.textContent = 'PULANG';
    sub.textContent = 'Tap untuk absen pulang';
    btn.textContent = 'ABSEN PULANG';
  } else {
    btn.disabled = false;
    btn.dataset.tipe = 'in';
    icon.textContent = 'login';
    judul.textContent = 'MASUK';
    sub.textContent = 'Tap untuk absen masuk';
    btn.textContent = 'ABSEN MASUK';
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
    video.onloadedmetadata = () => {
      document.getElementById('btnAmbilFoto').disabled = false;
    };
    setTimeout(()=>{ document.getElementById('btnAmbilFoto').disabled = false; }, 1500);
  }catch(e){
    alert('Gagal buka kamera: '+e.message);
    batalFoto();
  }
});

document.getElementById('btnBatalFoto').addEventListener('click', batalFoto);

function batalFoto(){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
  document.getElementById('kameraArea').classList.add('hidden');
  document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
  document.getElementById('preview').classList.add('hidden');
}

document.getElementById('btnAmbilFoto').addEventListener('click', async ()=>{
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  ctx.drawImage(video,0,0,canvas.width,canvas.height);

  // Watermark
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(10, canvas.height-80, 250, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(document.getElementById('wmJamBox').textContent, 15, canvas.height-60);
  ctx.font = '12px Arial';
  ctx.fillText(document.getElementById('wmTanggal').textContent, 15, canvas.height-45);
  ctx.fillText(document.getElementById('wmGps').textContent, 15, canvas.height-30);
  ctx.fillText(document.getElementById('wmAlamat').textContent.substring(0,35), 15, canvas.height-15);

  const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  document.getElementById('preview').src = canvas.toDataURL('image/jpeg', 0.6);
  document.getElementById('preview').classList.remove('hidden');

  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
  document.getElementById('kameraArea').classList.add('hidden');

  await kirimAbsenCepat(b64);
});

async function kirimAbsenCepat(b64){
  const tipe = document.getElementById('btnAksiUtama').dataset.tipe;
  showNotif('Sabar ya, lagi upload foto keren kamu...', false, true);

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'absen',
        nama:currentUser.nama,
        tipe:tipe,
        foto:b64,
        gps: gpsData? `${gpsData.lat},${gpsData.lng}` : '',
        alamat: alamatData
      })
    });
    const hasil = await res.json();

    if(hasil.status==='sukses'){
      document.getElementById('audioTing').play();
      showNotif('✅ Absen berhasil jam '+hasil.jam, false, false);

      // FIX: langsung update dari response, gak nunggu fetch lagi
      if(tipe==='in'){
        statusHariIni.masuk = hasil.jam;
      } else {
        statusHariIni.pulang = hasil.jam;
      }
      const today = new Date();
      const todayStr = String(today.getDate()).padStart(2,'0') + '/' +
                       String(today.getMonth()+1).padStart(2,'0') + '/' +
                       today.getFullYear();
      localStorage.setItem('statusHariIni_'+currentUser.username, JSON.stringify({
      ...statusHariIni,
        tgl: todayStr
      }));

      await cekStatusHariIni();
      updateTombolUtama();
      setTimeout(()=>{
        document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
        document.getElementById('preview').classList.add('hidden');
      },2000);
    } else {
      showNotif('❌ '+(hasil.message || hasil.pesan || 'Gagal absen'), true, false);
      setTimeout(batalFoto, 2000);
    }
  }catch(e){
    // Simpan offline
    const offline = JSON.parse(localStorage.getItem('offlineAbsen')||'[]');
    offline.push({
      action:'absen',
      nama:currentUser.nama,
      tipe:tipe,
      foto:b64,
      gps: gpsData? `${gpsData.lat},${gpsData.lng}` : '',
      alamat: alamatData,
      timestamp: Date.now()
    });
    localStorage.setItem('offlineAbsen', JSON.stringify(offline));
    showNotif('📡 Offline, disimpan dulu. Nanti auto-sync', false, false);
    setTimeout(batalFoto, 2000);
  }
}

function showNotif(txt, err=false, load=false){
  const n = document.getElementById('notifAbsen');
  const ic = document.getElementById('notifIcon');

  // Fix: kalau txt kosong/undefined, kasih default
  const text = txt || (err? 'Terjadi kesalahan' : 'Berhasil');
  document.getElementById('notifText').textContent = text;

  n.classList.remove('error');

  if(load){
    ic.textContent = '⏳';
  } else if(err){
    ic.textContent = '❌';
    n.classList.add('error');
  } else {
    ic.textContent = '✅';
  }

  n.classList.remove('hidden');
  if(!load) setTimeout(()=>n.classList.add('hidden'), 3000);
}

async function loadRekap(){
  showLoading(true);
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'rekap',
        nama:currentUser.nama,
        jumlahHari:31,
        bulan: currentBulan+1,
        tahun: currentTahun
      })
    });
    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      renderRekap(hasil.data);
    } else {
      document.getElementById('rekapEmpty').classList.remove('hidden');
      document.getElementById('rekapEmpty').textContent = hasil.pesan || 'Gagal load rekap';
    }
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
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('totalMasuk').textContent = '0';
    document.getElementById('totalJam').textContent = '0j';
    return;
  }

  empty.classList.add('hidden');
  let totalHadir = 0;
  let totalMenit = 0;

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
      totalMenit += j*60 + m;
    }

    return `
      <tr class="${isWeekend?'weekend':''} ${isMin?'hari-min':''}">
        <td>${d.tanggal}</td>
        <td>${hari}</td>
        <td>${d.masuk}</td>
        <td>${d.pulang}</td>
        <td>${d.durasi}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('totalMasuk').textContent = totalHadir;
  const jam = Math.floor(totalMenit/60);
  document.getElementById('totalJam').textContent = jam+'j';
}

function gantiBulan(delta){
  currentBulan += delta;
  if(currentBulan > 11){
    currentBulan = 0;
    currentTahun++;
  }
  if(currentBulan < 0){
    currentBulan = 11;
    currentTahun--;
  }
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
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'updateFoto',
        username: currentUser.username,
        foto: b64
      })
    });
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

  if(!lama ||!baru ||!baru2){
    notif.className = 'status error';
    notif.innerHTML = '❌ Semua field wajib diisi';
    notif.classList.remove('hidden');
    return;
  }
  if(baru!== baru2){
    notif.className = 'status error';
    notif.innerHTML = '❌ Password baru tidak cocok';
    notif.classList.remove('hidden');
    return;
  }
  if(baru.length < 5){
    notif.className = 'status error';
    notif.innerHTML = '❌ Password minimal 5 karakter';
    notif.classList.remove('hidden');
    return;
  }

  notif.className = 'status loading';
  notif.innerHTML = '⏳ Update password...';
  notif.classList.remove('hidden');

  try{
    showLoading(true);
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'updatePassword',
        username: currentUser.username,
        passwordLama: lama,
        passwordBaru: baru
      })
    });
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
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'updateDataPersonal',
        username: currentUser.username,
        nohp: nohp,
        alamat: alamat,
        rekening: rekening,
        ttl: ttl
      })
    });
    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      currentUser.nohp = nohp;
      currentUser.alamat = alamat;
      currentUser.rekening = rekening;
      currentUser.ttl = ttl;
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

// Auto login jika ada session
window.addEventListener('load', ()=>{
  try{
    const saved = localStorage.getItem('currentUser');
    if(saved){
      currentUser = JSON.parse(saved);
      if(currentUser && currentUser.nama){
        // FIX: load status cache dulu, tapi cek tanggal
        const today = new Date();
        const todayStr = String(today.getDate()).padStart(2,'0') + '/' +
                         String(today.getMonth()+1).padStart(2,'0') + '/' +
                         today.getFullYear();
        const cached = localStorage.getItem('statusHariIni_'+currentUser.username);
        if(cached){
          const c = JSON.parse(cached);
          if(c.tgl === todayStr){
            statusHariIni = c;
          } else {
            localStorage.removeItem('statusHariIni_'+currentUser.username);
            statusHariIni = {masuk:'', pulang:''};
          }
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
        return;
      }
    }
  }catch(e){
    localStorage.removeItem('currentUser');
  }
  showPage('login');
});

// ===== SLIP GAJI KARYAWAN =====
async function showPage(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if(page!=='login'){
    document.getElementById('bottomNav').classList.remove('hidden');
    const nav = document.querySelector(`.nav-item[onclick="showPage('${page}')"]`);
    if(nav) nav.classList.add('active');
  } else {
    document.getElementById('bottomNav').classList.add('hidden');
  }

  if(page==='home'){
    updateJam();
    await updateStatusHome();
    checkOfflineData();
  }
  if(page==='absensi'){
    await initAbsensi();
  }
  if(page==='rekap'){
    loadRekap();
  }
  if(page==='profil'){
    loadProfil();
  }
  if(page==='slip'){
    loadSlipGaji();
  }
}

// ===== SLIP GAJI - JANGAN DIEDIT BAGIAN LAIN =====
let slipList = [];

async function loadSlipGaji(){
  document.getElementById('slipOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'slipOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#f5f7fb;z-index:99999;overflow:auto';
  overlay.innerHTML = `<div style="background:#2563eb;color:white;padding:12px 16px;position:sticky;top:0;z-index:10">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="margin:0;font-size:18px">Slip Gaji</h2>
      <div>
        <button onclick="refreshSlip()" title="Refresh" style="background:rgba(255,255,255,.2);border:none;color:white;padding:6px 10px;border-radius:6px;margin-right:8px;font-size:16px">↻</button>
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
    let data = list.filter(s =>!hidden.includes(s.periode));
    data.sort((a,b) => parseTgl(a.periode) - parseTgl(b.periode));
    slipList = data;
    const total = data.reduce((s,x)=>s+Number(x.takeHome),0);
    const terbaru = data.length-1;
    container.innerHTML = `<div style="padding:8px 16px;color:#64748b;font-size:12px">Total ${data.length} slip • Rp ${total.toLocaleString('id-ID')}</div>` + data.map((s,i)=>`
      <div style="background:white;margin:8px 12px;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);position:relative">
        <button onclick="hapusSlipTampilan('${s.periode}',event)" title="Sembunyikan" style="position:absolute;top:8px;right:8px;background:#fee2e2;border:none;color:#dc2626;width:26px;height:26px;border-radius:50%;font-size:16px;line-height:1">×</button>
        <div onclick="bukaSlip(${i})" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between"><div style="font-weight:700;font-size:15px;padding-right:30px">${s.periode}</div>${i===terbaru?'<span style="background:#2563eb;color:white;font-size:10px;padding:3px 8px;border-radius:12px;height:fit-content">TERBARU</span>':''}</div>
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

  // cache dulu
  const cached = localStorage.getItem(cacheKey);
  if(cached){ try{ tampilkan(JSON.parse(cached)); }catch(e){} } else { container.innerHTML = '<div style="padding:40px;text-align:center">Memuat...</div>'; }

  // update server
  try{
    const res = await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'getSlipGaji',username:currentUser.username})});
    const j = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(j.data||[]));
    tampilkan(j.data||[]);
  }catch(e){}
}

// === TAMBAHKAN 2 FUNGSI INI DI BAWAHNYA ===
function refreshSlip(){
  const c = document.getElementById('slipListContainer');
  if(c) c.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b">Refresh...</div>';
  // hapus cache DAN daftar sembunyikan
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

function tutupSlip(){document.getElementById('slipOverlay')?.remove();showPage('home');}

function bukaSlip(i){
  const s = slipList[i];
  const fmt = n => Number(n||0).toLocaleString('id-ID');
  const tunjHariTotal = Number(s.totalTunjangan) - Number(s.tunjanganUpah);

  const html = `<div id="slipContent" style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;background:white;color:#111">
    <div style="background:#2563eb;color:white;padding:20px 24px">
      <div style="font-weight:700;font-size:18px">SLIP GAJI PAMILI GARMEN SEMARANG</div>
      <div style="font-size:12px;opacity:.9;margin-top:2px">Jl. Semarang Indah Blok C 16 Nomor 8 Semarang</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 24px;border-bottom:1px solid #eee;font-size:13px">
      <div><div style="color:#64748b;font-size:11px">PERIODE GAJI</div><div style="font-weight:700">${s.periode}</div></div>
      <div><div style="color:#64748b;font-size:11px">NAMA KARYAWAN</div><div style="font-weight:700">${s.nama}</div></div>
    </div>
    <div style="padding:0 16px;margin-top:12px">
      <div style="background:#d1fae5;color:#065f46;padding:8px 12px;font-weight:700;font-size:13px;border-radius:6px 6px 0 0">PENGHASILAN</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f8fafc;color:#64748b"><th style="text-align:left;padding:8px;border:1px solid #e5e7eb">KETERANGAN</th><th style="text-align:right;padding:8px;border:1px solid #e5e7eb">PER HARI</th><th style="text-align:center;padding:8px;border:1px solid #e5e7eb">JML. HARI</th><th style="text-align:right;padding:8px;border:1px solid #e5e7eb">JUMLAH</th></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">THP Mingguan</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${fmt(s.gajiHari)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${s.jmlHari}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${fmt(s.totalTHP)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Tunjangan Tanggal Merah/Hari besar</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${s.tunjanganHari>0?fmt(s.tunjanganHari):'-'}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${s.tunjanganHari>0?s.jmlHari:'-'}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${tunjHariTotal>0?fmt(tunjHariTotal):'-'}</td></tr>
      </table>
    </div>
    <div style="padding:0 16px;margin-top:12px">
      <div style="background:#dbeafe;color:#1e40af;padding:8px 12px;font-weight:700;font-size:13px;border-radius:6px 6px 0 0">LEMBUR & BONUS</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f8fafc;color:#64748b"><th style="text-align:left;padding:8px;border:1px solid #e5e7eb">KETERANGAN</th><th style="text-align:right;padding:8px;border:1px solid #e5e7eb">LEMBUR/JAM</th><th style="text-align:center;padding:8px;border:1px solid #e5e7eb">JML. LEMBUR</th><th style="text-align:right;padding:8px;border:1px solid #e5e7eb">JUMLAH</th></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Lembur S-K</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${fmt(s.upahLembur)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${s.jmlLembur}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${fmt(s.totalLembur)}</td></tr>
      </table>
    </div>
    <div style="padding:0 16px;margin-top:12px">
      <div style="background:#fef3c7;color:#92400e;padding:8px 12px;font-weight:700;font-size:13px;border-radius:6px 6px 0 0">POTONGAN</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:8px;border:1px solid #e5e7eb">Pinjaman koperasi ${s.koperasiKet?`(${s.koperasiKet})`:''}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;width:120px">${Number(s.koperasi)>0?fmt(s.koperasi):'-'}</td></tr></table>
    </div>
    <div style="margin:16px;background:#0f172a;color:white;padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700">TAKE HOME PAY</div><div style="font-weight:700;font-size:18px">Rp ${fmt(s.takeHome)}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:20px 40px 40px;text-align:center;font-size:12px;color:#475569"><div><div>Diterima Oleh</div><div style="height:60px"></div><div style="border-top:1px solid #cbd5e1;padding-top:4px;font-weight:600">${s.nama}</div><div>Karyawan</div></div><div><div>Hormat Kami</div><div style="height:60px"></div><div style="border-top:1px solid #cbd5e1;padding-top:4px;font-weight:600">HRD / Finance</div><div>Pamili Garmen Semarang</div></div></div>
  </div>`;

  document.getElementById('slipOverlay').innerHTML = `<div style="background:#2563eb;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0"><button onclick="loadSlipGaji()" style="background:none;border:none;color:white">← Kembali</button><button onclick="downloadSlip(${i})" style="background:white;color:#2563eb;border:none;padding:6px 12px;border-radius:6px;font-weight:600">PDF</button></div><div style="background:#f1f5f9;padding:12px 0">${html}</div>`;
}

function downloadSlip(i){const el=document.getElementById('slipContent');const s=slipList[i];html2pdf().set({margin:10,filename:`Slip_${s.nama}.pdf`}).from(el).save();}
