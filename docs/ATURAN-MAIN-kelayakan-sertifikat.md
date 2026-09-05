# Aturan Main — Kelayakan & Penerbitan Sertifikat

Ditulis 4 Sep 2026 setelah tahap 7, karena aturan-aturan ini berulang kali menyebabkan
kebingungan saat pengujian — bukan karena rumit, tapi karena tidak pernah dituliskan.

Dokumen ini rujukan operasional. Rancangannya ada di `ARSITEKTUR-portal-webinar.md`,
riwayat pembangunannya di `KICKOFF-portal-evaluasi.md`.

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

## 5. Cara memeriksa tanpa menebak

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

---

## 6. Terlihat seperti bug, padahal bukan

| Gejala | Sebenarnya |
|---|---|
| Fitur baru tidak muncul di Vercel | Belum di-push. **Data dibagi, kode tidak** — Firestore sama, build berbeda. |
| Peserta lama tidak terpengaruh setup baru | `modulSnapshot` beku (KA-5). Pakai peserta baru. |
| Sertifikat tetap ada padahal materi belum tuntas | Gerbang menghalangi **penerbitan**, tidak mencabut yang sudah terbit. Cabut dulu. |
| Sertifikat dicabut masih terlihat | Sertifikat tidak pernah dihapus, hanya dicabut — dan bisa diterbitkan ulang dengan serial yang sama. |
| Centang "wajib" pada modul tidak berpengaruh | Gerbang kegiatannya belum dinyalakan (§4). |
| Tautan gambar mati setelah beberapa menit | Tautan tempel GitHub kedaluwarsa 300 detik. Pakai `raw.githubusercontent.com` dari repo aset (KA-8). |
| Tautan YouTube "berubah" tiap disalin | Itu `?si=` — kode pelacak berbagi. ID videonya tetap. |

---

## 7. Batas yang perlu diketahui

- **Skor CCL bisa dipalsukan** oleh peserta yang paham konsol browser. Pertahanannya:
  verifikasi `event.origin`, dan pembatasan `detikTersaksikan` terhadap jam server —
  portal hanya mengakui **yang ia saksikan sendiri**. Untuk taruhan tinggi, tambahkan
  nickname CCL yang ditetapkan admin lalu cocokkan dengan papan peringkat CCL.
- **Layar hasil akhir CCL tidak bisa dibaca portal.** Iframe lintas-origin; hanya
  sepuluh field telemetri yang tersedia.
- **Papan peringkat CCL dan atestasi portal adalah dua catatan terpisah.** Yang satu
  rusak tidak menular ke yang lain.