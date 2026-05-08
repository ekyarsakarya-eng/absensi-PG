const GAS_URL = "https://script.google.com/macros/s/AKfycbyQrjOZz_KQcPTSyUo8XOVoIYJFcHVzdhPetDOeDn342rv8UoabKhU_CNjJzXPbAiDZ/exec";
let currentUser = null;

// Cek login waktu buka app
window.onload = () => {
  const savedUser = localStorage.getItem('userPamili');
  if(savedUser){
    currentUser = JSON.parse(savedUser);
    showPage('home');
    document.getElementById('namaKaryawan').textContent = currentUser.nama;
    loadProfil();
  } else {
    showPage('login');
  }
  updateJam();
  setInterval(updateJam, 1000);
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
      if(currentUser.fotoProfil) document.getElementById('fotoProfil').src = currentUser.fotoProfil;
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
    btn.disabled = false;
    btn.textContent = 'Login';
  }
};

function logout(){
  localStorage.removeItem('userPamili');
  currentUser = null;
  location.reload();
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(page==='home') document.querySelectorAll('.nav-item')[0].classList.add('active');
  if(page==='absensi'){
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    cekStatusHariIni();
  }
  if(page==='rekap'){
    document.querySelectorAll('.nav-item')[2].classList.add('active');
    loadRekap();
  }
}

async function cekStatusHariIni(){
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
    // Cari data hari ini pake format dd/MM/yyyy
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
}

let stream = null;
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
    document.getElementById('wmJamBox').textContent = n.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}).replace(':','.');
    document.getElementById('wmTanggal').textContent = n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
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
  showNotif('Mengirim...', false, true);
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
    jam:new Date().toLocaleTimeString('id-ID',{hour12:false}),
    lat:gps.lat,
    lng:gps.lng,
    foto
  };

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
  ic.textContent = load?'hourglass_empty':err?'error':'check_circle';
  if(err) n.classList.add('error');
  n.classList.remove('hidden');
  if(!load) setTimeout(()=>n.classList.add('hidden'), 3000);
}

async function loadRekap(){
  const res = await fetch(GAS_URL,{
    method:'POST',
    body:JSON.stringify({action:'rekap', nama:currentUser.nama, jumlahHari:28})
  });
  const h = await res.json();
  if(h.status==='sukses'){
    tampilkanRekap(h.data);
  }
}

function tampilkanRekap(data){
  const list = document.getElementById('rekapList');
  const empty = document.getElementById('rekapEmpty');
  if(!data.length){
    list.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('totalMasuk').textContent = '0';
    document.getElementById('totalPulang').textContent = '0';
    return;
  }
  empty.classList.add('hidden');
  let m = 0, p = 0;
  data.forEach(d=>{
    if(d.masuk!=='-') m++;
    if(d.pulang!=='-') p++;
  });
  document.getElementById('totalMasuk').textContent = m;
  document.getElementById('totalPulang').textContent = p;

  list.innerHTML = data.map(d=>{
    const lengkap = d.masuk!=='-' && d.pulang!=='-';
    const setengah = d.masuk!=='-' && d.pulang==='-';
    const cls = lengkap?'lengkap':setengah?'setengah':'';
    return `<div class="rekap-item-soft">
      <div>
        <div class="rekap-tgl-soft">Tanggal ${d.tanggal}</div>
        <div class="rekap-jam-soft">
          <div class="jam-badge in"><span class="material-icons-round">login</span>${d.masuk}</div>
          <div class="jam-badge out"><span class="material-icons-round">logout</span>${d.pulang}</div>
        </div>
      </div>
      <div class="status-hari ${cls}"></div>
    </div>`;
  }).join('');
}

async function loadProfil(){
  const res = await fetch(GAS_URL,{
    method:'POST',
    body:JSON.stringify({action:'getProfil', nama:currentUser.nama})
  });
  const h = await res.json();
  if(h.status==='sukses'){
    if(h.data.fotoProfil){
      const u = h.data.fotoProfil + '?t=' + Date.now();
      document.getElementById('fotoProfil').src = u;
      document.getElementById('profilPreview').src = u;
    }
    if(h.data.noHp) document.getElementById('noHp').value = h.data.noHp;
    if(h.data.alamat) document.getElementById('alamat').value = h.data.alamat;
  }
}

document.getElementById('btnGantiPass').onclick = async () => {
  const lama = document.getElementById('passLama').value;
  const baru = document.getElementById('passBaru').value;
  const baru2 = document.getElementById('passBaru2').value;
  const st = document.getElementById('passStatus');

  if(!lama||!baru||!baru2){
    st.textContent = 'Semua field wajib diisi';
    st.className = 'status gagal';
    st.classList.remove('hidden');
    return;
  }
  if(baru!==baru2){
    st.textContent = 'Password baru tidak sama';
    st.className = 'status gagal';
    st.classList.remove('hidden');
    return;
  }
  if(baru.length < 5){
    st.textContent = 'Password minimal 5 karakter';
    st.className = 'status gagal';
    st.classList.remove('hidden');
    return;
  }

  st.textContent = 'Menyimpan...';
  st.className = 'status loading';
  st.classList.remove('hidden');

  const res = await fetch(GAS_URL,{
    method:'POST',
    body:JSON.stringify({action:'gantiPassword', nama:currentUser.nama, passwordLama:lama, passwordBaru:baru})
  });
  const h = await res.json();
  st.textContent = h.pesan;
  st.className = h.status==='sukses'?'status sukses':'status gagal';
  if(h.status==='sukses'){
    document.getElementById('passLama').value = '';
    document.getElementById('passBaru').value = '';
    document.getElementById('passBaru2').value = '';
    playTing();
  }
};

document.getElementById('inputFotoProfil').onchange = e => {
  const f = e.target.files[0];
  if(f){
    const r = new FileReader();
    r.onload = ev => {document.getElementById('profilPreview').src = ev.target.result;};
    r.readAsDataURL(f);
  }
};

document.getElementById('btnSimpanProfil').onclick = async () => {
  const st = document.getElementById('profilStatus');
  st.textContent = 'Mengompres & menyimpan...';
  st.className = 'status loading';
  st.classList.remove('hidden');

  const inp = document.getElementById('inputFotoProfil');
  let foto = '';
  if(inp.files[0]){
    foto = await compressImage(inp.files[0], 400, 0.8);
    document.getElementById('fotoProfil').src = foto;
    document.getElementById('profilPreview').src = foto;
  }

  const data = {
    action:'updateProfil',
    nama:currentUser.nama,
    fotoProfil:foto,
    noHp:document.getElementById('noHp').value,
    alamat:document.getElementById('alamat').value
  };

  const res = await fetch(GAS_URL,{method:'POST', body:JSON.stringify(data)});
  const h = await res.json();
  st.textContent = h.pesan;
  st.className = h.status==='sukses'?'status sukses':'status gagal';
  if(h.status==='sukses' && h.fotoUrl){
    setTimeout(()=>{
      const u = h.fotoUrl + '?t=' + Date.now();
      document.getElementById('fotoProfil').src = u;
      document.getElementById('profilPreview').src = u;
    }, 500);
    playTing();
  }
  inp.value = '';
};

function compressImage(file, maxW, q){
  return new Promise(r=>{
    const rd = new FileReader();
    rd.onload = e => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > maxW){ h = (h * maxW) / w; w = maxW; }
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        r(c.toDataURL('image/jpeg', q));
      };
      img.src = e.target.result;
    };
    rd.readAsDataURL(file);
  });
}

function togglePassword(){
  const i = document.getElementById('password');
  const ic = document.querySelector('#page-login.toggle-pass');
  if(i.type==='password'){i.type='text';ic.textContent='visibility';}
  else{i.type='password';ic.textContent='visibility_off';}
}

function togglePassField(id, el){
  const i = document.getElementById(id);
  if(i.type==='password'){i.type='text';el.textContent='visibility';}
  else{i.type='password';el.textContent='visibility_off';}
}

function playTing(){
  const a = document.getElementById('audioTing');
  a.currentTime = 0;
  a.play().catch(()=>{});
}

document.querySelectorAll('.filter-btn').forEach(b=>{
  b.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const hari = parseInt(b.dataset.range);
    loadRekapCustom(hari);
  };
});

async function loadRekapCustom(hari){
  const res = await fetch(GAS_URL,{
    method:'POST',
    body:JSON.stringify({action:'rekap', nama:currentUser.nama, jumlahHari:hari})
  });
  const h = await res.json();
  if(h.status==='sukses') tampilkanRekap(h.data);
}
