const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQrjOZz_KQcPTSyUo8XOVoIYJFcHVzdhPetDOeDn342rv8UoabKhU_CNjJzXPbAiDZ/exec';
let currentUser = null;
let stream = null;
let gpsData = null;
let alamatData = '';
let jamInterval = null;
let statusHariIni = {masuk:'', pulang:'', tanggal:'', sudahSelesai:false};
let currentBulan = new Date().getMonth();
let currentTahun = new Date().getFullYear();

// === INIT & PAGE MANAGEMENT ===
function showLoading(show){
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function showPage(page){
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
  
  // PATCH V7.2: Simpan halaman terakhir
  localStorage.setItem('lastPage', page);
  
  if(page==='home'){
    updateJam();
    loadStatusHariIni();
    checkOfflineData();
  }
  if(page==='absensi'){
    initAbsensi();
  }
  if(page==='rekap'){
    initRekapDropdown(); // PATCH: Init dropdown bulan/tahun
    loadRekap();
  }
  if(page==='profil'){
    loadProfil();
  }
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
    btn.innerHTML = '<span class="material-icons-outlined">dark_mode</span>';
    localStorage.setItem('theme','light');
  } else {
    html.setAttribute('data-theme','dark');
    btn.innerHTML = '<span class="material-icons-outlined">light_mode</span>';
    localStorage.setItem('theme','dark');
  }
}

// PATCH V7.2: Toggle Password Mata Intip
function togglePassword(inputId, btn){
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('.material-icons-outlined');
  if(input.type === 'password'){
    input.type = 'text';
    icon.textContent = 'visibility';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off';
  }
}

if(localStorage.getItem('theme')==='dark'){
  document.documentElement.setAttribute('data-theme','dark');
  document.getElementById('btnDarkMode').innerHTML = '<span class="material-icons-outlined">light_mode</span>';
}

// === LOGIN ===
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
      // PATCH V7.2: Cek last page, default ke home
      const lastPage = localStorage.getItem('lastPage');
      showPage(lastPage && lastPage !== 'login' ? lastPage : 'home');
    } else {
      status.textContent = hasil.message || hasil.pesan || 'Login gagal';
      status.classList.remove('hidden');
    }
  }catch(e){
    showLoading(false);
    status.textContent = 'Koneksi error: ' + e.message;
    status.classList.remove('hidden');
  }
});

// === PATCH V7.2: AUTO LOGIN + REMEMBER PAGE ===
window.addEventListener('load', ()=>{
  const saved = localStorage.getItem('currentUser');
  if(saved){
    currentUser = JSON.parse(saved);
    document.getElementById('namaKaryawan').textContent = currentUser.nama;
    document.getElementById('namaAbsen').textContent = currentUser.nama;
    if(currentUser.foto){
      document.getElementById('fotoProfil').src = currentUser.foto;
      document.getElementById('fotoProfil').style.display = 'block';
      document.getElementById('fotoProfilAbsen').src = currentUser.foto;
      document.getElementById('fotoProfilAbsen').style.display = 'block';
    }
    const lastPage = localStorage.getItem('lastPage');
    showPage(lastPage && lastPage !== 'login' ? lastPage : 'home');
  }
});

// === PATCH V7.2: LOAD STATUS HARI INI - DIPERKETAT ===
async function loadStatusHariIni(){
  if(!currentUser) return;
  const today = new Date().toLocaleDateString('id-ID');
  const key = `absen_${currentUser.username}_${today}`;
  
  // 1. Cek localStorage dulu
  const saved = localStorage.getItem(key);
  if(saved){
    statusHariIni = JSON.parse(saved);
    updateStatusHome();
    updateStatusAbsen();
  }
  
  // 2. SELALU cek ke server untuk data terkini - FIX BUG REFRESH
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'cekStatusHariIni', // ENDPOINT BARU di Code.gs
        username:currentUser.username,
        nama:currentUser.nama
      })
    });
    const hasil = await res.json();
    if(hasil.status==='sukses'){
      statusHariIni = {
        masuk: hasil.data.masuk || '',
        pulang: hasil.data.pulang || '',
        tanggal: today,
        sudahSelesai: (hasil.data.masuk && hasil.data.pulang)
      };
      localStorage.setItem(key, JSON.stringify(statusHariIni));
    } else {
      statusHariIni = {masuk:'', pulang:'', tanggal:today, sudahSelesai:false};
    }
  }catch(e){
    console.log('Gagal load status server:', e);
    // Tetap pake data localStorage kalau ada
    if(!saved){
      statusHariIni = {masuk:'', pulang:'', tanggal:today, sudahSelesai:false};
    }
  }
  updateStatusHome();
  updateStatusAbsen();
}

function updateStatusHome(){
  document.getElementById('homeWaktuMasuk').textContent = statusHariIni.masuk || '-';
  document.getElementById('homeWaktuPulang').textContent = statusHariIni.pulang || '-';
  
  // PATCH V7.2: Lock tombol absen kalau udah selesai
  const btnBuka = document.getElementById('btnBukaAbsen');
  if(statusHariIni.sudahSelesai){
    btnBuka.innerHTML = '<span class="material-icons-outlined">check_circle</span>ABSENSI SELESAI';
    btnBuka.disabled = true;
    btnBuka.classList.remove('btn-primary');
    btnBuka.classList.add('btn-success');
  } else {
    btnBuka.innerHTML = '<span class="material-icons-outlined">camera_alt</span>BUKA ABSENSI';
    btnBuka.disabled = false;
    btnBuka.classList.add('btn-primary');
    btnBuka.classList.remove('btn-success');
  }
}

// === ABSENSI + KAMERA + GPS - FIX BUG TOMBOL ===
async function initAbsensi(){
  await loadStatusHariIni();

  // PATCH V7.2: Lock ketat kalau udah selesai absen hari ini
  if(statusHariIni.sudahSelesai){
    document.getElementById('tombolUtamaAbsen').classList.add('hidden');
    document.getElementById('aktivitasSelesaiCard').classList.remove('hidden');
    document.getElementById('kameraArea').classList.add('hidden');
    return;
  }

  document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
  document.getElementById('aktivitasSelesaiCard').classList.add('hidden');

  // PATCH V7.2: FIX BUG TOMBOL GAK GANTI - Set tipe absen berdasarkan status
  const tipe =!statusHariIni.masuk? 'in' : 'out';
  const btn = document.getElementById('btnAksiUtama');
  const icon = document.getElementById('iconAksi');
  const judul = document.getElementById('judulAksi');
  const sub = document.getElementById('subAksi');

  btn.dataset.tipe = tipe;
  if(tipe === 'in'){
    icon.textContent = 'login';
    judul.textContent = 'ABSEN MASUK';
    sub.textContent = 'Tap untuk mulai foto';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-primary');
  } else {
    icon.textContent = 'logout';
    judul.textContent = 'ABSEN PULANG';
    sub.textContent = 'Tap untuk foto pulang';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
  }
}

function updateStatusAbsen(){
  const masukEl = document.getElementById('waktuMasuk');
  const pulangEl = document.getElementById('waktuPulang');

  if(statusHariIni.masuk){
    masukEl.innerHTML = `<span class="status-badge sukses"><span class="material-icons-outlined" style="font-size:16px">check_circle</span>${statusHariIni.masuk}</span>`;
  } else {
    masukEl.innerHTML = '<span class="status-badge pending"><span class="material-icons-outlined" style="font-size:16px">schedule</span>Belum absen</span>';
  }

  if(statusHariIni.pulang){
    pulangEl.innerHTML = `<span class="status-badge sukses"><span class="material-icons-outlined" style="font-size:16px">check_circle</span>${statusHariIni.pulang}</span>`;
  } else {
    pulangEl.innerHTML = '<span class="status-badge pending"><span class="material-icons-outlined" style="font-size:16px">schedule</span>Belum absen</span>';
  }
}

document.getElementById('btnAksiUtama').addEventListener('click', async ()=>{
  // PATCH V7.2: Triple check lock sebelum buka kamera
  await loadStatusHariIni();
  if(statusHariIni.sudahSelesai){
    showNotif('Absensi hari ini sudah selesai. Silakan absen lagi besok.', 'error');
    initAbsensi();
    return;
  }

  document.getElementById('kameraArea').classList.remove('hidden');
  document.getElementById('tombolUtamaAbsen').classList.add('hidden');
  await startKamera();
  await ambilGPS();
});

async function startKamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: {ideal: 1280}, height: {ideal: 720} }
    });
    document.getElementById('video').srcObject = stream;
  }catch(e){
    showNotif('Gagal akses kamera: ' + e.message, 'error');
  }
}

function stopKamera(){
  if(stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  document.getElementById('video').srcObject = null;
}

async function ambilGPS(){
  document.getElementById('wmGps').textContent = 'Mencari GPS...';
  document.getElementById('wmAlamat').textContent = '-';

  try{
    const pos = await new Promise((resolve, reject)=>{
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    gpsData = {lat, lng};
    document.getElementById('wmGps').textContent = `${lat}, ${lng}`;

    // Reverse geocoding pake Nominatim
    try{
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      alamatData = data.display_name || 'Lokasi tidak diketahui';
      document.getElementById('wmAlamat').textContent = alamatData.substring(0, 60) + '...';
    }catch(e){
      alamatData = 'Gagal ambil alamat';
      document.getElementById('wmAlamat').textContent = alamatData;
    }
  }catch(e){
    gpsData = null;
    document.getElementById('wmGps').textContent = 'GPS tidak aktif';
    document.getElementById('wmAlamat').textContent = 'Aktifkan GPS untuk akurasi';
  }
}

document.getElementById('btnAmbilFoto').addEventListener('click', ()=>{
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const preview = document.getElementById('preview');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  // Watermark - Warna Soft Dove Cerah V7.2
  ctx.fillStyle = 'rgba(90,79,69,0.92)';
  ctx.fillRect(10, canvas.height - 95, canvas.width - 20, 85);

  ctx.fillStyle = 'white';
  ctx.font = 'bold 26px Poppins';
  ctx.fillText(document.getElementById('wmJamBox').textContent, 20, canvas.height - 58);

  ctx.font = '19px Poppins';
  ctx.fillText(document.getElementById('wmTanggal').textContent, 20, canvas.height - 32);

  ctx.font = '15px Poppins';
  ctx.fillText(document.getElementById('wmGps').textContent, canvas.width - 220, canvas.height - 58);

  ctx.font = '13px Poppins';
  const alamat = document.getElementById('wmAlamat').textContent;
  ctx.fillText(alamat.substring(0, 45), canvas.width - 220, canvas.height - 32);

  preview.src = canvas.toDataURL('image/jpeg', 0.9);
  preview.classList.remove('hidden');

  stopKamera();
  document.getElementById('btnAmbilFoto').innerHTML = '<span class="material-icons-outlined">send</span>KIRIM ABSEN';
  document.getElementById('btnAmbilFoto').onclick = kirimAbsen;
});

document.getElementById('btnBatalFoto').addEventListener('click', ()=>{
  stopKamera();
  document.getElementById('kameraArea').classList.add('hidden');
  document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('btnAmbilFoto').innerHTML = '<span class="material-icons-outlined">camera_alt</span>AMBIL FOTO';
  document.getElementById('btnAmbilFoto').onclick = null;
});

async function kirimAbsen(){
  const tipe = document.getElementById('btnAksiUtama').dataset.tipe;
  const foto = document.getElementById('preview').src;

  // PATCH V7.2: Validasi lock ketat sebelum kirim
  await loadStatusHariIni();
  if(statusHariIni.sudahSelesai){
    showNotif('Absensi hari ini sudah selesai!', 'error');
    initAbsensi();
    return;
  }

  if(tipe === 'out' &&!statusHariIni.masuk){
    showNotif('Kamu belum absen masuk hari ini!', 'error');
    return;
  }

  if(tipe === 'in' && statusHariIni.masuk){
    showNotif('Kamu sudah absen masuk hari ini!', 'error');
    initAbsensi();
    return;
  }

  if(!gpsData){
    if(!confirm('GPS tidak aktif. Tetap kirim absen tanpa lokasi?')) return;
  }

  showLoading(true);
  document.getElementById('audioTing').play();

  try{
    const jam = new Date().toLocaleTimeString('id-ID',{hour12:false});
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'absen',
        nama:currentUser.nama,
        username:currentUser.username,
        tipe:tipe,
        jam:jam,
        lat:gpsData?.lat || '0',
        lng:gpsData?.lng || '0',
        foto:foto,
        alamat:alamatData
      })
    });

    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      // PATCH V7.2: Update status lokal langsung
      const today = new Date().toLocaleDateString('id-ID');
      if(tipe === 'in'){
        statusHariIni.masuk = jam;
      } else {
        statusHariIni.pulang = jam;
        statusHariIni.sudahSelesai = true;
      }
      statusHariIni.tanggal = today;
      localStorage.setItem(`absen_${currentUser.username}_${today}`, JSON.stringify(statusHariIni));

      showNotif(`Absen ${tipe==='in'?'masuk':'pulang'} berhasil jam ${jam}!`, 'sukses');

      // Reset UI
      document.getElementById('kameraArea').classList.add('hidden');
      document.getElementById('preview').classList.add('hidden');
      document.getElementById('btnAmbilFoto').innerHTML = '<span class="material-icons-outlined">camera_alt</span>AMBIL FOTO';
      document.getElementById('btnAmbilFoto').onclick = null;

      // Refresh status
      await loadStatusHariIni();
      updateStatusAbsen();
      updateStatusHome();

      // PATCH V7.2: Lock UI kalau udah selesai - FIX BUG TOMBOL
      if(statusHariIni.sudahSelesai){
        document.getElementById('tombolUtamaAbsen').classList.add('hidden');
        document.getElementById('aktivitasSelesaiCard').classList.remove('hidden');
      } else {
        document.getElementById('tombolUtamaAbsen').classList.remove('hidden');
        initAbsensi(); // FIX: Panggil initAbsensi() biar tombol ganti ke "Absen Pulang"
      }
    } else {
      showNotif('Gagal absen: ' + (hasil.message || hasil.pesan), 'error');
    }
  }catch(e){
    showLoading(false);
    showNotif('Error koneksi: ' + e.message, 'error');
  }
}

function showNotif(text, type='loading'){
  const notif = document.getElementById('notifAbsen');
  const icon = document.getElementById('notifIcon');
  const txt = document.getElementById('notifText');

  notif.className = 'status ' + type;
  icon.textContent = type==='sukses'?'check_circle':type==='error'?'error':'info';
  txt.textContent = text;
  notif.classList.remove('hidden');

  if(type!=='loading'){
    setTimeout(()=>notif.classList.add('hidden'), 4000);
  }
}

// === PATCH V7.2: REKAP + DROPDOWN BULAN/TAHUN ===
function initRekapDropdown(){
  const selectTahun = document.getElementById('selectTahun');
  const tahunSekarang = new Date().getFullYear();

  // Generate tahun: 2023 sampe tahun depan
  if(selectTahun.options.length === 0){
    for(let i = tahunSekarang + 1; i >= 2023; i--){
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      selectTahun.appendChild(opt);
    }
  }

  // Set default ke bulan & tahun sekarang
  document.getElementById('selectBulan').value = currentBulan + 1;
  document.getElementById('selectTahun').value = currentTahun;
}

function gantiBulanTahun(){
  currentBulan = parseInt(document.getElementById('selectBulan').value) - 1;
  currentTahun = parseInt(document.getElementById('selectTahun').value);
  loadRekap();
}

async function loadRekap(){
  const bulan = currentBulan + 1;
  const tahun = currentTahun;
  const body = document.getElementById('rekapBody');
  const empty = document.getElementById('rekapEmpty');
  body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-light)">Memuat data...</td></tr>';
  empty.classList.add('hidden');

  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'rekap',
        nama:currentUser.nama,
        bulan:bulan,
        tahun:tahun,
        jumlahHari:31
      })
    });
    const hasil = await res.json();

    if(hasil.status==='sukses' && hasil.data.length > 0){
      let totalMasuk = 0;
      let totalMenit = 0;
      let html = '';

      hasil.data.forEach(d=>{
        const tgl = d.tanggal.split('/');
        const tglObj = new Date(tgl[2], tgl[1]-1, tgl[0]);
        const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][tglObj.getDay()];
        const isWeekend = tglObj.getDay() === 0 || tglObj.getDay() === 6;
        const isHariMin = d.durasi === '-';

        if(d.masuk!== '-') totalMasuk++;
        if(d.durasi!== '-' && d.durasi.includes('j')){
          const parts = d.durasi.match(/(\d+)j\s*(\d+)m/);
          if(parts){
            totalMenit += parseInt(parts[1])*60 + parseInt(parts[2]);
          }
        }

        html += `
          <tr class="${isWeekend?'weekend':''} ${isHariMin?'hari-min':''}">
            <td>${d.tanggal}</td>
            <td>${hari}</td>
            <td>${d.masuk}</td>
            <td>${d.pulang}</td>
            <td>${d.durasi}</td>
          </tr>
        `;
      });

      body.innerHTML = html;
      document.getElementById('totalMasuk').textContent = totalMasuk;
      const jam = Math.floor(totalMenit/60);
      const menit = totalMenit%60;
      document.getElementById('totalJam').textContent = `${jam}j ${menit}m`;
    } else {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('totalMasuk').textContent = '0';
      document.getElementById('totalJam').textContent = '0j';
    }
  }catch(e){
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">Error: ${e.message}</td></tr>`;
  }
}

// === PROFIL ===
function loadProfil(){
  document.getElementById('profilNama').textContent = currentUser.nama;
  document.getElementById('profilUsername').textContent = '@' + currentUser.username;

  if(currentUser.foto){
    document.getElementById('profilFotoBesar').src = currentUser.foto;
    document.getElementById('profilFotoBesar').style.display = 'block';
    document.getElementById('profilIconDefault').style.display = 'none';
  }

  document.getElementById('inputNoHP').value = currentUser.nohp || '';
  document.getElementById('inputAlamat').value = currentUser.alamat || '';
  document.getElementById('inputRekening').value = currentUser.rekening || '';
  document.getElementById('inputTTL').value = currentUser.ttl || '';
}

document.getElementById('inputFotoProfil').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;

  if(file.size > 2*1024*1024){
    showNotifFoto('Foto maksimal 2MB', 'error');
    return;
  }

  showLoading(true);
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const res = await fetch(GAS_URL,{
        method:'POST',
        body:JSON.stringify({
          action:'updateFoto',
          username:currentUser.username,
          foto:reader.result
        })
      });
      const hasil = await res.json();
      showLoading(false);

      if(hasil.status==='sukses'){
        currentUser.foto = hasil.fotoUrl;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('profilFotoBesar').src = hasil.fotoUrl;
        document.getElementById('profilFotoBesar').style.display = 'block';
        document.getElementById('profilIconDefault').style.display = 'none';
        document.getElementById('fotoProfil').src = hasil.fotoUrl;
        document.getElementById('fotoProfil').style.display = 'block';
        document.getElementById('fotoProfilAbsen').src = hasil.fotoUrl;
        document.getElementById('fotoProfilAbsen').style.display = 'block';
        showNotifFoto('Foto profil berhasil diupdate!', 'sukses');
      } else {
        showNotifFoto('Gagal: ' + (hasil.message || hasil.pesan), 'error');
      }
    }catch(e){
      showLoading(false);
      showNotifFoto('Error: ' + e.message, 'error');
    }
  };
  reader.readAsDataURL(file);
});

function showNotifFoto(text, type){
  const notif = document.getElementById('notifFoto');
  notif.className = 'status ' + type;
  notif.innerHTML = `<span class="material-icons-outlined">${type==='sukses'?'check_circle':'error'}</span>${text}`;
  notif.classList.remove('hidden');
  setTimeout(()=>notif.classList.add('hidden'), 3000);
}

async function gantiPassword(){
  const lama = document.getElementById('passLama').value;
  const baru = document.getElementById('passBaru').value;
  const baru2 = document.getElementById('passBaru2').value;
  const notif = document.getElementById('notifPass');

  if(!lama ||!baru ||!baru2){
    showNotifPass('Semua field wajib diisi', 'error');
    return;
  }
  if(baru.length < 5){
    showNotifPass('Password baru minimal 5 karakter', 'error');
    return;
  }
  if(baru!== baru2){
    showNotifPass('Password baru tidak cocok', 'error');
    return;
  }

  showLoading(true);
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'updatePassword',
        username:currentUser.username,
        passwordLama:lama,
        passwordBaru:baru
      })
    });
    const hasil = await res.json();
    showLoading(false);

    if(hasil.status==='sukses'){
      showNotifPass('Password berhasil diganti!', 'sukses');
      document.getElementById('passLama').value = '';
      document.getElementById('passBaru').value = '';
      document.getElementById('passBaru2').value = '';
    } else {
      showNotifPass(hasil.message || hasil.pesan || 'Gagal ganti password', 'error');
    }
  }catch(e){
    showLoading(false);
    showNotifPass('Error: ' + e.message, 'error');
  }
}

function showNotifPass(text, type){
  const notif = document.getElementById('notifPass');
  notif.className = 'status ' + type;
  notif.innerHTML = `<span class="material-icons-outlined">${type==='sukses'?'check_circle':'error'}</span>${text}`;
  notif.classList.remove('hidden');
  setTimeout(()=>notif.classList.add('hidden'), 3000);
}

async function updateDataPersonal(){
  const nohp = document.getElementById('inputNoHP').value.trim();
  const alamat = document.getElementById('inputAlamat').value.trim();
  const rekening = document.getElementById('inputRekening').value.trim();
  const ttl = document.getElementById('inputTTL').value.trim();
  const notif = document.getElementById('notifData');

  showLoading(true);
  try{
    const res = await fetch(GAS_URL,{
      method:'POST',
      body:JSON.stringify({
        action:'updateDataPersonal',
        username:currentUser.username,
        nohp:nohp,
        alamat:alamat,
        rekening:rekening,
        ttl:ttl
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
      notif.innerHTML = '<span class="material-icons-outlined">check_circle</span>Data berhasil disimpan!';
      notif.classList.remove('hidden');
      setTimeout(()=>notif.classList.add('hidden'), 3000);
    } else {
      notif.className = 'status error';
      notif.innerHTML = '<span class="material-icons-outlined">error</span>' + (hasil.message || hasil.pesan);
      notif.classList.remove('hidden');
      setTimeout(()=>notif.classList.add('hidden'), 3000);
    }
  }catch(e){
    showLoading(false);
    notif.className = 'status error';
    notif.innerHTML = '<span class="material-icons-outlined">error</span>Error: ' + e.message;
    notif.classList.remove('hidden');
    setTimeout(()=>notif.classList.add('hidden'), 3000);
  }
}

// === OFFLINE SYNC ===
function checkOfflineData(){
  const keys = Object.keys(localStorage).filter(k => k.startsWith('offline_absen_'));
  if(keys.length > 0){
    document.getElementById('syncCard').style.display = 'block';
    document.getElementById('syncText').textContent = `${keys.length} data belum di-sync`;
  } else {
    document.getElementById('syncCard').style.display = 'none';
  }
}

async function syncOfflineData(){
  const keys = Object.keys(localStorage).filter(k => k.startsWith('offline_absen_'));
  if(keys.length === 0) return;

  showLoading(true);
  let sukses = 0;
  let gagal = 0;

  for(const key of keys){
    const data = JSON.parse(localStorage.getItem(key));
    try{
      const res = await fetch(GAS_URL,{
        method:'POST',
        body:JSON.stringify({...data, action:'absen'})
      });
      const hasil = await res.json();
      if(hasil.status==='sukses'){
        localStorage.removeItem(key);
        sukses++;
      } else {
        gagal++;
      }
    }catch(e){
      gagal++;
    }
  }

  showLoading(false);
  alert(`Sync selesai!\nBerhasil: ${sukses}\nGagal: ${gagal}`);
  checkOfflineData();
  loadStatusHariIni();
}

// === LOGOUT ===
function logout(){
  if(confirm('Yakin mau keluar?')){
    stopKamera();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastPage');
    currentUser = null;
    statusHariIni = {masuk:'', pulang:'', tanggal:'', sudahSelesai:false};
    showPage('login');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }
}

// === AUTO CHECK TANGGAL BARU ===
// Reset status kalau ganti hari - FIX BUG REFRESH BISA ABSEN LAGI
setInterval(()=>{
  const today = new Date().toLocaleDateString('id-ID');
  if(statusHariIni.tanggal && statusHariIni.tanggal!== today){
    statusHariIni = {masuk:'', pulang:'', tanggal:'', sudahSelesai:false};
    if(document.getElementById('page-home').classList.contains('active')){
      updateStatusHome();
    }
    if(document.getElementById('page-absensi').classList.contains('active')){
      initAbsensi();
    }
  }
}, 60000); // Check tiap 1 menit
