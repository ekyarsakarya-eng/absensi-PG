// PATCH v7.2-detail: Klik nama karyawan = popup rekap mingguan
// Gak ngerubah fungsi MASTER sama sekali

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inject CSS modal sekali aja
  if (!document.getElementById('cssModalDetail')) {
    const style = document.createElement('style');
    style.id = 'cssModalDetail';
    style.innerHTML = `
     .modal-detail{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px}
     .modal-box{background:var(--card);border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;animation:popIn.2s}
      @keyframes popIn{from{transform:scale(.9);opacity:0}}
     .modal-head{padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
     .modal-body{padding:20px;overflow-y:auto}
     .detail-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;text-align:center;font-size:12px}
     .detail-day{background:var(--bg);padding:8px;border-radius:8px}
     .detail-day.minggu{background:#FEE2E2}
     .detail-day.tgl{font-weight:700;margin-bottom:4px}
     .detail-day.jam{font-size:11px;color:var(--text2)}
     .detail-day.lembur{color:#7c3aed;font-weight:600}
     .nama-karyawan-click{cursor:pointer}
     .nama-karyawan-click:hover{color:var(--primary);text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  // 2. Event delegation: tunggu tabel rekap muncul baru pasang klik
  const observer = new MutationObserver(() => {
    const tbody = document.querySelector('#tabelRekapMingguan tbody');
    if (!tbody || tbody.dataset.patched) return;
    tbody.dataset.patched = '1';

    tbody.addEventListener('click', async (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      const tr = td.parentElement;
      const isNamaCell = tr.querySelector('td') === td && tr.rowSpan; // td nama punya rowspan
      if (!isNamaCell) return;

      const nama = td.textContent.trim();
      const tglSabtu = document.getElementById('tglAwalMinggu').value;
      if (!tglSabtu) return alert('Pilih tanggal Sabtu dulu');

      showLoading(true);
      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'getRekapMingguan', tglSabtuStr: tglSabtu })
        });
        const hasil = await res.json();
        showLoading(false);
        if (hasil.error) return alert(hasil.error);

        const dataK = hasil.data.find(k => k.nama === nama);
        if (!dataK) return alert('Data ' + nama + ' tidak ketemu di minggu ini');

        showModalDetail(nama, hasil.periode, hasil.headerTgl, hasil.hari, dataK);
      } catch (err) {
        showLoading(false);
        alert('Gagal load detail: ' + err.message);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 3. Render modal
  function showModalDetail(nama, periode, headerTgl, hari, dataK) {
    const old = document.getElementById('modalDetail');
    if (old) old.remove();

    let gridHTML = headerTgl.map((tgl, i) => {
      const d = dataK.dataHarian[i];
      const isMinggu = hari[i] === 0;
      const tglPendek = tgl.split('/').slice(0, 2).join('/');
      return `
        <div class="detail-day ${isMinggu? 'minggu' : ''}">
          <div class="tgl">${tglPendek}</div>
          <div class="jam">IN: ${d.in || '-'}</div>
          <div class="jam">OUT: ${d.out || '-'}</div>
          ${d.lembur > 0? `<div class="lembur">+${d.lembur}j</div>` : ''}
        </div>
      `;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'modalDetail';
    modal.className = 'modal-detail';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head">
          <div>
            <h3 class="text-lg font-bold">${nama}</h3>
            <p class="text-xs text-slate-500">Periode: ${periode}</p>
          </div>
          <button onclick="this.closest('.modal-detail').remove()" class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <span class="material-icons-round">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-blue-50 p-3 rounded-xl text-center">
              <div class="text-xs text-blue-600">Total Hadir</div>
              <div class="text-2xl font-bold text-blue-700">${dataK.jumlahHari}</div>
            </div>
            <div class="bg-indigo-50 p-3 rounded-xl text-center">
              <div class="text-xs text-indigo-600">Total Lembur</div>
              <div class="text-2xl font-bold text-indigo-700">${dataK.totalLembur}j</div>
            </div>
            <div class="bg-emerald-50 p-3 rounded-xl text-center">
              <div class="text-xs text-emerald-600">Rata-rata</div>
              <div class="text-2xl font-bold text-emerald-700">${(dataK.totalLembur / (dataK.jumlahHari || 1)).toFixed(1)}j</div>
            </div>
          <div class="detail-grid">${gridHTML}</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
  }

  // 4. Bikin nama di tabel bisa diklik
  const stylePatch = document.createElement('style');
  stylePatch.innerHTML = `#tabelRekapMingguan tbody td:first-child{cursor:pointer} #tabelRekapMingguan tbody td:first-child:hover{color:var(--primary);text-decoration:underline}`;
  document.head.appendChild(stylePatch);
});
