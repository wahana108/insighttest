# Arah Pengembangan Berikutnya — di luar peta sembilan tahap

Ditulis 8 Sep 2026, diperbarui 9 Sep 2026. **Tidak ada satu pun di sini yang sedang
dikerjakan.** Dokumen ini sengaja dipisahkan agar rencana sembilan tahap tidak terganggu —
isinya catatan arah, bukan pekerjaan yang menunggu.

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

## 7. Manajemen bank soal: pencarian dan arsip

Muncul 9 Sep 2026 saat menguji poles admin. Kekhawatirannya nyata: soal hasil generate AI
datang berbondong-bondong, dan memilih 10 soal dari daftar 800 tanpa pencarian adalah
pekerjaan yang menyiksa.

### Aturan yang harus dipegang lebih dulu

> **Soal tidak pernah dihapus** — sama seperti sertifikat tidak pernah dihapus, hanya
> dicabut.

Alasannya struktural, bukan selera. `attempt` menyimpan jawaban per `soalId`, dan
`modulSnapshot` membekukan daftar soal saat peserta mendaftar (KA-5). Menghapus satu soal
membuat peninjauan hasil lama dan penelusuran nilai menunjuk ke ruang kosong — kerusakan
yang baru muncul berbulan-bulan kemudian, di halaman yang paling tidak boleh berbohong.

Jadi "arsip" bukan ruang tunggu sebelum penghapusan. **Arsip adalah tujuan akhirnya.**
Penghapusan permanen hanya boleh untuk soal yang belum pernah muncul di `attempt` mana
pun — dan itu harus dibuktikan lewat pemeriksaan, bukan diasumsikan.

### Empat langkah, berurut dari yang paling murah

**a. Pencarian teks di `/admin/soal` dan di pemilih soal.**
Firestore tidak punya pencarian substring — tidak ada `LIKE`, tidak ada `contains` untuk
teks bebas. Tiga pilihan:

| Cara | Batas wajar | Biaya |
|---|---|---|
| Saring di sisi klien atas soal yang sudah dimuat | ~2.000 soal | nol |
| Field `kataKunci: string[]` + `array-contains` | puluhan ribu | tulis saat pembuatan |
| Layanan pencarian luar (Algolia, Typesense) | tak terbatas | langganan |

Untuk skala yang terbayang, **saring di sisi klien adalah jawaban yang jujur**. Sederhana,
gratis, dan bisa diganti nanti tanpa mengubah bentuk data. Yang penting: tampilkan berapa
yang sedang dimuat, supaya tidak ada yang mengira sedang mencari di seluruh bank padahal
hanya di halaman pertama.

**b. Status ketiga: `arsip`.**
Sekarang soal punya aktif/nonaktif. Tambahkan `arsip`: tidak muncul di pemilih soal, tidak
muncul di daftar utama, tetap terbaca penuh untuk penelusuran riwayat. Halaman
`/admin/soal/arsip` menampilkannya terpisah.

**c. `batchImpor` — kelola per rombongan, bukan per butir.**
Ini yang paling berdampak dan paling sering terlewat. Soal hasil generate AI masuk
sekaligus; beri tiap impor satu id dan cap waktu, lalu jadikan ia penyaring sekaligus
satuan aksi. "Arsipkan seluruh impor 3 September" adalah satu klik; mengarsipkan 200 soal
satu per satu adalah pekerjaan yang tidak akan pernah benar-benar dilakukan siapa pun.

**d. Hapus permanen, dengan pagar.**
Hanya untuk soal berstatus arsip yang **belum pernah** muncul di `attempt` atau
`modulSnapshot`. Tombolnya tidak boleh ada sebelum pemeriksaan itu berjalan dan lulus;
kalau soal pernah dipakai, tampilkan alasannya — bukan tombol yang akan ditolak.

### Pencarian peserta

Kekhawatiran yang sama berlaku di rekap peserta. Jawabannya lebih ringan: saring di sisi
klien atas daftar yang memang sudah dimuat halaman itu — nama, email, institusi, status
kelayakan. Tidak ada bacaan Firestore tambahan sama sekali, dan ekspor CSV tetap jadi
jalan keluar untuk apa pun yang tidak tertangani penyaring.

---

## 8. Langkah pertama kalau arah ini ditempuh

Bukan pembayaran, bukan katalog: **batas harian per pengguna**. Ia melindungi kuota,
pasti dibutuhkan apa pun arah berikutnya, dan bisa dibangun tanpa menunggu keputusan
bisnis apa pun.

Setelah itu, satu kegiatan publik sungguhan — kuis wawasan kebangsaan buatan sendiri,
akses terbuka, tanpa pembayaran. Lihat berapa orang datang, berapa yang menyelesaikan,
berapa kuota terpakai.

> **Angka itu yang menentukan** apakah lapisan berbayar layak dibangun — bukan tebakan
> hari ini.

---

## 9. Formulir niat dukungan — pola yang dibangun sebagai contoh kerja

Disepakati 13 Sep 2026, dikerjakan sebagai **slice 6** setelah slice 5.

Alasan membangunnya berbeda dari alasan membangun fitur lain, dan itu disengaja: proyek ini
**contoh kerja**, bukan produk yang mengejar pengguna. Sebuah pola yang tidak pernah
berwujud akan menguap saat proyeknya ditinggalkan — dan pola ini belum ada di platform mana
pun yang sudah dibangun, termasuk mindmap.

> Prinsip "jangan bangun sebelum ada datanya" berlaku untuk **produk**. Untuk **contoh
> kerja**, membangun polanya *adalah* hasilnya.

### Bentuknya

Sebelum menuju Saweria, peserta mengisi formulir singkat: nama yang akan ia pakai di
Saweria, nominal, keterangan. Tersimpan sebagai satu dokumen per orang per kegiatan
(`{kegiatanId}_{uid}`) — **boleh disunting**, karena satu dokumen per orang sudah mencegah
spam dengan sendirinya dan orang yang salah ketik namanya tidak boleh terjebak.

Kode akses baru bekerja kalau catatan niat itu ada. Tautan Saweria tetap bisa diakses kapan
saja.

### Apa yang ia berikan, dan apa yang tidak

**Tidak** mencegah kode bocor dipakai — siapa pun bisa mengisi formulir dengan nama apa pun.
Yang ia berikan dua hal lain: **data untuk dicocokkan** dengan daftar penyumbang Saweria
(yang saat ini sama sekali tidak ada), dan **gesekan sosial** — orang yang iseng memakai kode
bocoran cenderung berhenti di depan formulir bernama.

### Dua rambu yang mengikat

**Ini pernyataan niat, bukan bukti pembayaran**, dan kalimat di layar harus mengatakannya.
Enam bulan lagi daftar itu akan terlihat seperti catatan transaksi padahal isinya ketikan
orang.

> **Jangan memakai ketidakcocokan nama untuk menghukum siapa pun.** Orang menyumbang anonim,
> memakai nama panggilan, memakai nama pasangannya, salah ketik. Ketidakcocokan bukan bukti
> kecurangan. Sertifikat yang dicabut karena nama tidak cocok — padahal orangnya memang
> menyumbang — merusak jauh lebih banyak daripada seratus kode bocor, karena yang rusak adalah
> kejujuran yang jadi seluruh nilai platform ini.
>
> Pakai daftar itu untuk memutuskan **kapan memutar kode**, bukan siapa yang bersalah.

### Operasional kode akses

Tiap edisi: buat kegiatan bulan berikutnya → isi kode barunya → perbarui pesan terima kasih
Saweria. Tiga langkah, sekali sebulan. Pesannya menyebut kodenya hanya berlaku untuk edisi
berjalan dan sebaiknya segera dipakai — kalimat itu jujur sekaligus memperpendek umur kode di
grup pesan orang.