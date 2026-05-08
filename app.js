const GAS_URL = "https://script.google.com/macros/s/AKfycbyQrjOZz_KQcPTSyUo8XOVoIYJFcHVzdhPetDOeDn342rv8UoabKhU_CNjJzXPbAiDZ/exec";
const KARYAWAN = ["EKY","MUTMAINAH","SUGIARTI","MUJIATI","CHOIRIYAH","AULIA ZULFA","SUWARTINI","INDANG HASTUTIK","IKA NURHAYATI","FAJAR FITRIYAH","SURANI","NUR AMALIA","DWI NINGSIH","LANI ROSSILAWATI","RISWAHYUNINGSIH"];

const video = document.getElementById('kamera');
const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const select = document.getElementById('nama');

KARYAWAN.forEach(n => select.innerHTML += `<option>${n}</option>`);

navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
.then(stream => video.srcObject = stream)
.catch(err => status.innerText = "Kamera error: " + err);

async function prosesAbsen(tipe) {
  status.innerText = "Proses... GPS Lock Dimatikan";
  status.style.color = "orange";
  
  // GPS LOCK OFF: Pakai koordinat 0,0
  const lat = 0;
  const lng = 0;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const foto = canvas.toDataURL('image/jpeg', 0.6);
  
  status.innerText = "Mengirim data...";
  const jam = new Date().toLocaleTimeString('id-ID', {hour12: false});
  
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({nama: select.value, tipe, jam, lat, lng, foto})
    });
    const hasil = await res.json();
    status.innerText = hasil.pesan;
    status.style.color = hasil.status=="sukses"? "green" : "red";
  } catch (e) {
    status.innerText = "Gagal kirim: " + e;
    status.style.color = "red";
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
