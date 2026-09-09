# Aturan Main — Kelayakan, Peran & Penerbitan Sertifikat

Ditulis 4 Sep 2026 setelah tahap 7, diperbarui 8 Sep 2026 setelah tahap 8. Aturan-aturan
ini berulang kali menyebabkan kebingungan saat pengujian — bukan karena rumit, tapi
karena tidak pernah dituliskan.

Dokumen ini rujukan operasional. Rancangannya ada di `ARSITEKTUR-portal-webinar.md`,
riwayat pembangunannya di `KICKOFF-portal-evaluasi.md`, arah pengembangan yang belum
dikerjakan di `ARAH-PENGEMBANGAN-berikutnya.md`.

---

## 1. Tiga kategori modul, tiga hasil berbeda

| Kategori | Menghasilkan | Masuk nilai akhir? | Tercetak di sertifikat? |
|---|---|---|---|
| **Referensi** | catatan "sudah dibuka" | tidak | tidak |
| **Atestasi** (CCL) | pernyataan tiga tingkat | **tidak pernah** | ya, sebagai **kalimat** |
| **Evaluasi** | angka nilai | ya | ya, sebagai **baris tabel** |

Hanya evaluasi yang menghasilkan angka. Atestasi tidak pernah dirata-rata ke nilai —
ia prasyarat, bukan nilai.

Tiga tingkat pernyataan atestasi:

| Keadaan | Pernyataan |
|---|---|
| keterlibatan belum memenuhi ambang | Belum menuntaskan |
| keterlibatan cukup, skor < target | **Telah menuntaskan** |
| keterlibatan cukup, skor ≥ target | **Telah menuntaskan dan memahami** |

Skor tinggi **tidak bisa** menutupi keterlibatan yang kurang. Tanpa target skor,
tingkat tertinggi yang mungkin adalah "telah menuntaskan".

---

## 2. Kelayakan ≠ pembukaan kunci

Dua hal berbeda yang dulu tercampur dalam satu kata "layak":

- **Kelayakan** — hasil dari mode syarat kegiatan. Soal **nilai**.
- **Prasyarat materi** — apakah materi wajib sudah dibuka/dituntaskan. Soal **proses**.

| Mode syarat | Peran prasyarat materi |
|---|---|
| **Nilai minimum** (otomatis) | **Menghalangi.** Nilai boleh 100, sertifikat tetap tidak bisa terbit sebelum semua materi wajib tuntas. |
| **Ditentukan admin** (manual) | **Menginformasikan.** Admin bebas menerbitkan — tapi keadaan materi tampil di tabel peserta sebagai dasar keputusan. |

Gerbangnya ada di **server**, bukan hanya di tampilan. Tombol yang disembunyikan
bukan pagar.

Laporan tidak pernah boleh mengklaim "semua materi tuntas" ketika gerbangnya sekadar
dimatikan. Tiga keadaan yang harus dibedakan: **tuntas**, **belum tuntas (menghalangi)**,
dan **belum tuntas (gerbang tidak aktif — tidak menghalangi)**.

---

## 3. Apa yang dibekukan, dan kapan

**Saat peserta mendaftar**, `modulSnapshot` membekukan: daftar modul, kategori,
wajib/opsional, nilai minimum per modul, dan untuk atestasi juga ambang keterlibatan,
target skor, serta durasi.

**Saat sertifikat diterbitkan**, dokumen sertifikat membekukan: nama peserta, judul
kegiatan, item beserta skor, kalimat atestasi, dan **seluruh blok penandatangan**
termasuk URL gambar tanda tangan.

Yang **tidak** dibekukan: isi modul referensi (video boleh diganti kalau tautannya mati),
logo, dan kop.

> ### Aturan pengujian yang lahir dari ini
> **Setiap kali setup kegiatan diubah, gunakan peserta baru.**
> Peserta lama membawa aturan lama, dan itu memang tujuannya — mengubah kegiatan tidak
> boleh mengubah hasil orang yang sudah terdaftar. Menguji setup baru dengan peserta
> lama akan selalu terlihat seperti "fiturnya tidak bekerja".

---

## 4. Tiga kontrol prasyarat yang mudah tertukar

| Kontrol | Letak | Artinya |
|---|---|---|
| **"Modul ini wajib"** | form **modul** | modul ini ikut dihitung; yang opsional tidak |
| **"Peserta harus membuka semua materi referensi yang wajib"** | form **kegiatan** | menyalakan gerbang referensi |
| **"Peserta harus menuntaskan semua materi atestasi yang wajib"** | form **kegiatan** | menyalakan gerbang atestasi |

Yang pertama tanpa yang kedua/ketiga **tidak berpengaruh apa-apa**. Sejak slice 7.4
ketiganya dikelompokkan di bawah judul "Prasyarat sebelum sertifikat bisa terbit",
dengan kalimat ringkasan hidup di atasnya, dan kontrol yang tidak relevan disembunyikan.

---

## 5. Peran dan kewenangan (tahap 8)

Empat peran, dari yang paling luas:

| Peran | Bisa apa |
|---|---|
| **superadmin** | segalanya, termasuk mengubah peran orang lain |
| **admin** | semua kegiatan, semua bank soal, parameter sistem, menunjuk panitia |
| **panitia** | hanya kegiatan yang **ditugaskan** kepadanya, sesuai saklar |
| **peserta** | mendaftar, mengerjakan, menerima sertifikat |

### Panitia ditunjuk per kegiatan

Admin menambahkan panitia di halaman kegiatan, dan memilih **dua saklar** untuk orang itu
**pada kegiatan itu saja**:

| Saklar | Mati | Hidup |
|---|---|---|
| **Terbitkan sertifikat** | panitia hanya memantau | panitia menerbitkan dan mencabut |
| **Sunting kegiatan & modul** | menjalankan sesuai yang admin siapkan | mengatur sendiri modul dan syaratnya |

Melihat daftar peserta dan nilainya **selalu** boleh — tanpa itu peran panitia tidak ada
gunanya. Panitia yang sama bisa punya saklar berbeda di kegiatan berbeda.

Panitia **tidak pernah** bisa menunjuk panitia lain atau mengubah izinnya sendiri, meski
saklar sunting menyala.

### "Boleh buat soal" itu kewenangan global, bukan per kegiatan

Diberikan admin di `/admin/pengguna`, bukan di halaman kegiatan. Alasannya: **bank soal
satu untuk seluruh platform** (KA-6). Soal buatan panitia masuk ke bank yang dipakai
semua kegiatan, jadi dampaknya global — dan izin berlingkup sempit dengan dampak luas
adalah kebohongan.

Dengan kewenangan itu, panitia boleh **membuat** soal dan **menyunting soal buatannya
sendiri**. Ia tidak pernah bisa menyentuh soal orang lain, dan tidak pernah bisa membaca
kunci jawaban soal orang lain. Soal yang dibuat sebelum tahap 8 dianggap milik admin.

Tanpa kewenangan itu, panitia tetap bisa **memakai** soal yang ada untuk modul
kegiatannya — ia hanya tidak bisa mengubah isinya.

### Yang panitia tidak pernah bisa

Menerbitkan atau mengarsipkan kegiatan, mengubah kode kegiatan, menyentuh penghitung
nomor serial, membuka halaman Parameter/Undangan/Pengguna/Topik, dan membaca
`kunci_soal` milik orang lain.

---

## 6. Cara memeriksa tanpa menebak

```
npx tsx scripts/periksa-kelayakan.ts <kegiatanId>
```

Menjawab satu pertanyaan yang dulu butuh tujuh klik: **"kenapa orang ini layak?"**
Ia membaca saja, tidak pernah menulis, dan menyebutkan: mode syarat, status ketiga
kontrol, isi snapshot tiap peserta beserta peringatan kalau ada field yang hilang,
hasil atestasi per modul, lalu kesimpulan BISA TERBIT / BELUM BISA TERBIT dan alasannya.

```
npm run uji
```

Menguji aturan sebagai fungsi murni — tanpa database, tanpa browser. Pakai ini untuk
"apakah aturannya benar"; pakai klik untuk "apakah alurnya utuh".

**Ekspor CSV** dari halaman peserta menyediakan dua pilihan pemisah — koma dan titik
koma. Kalau kolomnya menumpuk jadi satu saat dibuka di Excel, unduh dengan pilihan yang
satunya; pemisah yang cocok berbeda tergantung region Excel.

Di berkas itu, sel **kosong** berarti modul ada di pendaftaran peserta tapi belum
dikerjakan (dihitung nol), sedangkan **`-`** berarti modul belum ada saat ia mendaftar
(tidak dihitung sama sekali). Berkasnya memuat data pribadi — email, nomor identitas,
nomor telepon — jadi perlakukan sesuai.

---

## 7. Dua hal yang di-deploy, dua jalur berbeda

| Yang berubah | Cara memasangnya |
|---|---|
| Kode aplikasi | push ke `main` → Vercel otomatis |
| `firestore.rules` | `firebase deploy --only firestore:rules` — **manual** |

Push ke `main` **tidak pernah** memasang aturan. Dan karena aturan hidup di server
Google, **localhost pun memakai aturan produksi** — mengubah berkasnya di komputer tidak
berpengaruh apa pun sampai dipasang.

Gejala kalau lupa: "Missing or insufficient permissions" pada fitur yang kodenya sudah
benar. Jalankan deploy dari `C:\game\insighttest`, jangan dari folder CCL.

---

## 8. Terlihat seperti bug, padahal bukan

| Gejala | Sebenarnya |
|---|---|
| Fitur baru tidak muncul di Vercel | Belum di-push. **Data dibagi, kode tidak** — Firestore sama, build berbeda. |
| Fitur baru tidak jalan padahal sudah di-push | Aturan Firestore belum di-deploy (§7). |
| Peserta lama tidak terpengaruh setup baru | `modulSnapshot` beku (KA-5). Pakai peserta baru. |
| Sertifikat tetap ada padahal materi belum tuntas | Gerbang menghalangi **penerbitan**, tidak mencabut yang sudah terbit. Cabut dulu. |
| Sertifikat dicabut masih terlihat | Sertifikat tidak pernah dihapus, hanya dicabut — dan bisa diterbitkan ulang dengan serial yang sama. |
| Centang "wajib" pada modul tidak berpengaruh | Gerbang kegiatannya belum dinyalakan (§4). |
| Panitia tidak melihat menu Soal | Kewenangan "Boleh buat soal" diberikan di `/admin/pengguna`, bukan di halaman kegiatan (§5). Masuk ulang setelah diberikan. |
| Kolom CSV menumpuk jadi satu di Excel | Pemisahnya tidak cocok dengan region Excel. Unduh dengan pilihan satunya (§6). |
| Tautan gambar mati setelah beberapa menit | Tautan tempel GitHub kedaluwarsa 300 detik. Pakai `raw.githubusercontent.com` dari repo aset (KA-8). |
| Tautan YouTube "berubah" tiap disalin | Itu `?si=` — kode pelacak berbagi. ID videonya tetap. |
| Jawaban hilang saat refresh | Tidak lagi — tersimpan otomatis di perangkat itu. Tapi berpindah perangkat tetap mulai dari kosong. |

---

## 9. Batas yang perlu diketahui

- **Skor CCL bisa dipalsukan** oleh peserta yang paham konsol browser. Pertahanannya:
  verifikasi `event.origin`, dan pembatasan `detikTersaksikan` terhadap jam server —
  portal hanya mengakui **yang ia saksikan sendiri**. Untuk taruhan tinggi, tambahkan
  nickname CCL yang ditetapkan admin lalu cocokkan dengan papan peringkat CCL.
- **Layar hasil akhir CCL tidak bisa dibaca portal.** Iframe lintas-origin; hanya
  sepuluh field telemetri yang tersedia.
- **Papan peringkat CCL dan atestasi portal adalah dua catatan terpisah.** Yang satu
  rusak tidak menular ke yang lain.
- **Jawaban yang dikirim setelah waktu habis tetap dinilai.** Attempt ditandai
  `kadaluarsa`, tapi skornya tetap masuk. Kalau nanti ada ujian berbatas waktu yang
  serius, kebijakan ini harus diputuskan sadar — dan pengiriman otomatis di browser
  adalah kesopanan, bukan pengaman; yang menentukan tetap jam server.