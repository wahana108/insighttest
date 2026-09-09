# Arah Pengembangan Berikutnya — di luar peta sembilan tahap

Ditulis 8 Sep 2026. **Tidak ada satu pun di sini yang sedang dikerjakan.** Dokumen ini
sengaja dipisahkan agar rencana sembilan tahap tidak terganggu — isinya catatan arah,
bukan pekerjaan yang menunggu.

Prinsip yang disepakati: **platform menyediakan parameter sebagai antisipasi.** Fitur
tambahan dibangun sebagai kemampuan yang bisa dinyalakan atau dimatikan lewat pengaturan,
bukan sebagai perubahan mendasar. **Secara bawaan, platform tetap seperti sekarang** —
alat penilaian dan penerbitan sertifikat. Yang lain menyusul sebagai pilihan.

---

## 1. Sebagian besar visinya sudah ada

Ini temuan paling penting dari diskusi, dan mudah terlewat:

| Yang dibayangkan | Sudah ada sebagai |
|---|---|
| Tes populer yang bisa diakses umum | Kegiatan mode pendaftaran terbuka, tanpa jendela waktu |
| Halaman setelah login berisi daftar ujian | `/kegiatan` — tinggal dikurasi dan dikelompokkan |
| Dua jalur: daftar mandiri vs didaftarkan admin | Mode pendaftaran **terbuka** vs **undangan** — sejak tahap 1 |
| Satu kesempatan ujian | `maksPercobaan` per modul |
| Game sebagai lapisan soal | Kategori **atestasi** — selesai di tahap 7 |

Yang benar-benar baru hanya **tiga**: hak akses berjenjang, batas harian, dan
penghubungan ke pembayaran.

Arah ini bukan proyek baru — ia lapisan tipis di atas mesin yang sudah jadi.

---

## 2. Game CCL baru tidak butuh pekerjaan portal sama sekali

Ide yang muncul: temple run dengan simbol di dinding kanan-kiri-atas, flappy bird dengan
lambang berjalan di latar, game balap — semuanya "instal pengetahuan lewat dopamin".

Semua itu bisa dikembangkan **di CCL, terpisah**, tanpa menyentuh InsightTest. Selama
game mengirim `CCL_READY` lalu laporan berisi `score`, portal langsung bisa memakainya
sebagai modul atestasi: gerbang verifikasi mengenalinya sendiri, dan satuan ambang
keterlibatan dipilih otomatis (persen kalau melaporkan durasi, menit kalau tidak).

> Ini hasil keputusan "nol modifikasi CCL" di tahap 7 yang baru terasa sekarang:
> **satu protokol, game tak terbatas.**

---

## 3. Dua risiko yang harus diketahui sebelum membuat katalog tes publik

### Hak cipta dan etika alat tes

Banyak tes kepribadian dan psikologi terkenal adalah instrumen **berhak cipta** — MBTI,
NEO-PI, MMPI, dan sebagian besar bank tes komersial. Menyalin butirnya untuk platform
publik adalah masalah hukum, bukan sekadar etika.

Alternatif bebas ada: **IPIP** (International Personality Item Pool) untuk Big Five
adalah domain publik dan memang disediakan untuk dipakai ulang.

Yang lebih halus: hasil tes psikologi **dijadikan dasar keputusan orang tentang dirinya**.
Menamai kuis buatan sendiri sebagai "tes psikologi" membuat orang mempercayainya lebih
dari yang pantas. Sebut apa adanya — *kuis refleksi diri*, bukan *tes psikologi* — dan
sertakan keterangan bahwa ini bukan asesmen klinis.

Tes wawasan kebangsaan dan kuis pengetahuan umum yang ditulis sendiri (atau dibuat AI
lalu ditinjau) tidak punya masalah ini. Itu wilayah paling aman sekaligus paling sesuai
dengan kekuatan platform.

### Kuota Firestore

Paket gratis: 50.000 baca dan 20.000 tulis per hari untuk seluruh project. Produk publik
dengan ratusan pengguna harian akan menyentuhnya.

> **Batas harian per pengguna melayani dua tujuan sekaligus** — ia bukan hanya alat
> monetisasi, ia pelindung kuota. Karena itu ia layak dibangun lebih dulu daripada
> apa pun yang lain di dokumen ini.

---

## 4. Pembayaran: bertahap, dan jangan mulai dari yang rumit

Saweria **tidak menyediakan webhook resmi** untuk integrasi pihak ketiga (diperiksa
8 Sep 2026). Yang ada hanya fitur *custom overlay* untuk streamer dan beberapa pustaka
tidak resmi hasil rekayasa balik. Membangun pemberian akses otomatis di atasnya berarti
fitur itu bisa mati kapan saja tanpa pemberitahuan.

Urutan yang masuk akal:

1. **Manual.** Admin memberi hak akses setelah melihat donasi masuk. Lima detik per
   orang, tidak akan pernah rusak.
2. **Kode klaim.** Penyumbang menulis kode di pesan donasi, lalu menukarkannya di
   platform. Verifikasinya masih manual, tapi jauh lebih rapi.
3. **Payment gateway sungguhan** (Midtrans, Xendit) kalau volumenya membenarkan — mereka
   punya webhook resmi dengan ID pesanan, jadi penghubungan ke akun otomatis dan andal.

> Jangan mulai dari nomor 3. Membangun otomasi pembayaran sebelum ada yang membayar
> adalah cara paling umum sebuah proyek berhenti di tengah.

---

## 5. Satu basis kode, dua penempatan

Kalau katalog tes publik jadi dibangun, rekomendasinya **bukan** membuat basis kode baru,
dan **bukan** pula menumpuknya di penempatan yang sama. Melainkan: kode yang sama,
Firebase project berbeda, domain berbeda — persis seperti CCL sudah dipisah dari
InsightTest.

- **Kuota terpisah** — pengguna publik tidak menghabiskan kuota gelombang sertifikasi.
- **Reputasi terpisah** — halaman verifikasi `/s/{kode}` adalah janji tentang keaslian.
  Kalau platform yang sama menerbitkan sertifikat pelatihan resmi dan hasil kuis gratis,
  nilai janji itu turun.
- **Data uji bebas dihapus** tanpa menyentuh data sertifikasi.
- **Perbaikan tetap satu kali** — bug di penilaian server diperbaiki sekali, terpakai di
  dua tempat.

---

## 6. Sertifikat tingkat lanjut: stempel dan beberapa penandatangan

Nilai sebuah sertifikat terletak pada **siapa yang menandatanganinya**. Saat ini hanya
ada satu blok penandatangan (nama, jabatan, URL tanda tangan) yang dibekukan saat terbit.

Pengembangan yang masuk akal: beberapa penandatangan sekaligus (mis. ketua panitia dan
narasumber), plus gambar stempel. Semuanya tetap **URL, bukan unggahan** — konsisten
dengan KA-8, dan tetap **dibekukan seluruhnya saat penerbitan** — konsisten dengan KA-6,
karena nama yang beku dengan tanda tangan yang hidup adalah cacat yang sudah pernah
terjadi dan diperbaiki di tahap 4.

Ini perluasan kecil dan berdampak tinggi. Kalau ada satu hal di dokumen ini yang paling
layak dinaikkan ke peta utama, ini kandidatnya.

---

## 7. Langkah pertama kalau arah ini ditempuh

Bukan pembayaran, bukan katalog: **batas harian per pengguna**. Ia melindungi kuota,
pasti dibutuhkan apa pun arah berikutnya, dan bisa dibangun tanpa menunggu keputusan
bisnis apa pun.

Setelah itu, satu kegiatan publik sungguhan — kuis wawasan kebangsaan buatan sendiri,
akses terbuka, tanpa pembayaran. Lihat berapa orang datang, berapa yang menyelesaikan,
berapa kuota terpakai.

> **Angka itu yang menentukan** apakah lapisan berbayar layak dibangun — bukan tebakan
> hari ini.