const GAS_URL = "https://script.google.com/macros/s/AKfycbyVDXgzGGOeEkm205monVjShLmXQv1MPbUbBuVQS2OcdhUpNHgZF_wUoyLKSl96eqCC/exec";
const KANTOR_LAT = -0.0000;
const KANTOR_LNG = 000.000000;

const KARYAWAN = ["MUTMAINAH","SUGIARTI","MUJIATI","CHOIRIYAH","AULIA ZULFA","SUWARTINI","INDANG HASTUTIK","IKA NURHAYATI","FAJAR FITRIYAH","SURANI","NUR AMALIA","DWI NINGSIH","LANI ROSSILAWATI","RISWAHYUNINGSIH"];

const video = document.getElementById('kamera');
const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const select = document.getElementById('nama');

// Isi dropdown nama
KARYAWAN.forEach(n => select.innerHTML += `<option>${n}</option>`);

// Nyalain kamera depan
navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
.then(stream => video.srcObject = stream)
.catch(err => status.innerText = "Kamera error: " + err);

async function prosesAbsen(tipe) {
  status.innerText = "Mengambil lokasi GPS...";
  status.style.color = "black";
  
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    
    // Jepret foto
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const foto = canvas.toDataURL('image/jpeg', 0.6);
    
    // Kirim ke GAS
    status.innerText = "Mengirim data ke server...";
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
    
  }, (err) => {
    status.innerText = "GPS Error: Nyalakan lokasi HP";
    status.style.color = "red";
  }, { enableHighAccuracy: true, timeout: 10000 });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
