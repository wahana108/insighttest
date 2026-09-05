# Platform Evaluasi — Keputusan Arsitektur

Status: **draft v3 untuk disetujui**. Belum ada kode yang ditulis.
Tanggal: 25 Agustus 2026.

**Dokumen ini spesifikasi kanonik.** `REUSABLE.md`, `INTEGRASI.md`, dan
`RANCANGANPLATFORMUJI.md` adalah **referensi konsep**; kalau bertentangan, file ini
yang berlaku.

---

## 1. Apa yang dibangun

Sebuah **mesin evaluasi**: alat yang mengubah input evaluasi yang ditentukan admin
menjadi output berupa nilai dan sertifikat.

```
Peserta (divalidasi admin)
  → mendaftar ke sebuah KEGIATAN
  → Kegiatan berisi 0..n REFERENSI, 0..n ATESTASI, 0..n EVALUASI
  → SYARAT kelulusan adalah parameter
  → keluar NILAI dan/atau SERTIFIKAT
```

Semua bagian opsional karena tiap bagian berjumlah nol atau lebih, dan syaratnya
parameter. Sertifikat keikutsertaan tanpa ujian = evaluasi berjumlah nol, syarat =
"formulir terisi". Evaluasi mandiri = referensi berjumlah nol. Webinar = referensi
eksternal. **Mesinnya satu.**

**Sifat project**: eksperimental, berjalan **berdampingan** dengan prosedur manual
yang tetap jalan — bukan penggantinya. Kegagalan tidak fatal. Standar ketahanan
disesuaikan dengan itu.

**Skala**: ratusan peserta per kegiatan. Dirancang untuk itu, tidak dioptimalkan
untuknya.

---

## 2. Tiga Kategori Isi Kegiatan

Ini penyederhanaan dari empat jenis modul di RANCANGANPLATFORMUJI.md §6.

| Kategori | Menghasilkan | Contoh |
|---|---|---|
| **Referensi** | Tidak ada | Video YouTube, tautan dokumen, webinar eksternal |
| **Atestasi** | **Pernyataan** | CCL video interaktif, CCL game |
| **Evaluasi** | **Angka** | Soal pilihan ganda dari bank soal |

"Seminar" bukan kategori tersendiri — ia **referensi eksternal + penanda kehadiran**.
CCL bukan kategori tersendiri — ia **atestasi**.

### Mengapa Atestasi adalah kategori terpisah

CCL tidak mengeluarkan hasil kalau video belum tuntas, dan video tidak akan sampai
akhir tanpa menjawab interaksi. Artinya CCL **memaksa peserta melewati referensi** —
dan itu nilainya, bukan skornya.

Maka keluaran CCL diperlakukan sebagai **pernyataan tentang keterpaparan**, bukan
sebagai nilai ujian:

| Kondisi | Pernyataan |
|---|---|
| `watch_credit_sec` di bawah ambang tonton | Belum menuntaskan referensi |
| Kredit tonton tercapai, `score` < target | **Telah menuntaskan** referensi |
| Kredit tonton tercapai, `score` ≥ target | **Telah menuntaskan dan memahami** referensi |

Data diambil dari aliran `STATE_REPORT` yang **sudah dikirim CCL hari ini** (§6,
diverifikasi langsung 25 Agu 2026): `watch_credit_sec`, `hp`, `score`,
`current_time_sec`, `duration_sec`, `chapter_index`, `running`.

`watch_credit_sec` adalah metrik yang tepat untuk "benar-benar menonton" — ia kredit
tonton, bukan sekadar posisi playhead, jadi melompati video tidak menambahnya.
`hp` = `watch_credit_sec / WATCH_CREDIT_CAP_SEC × 100`, siap pakai sebagai persentase.

**Catatan penting**: aliran ini membawa `score`, tapi **tidak** membawa
`totalCorrect`/`totalAnswered`. Jadi ambang "memahami" ditetapkan sebagai **target skor**
yang diisi admin per modul, bukan persentase akurasi. Admin mengisi target itu sekali
saat mendaftarkan URL game.

**Konsekuensi desain yang penting**: karena atestasi berupa pernyataan, skor dari
iframe yang bisa dipalsu tidak lagi jadi masalah besar. Yang dipalsu hanyalah klaim
"saya sudah menonton", bukan nilai ujian. Ini menyelesaikan kebuntuan yang di v1
saya jawab dengan penilaian server per-soal yang mahal.

Atestasi **tidak pernah dirata-rata ke nilai akhir**. Kalau admin ingin ia berpengaruh,
parameter `atestasiJadiSyarat` menjadikannya **prasyarat** ("harus tuntas dulu"), bukan
angka yang menambah nilai. Di sertifikat ia tercetak sebagai kalimat, bukan angka.

### Evaluasi adalah penilaian yang sebenarnya

Soal konvensional dari bank soal — hasil generate AI maupun suntingan admin — adalah
satu-satunya sumber angka nilai. Dinilai **di server**.

---

## 3. Firebase: Project Baru, Terpisah

Portal memakai **Firebase project sendiri**, terpisah dari CCL maupun TNA.

Ini membalik usulan v2 (satu project bersama CCL). Premisnya gugur: v2 berasumsi
portal butuh **Auth bersama** dengan CCL agar uid-nya sama. Ternyata tidak butuh —
lihat §6: dalam mode tersemat, CCL berjalan sebagai **tamu** dan identitas peserta
datang dari token yang diterbitkan portal, bukan dari login CCL. Tidak ada uid yang
perlu disamakan.

Begitu Auth bersama tidak diperlukan, project terpisah menang di semua sisi:

| | Project baru | Menumpang project CCL |
|---|---|---|
| Kuota gratis | **Jatah sendiri** | Berbagi dengan CCL |
| `firestore.rules` | **Milik sendiri** | Satu file bersama rules CCL yang belum eksplisit untuk `scores/**` |
| `users/{uid}` | **Bersih** | Bertabrakan dengan `lib/auth.js` CCL → race condition REUSABLE.md §4 |
| Named database | Tidak perlu | Perlu Blaze (satu project = satu database gratis) |

Kuota gratis Firestore dihitung per project: 1 GiB simpanan, 50.000 baca/hari,
20.000 tulis/hari. Project terpisah berarti jatah penuh, bukan sisa.

**Integrasi lintas project tidak diperlukan.** Penghubungnya bukan Firebase, melainkan
kontrak pesan di §6.

---

## 4. Gelombang Peserta — Tanpa Mekanisme Kedaluwarsa

Peserta berbeda tiap gelombang, tapi ini **tidak butuh timer, tidak butuh penghapusan,
dan tidak butuh menonaktifkan akun.**

Dua lapis izin, keduanya sudah ada polanya di TNA:

1. **Boleh masuk platform** — melekat pada akun, permanen sekali diberikan.
   Admin mengendalikan siapa yang boleh mendaftar (undangan / whitelist / pendaftaran
   terbuka). **Admin tidak pernah menyentuh kata sandi.** Pola `user-invitation.ts` +
   `pending/aktif/nonaktif` dari TNA dipakai apa adanya.
2. **Boleh mengerjakan sesuatu** — melekat pada **pendaftaran ke kegiatan**, bukan akun.

**Satu gelombang = satu kegiatan.** Gelombang Maret dan gelombang Juni adalah dua
dokumen kegiatan berbeda (dibuat lewat tombol "Duplikat kegiatan"). Peserta Maret tidak
melihat apa pun di Juni karena ia memang tidak terdaftar di sana — bukan karena aksesnya
dicabut.

Akibatnya "akses temporer" terjadi **dengan sendirinya**, tanpa satu baris kode
kedaluwarsa pun. Satu-satunya hal berbasis waktu adalah `dibukaPada`/`ditutupPada` pada
kegiatan, dan itu cuma parameter.

**Tidak ada penghapusan data.** Simpanan tidak dibebani: 1 GiB kira-kira jutaan dokumen
teks kecil. Menghapus justru menambah kerja sistem dan menghilangkan riwayat sertifikat
yang mungkin perlu diverifikasi bertahun kemudian. Admin **boleh** mengarsipkan kegiatan
(`isArchived`) — itu menyembunyikan, bukan menghapus. Penghapusan permanen disediakan
sebagai tindakan admin eksplisit, tidak pernah otomatis.

---

## 5. Batas Kuota yang Harus Dihindari Sejak Desain

Kuota tulis gratis 20.000/hari. Ini satu-satunya batas yang realistis tersentuh.

**Jangan menyimpan jawaban sebagai dokumen per soal.** 500 peserta × 40 soal = 20.000
tulis — habis dalam satu hari evaluasi. Simpan jawaban sebagai **array di dalam dokumen
attempt**, satu tulis saat submit. 500 peserta = 500 tulis. Batas dokumen Firestore
1 MiB; 40 jawaban tidak ada apa-apanya.

Ini membatalkan `attempts/{id}/answers/{n}` di v2.

Baca 50.000/hari aman: rekap admin 500 baris = 500 baca; dasbor peserta ~20 baca.

---

## 6. Integrasi CCL — Konsumsi Protokol yang Sudah Ada

**Diverifikasi langsung di browser, 25 Agustus 2026**, pada
`https://ccl-gaming-v2.vercel.app/games/ccl-vidio-player-12`. Bagian ini bukan rancangan
— ini hasil pengukuran.

### Temuan

| Yang diperiksa | Hasil |
|---|---|
| `X-Frame-Options` | **Tidak ada** |
| `Content-Security-Policy` | **Tidak ada** |
| Uji sematan **lintas-situs** | induk `example.com` → anak `ccl-gaming-v2.vercel.app`: **UI game tampil penuh dan interaktif**, 26 pesan dalam 8 detik, tanpa galat konsol |
| Firebase di dalam game | **Ada**, lewat rantai ESM (lihat di bawah) |
| Deteksi sematan | `const IS_EMBEDDED = window.self !== window.top` — **sudah ada di kode** |
| Skor tanpa login | **Tidak tersimpan**, game tetap jalan normal |

### Rantai modul dan gerbang login

```
ccl-vidio-player-12.html
  └─ <script type="module"> import { initGameUI } from '../lib/game-ui.js'
       └─ game-ui.js  → import { submitScore } from './scores.js'
            └─ scores.js → import { db } from './firebase-init.js'
                         → import { getCurrentUser } from './auth.js'
                              └─ Firebase SDK (gstatic CDN)
```

Gerbangnya eksplisit di `scores.js`:

```js
const user = getCurrentUser();
if (!user)     return { saved:false, reason: SUBMIT_REASONS.NOT_AUTH };
const nickname = getNickname();
if (!nickname) return { saved:false, reason: SUBMIT_REASONS.NO_NICKNAME };
// baru menulis ke scores/{gameId}/players/{uid}
```

Jadi skor CCL memang **opsional by design**: tanpa login game berjalan penuh, hanya
tidak menyimpan. `SUBMIT_REASONS` mengembalikan alasan terstruktur, bukan gagal diam.

**Telemetri `postMessage` berada di skrip inline biasa (~24 KB), bukan di rantai ESM
ini.** Itu sebabnya aliran `CCL_READY` + `STATE_REPORT` tetap mengalir meski peserta
tidak login — terbukti di uji sematan.

Game **sudah** mengirim telemetri ke induknya, tanpa perlu diubah:

```jsonc
// sekali, saat siap
{ source:'CCL_GAME', type:'CCL_READY', game_id:'ccl-vidio-player-12',
  game_name:'CCL Vidio Player 12', version:'1.0' }

// berkala (~1 detik) selama berjalan
{ source:'CCL_GAME', game_id:'ccl-vidio-player-12',
  hp: 0,                 // watch_credit_sec / WATCH_CREDIT_CAP_SEC * 100
  score: 0,
  wave: 1,               // chapter_index + 1
  current_time_sec: 0,
  duration_sec: 1546,
  chapter_index: 0,
  watch_credit_sec: 0,
  running: false }
```

Diukur: 7 pesan dalam 8 detik (1× `CCL_READY`, 6× laporan keadaan).

### Konsekuensi

**Adapter tidak diperlukan.** `ccl-bridge.html` dan protokol `uji_v1` dari
RANCANGANPLATFORMUJI.md §8 dirancang untuk menerjemahkan pesan yang formatnya tidak
diketahui. Formatnya sudah diketahui dan sudah memadai. Portal memasang **URL game
langsung** — satu lapis iframe, tanpa halaman perantara, tanpa bersarang — dan
mendengarkan `source === 'CCL_GAME'` di sisi induk.

**Modifikasi CCL: nol.** Bukan "hampir nol". Tidak ada file CCL yang disentuh, termasuk
`DATA_PATH` di 12 file dan `submitScore()`.

**Kebiasaan berbagi Anda tidak terganggu.** URL yang sama tetap bekerja standalone di
kolom komentar YouTube, karena `IS_EMBEDDED` mendeteksi sendiri konteksnya. Satu berkas,
dua mode — siapa pun yang menulis baris itu sudah merancang untuk ini.

### Aturan di sisi portal

1. **Verifikasi `event.origin`.** CCL mengirim dengan target `'*'`; pengetatan
   dilakukan di penerima, dan itu ada di kode kita — tidak perlu menyentuh CCL.
2. **Simpan laporan terakhir.** Tidak ada pesan "selesai" eksplisit (hanya dua titik
   `postMessage`: `sendReady` dan `sendStateReport`). Ketuntasan **disimpulkan** dari
   laporan terakhir: `current_time_sec` mendekati `duration_sec`, `chapter_index` di
   ujung, dan `watch_credit_sec` memenuhi ambang.
3. **Jangan tulis tiap laporan ke Firestore.** ~1 pesan/detik × 1500 detik = 1500 tulis
   per peserta kalau naif. Simpan di memori, tulis **satu kali** saat modul ditutup
   atau ketuntasan tercapai. Ini varian dari jebakan kuota §5.
4. **Uji tiap URL sebelum diaktifkan.** Saat admin mendaftarkan modul atestasi, portal
   memuat URL itu sekali secara tersembunyi, menunggu `CCL_READY` + laporan pertama,
   lalu mengisi otomatis `game_id` dan `duration_sec`. Kalau tidak ada pesan dalam
   ~10 detik, modul ditolak dengan pesan jelas.

### Yang belum diverifikasi

Baru **satu** dari dua belas game yang diuji. INTEGRASI.md §3 mencatat VP1–2 dan VP3–12
memakai jalur data berbeda. Uji beberapa URL lagi sebelum tahap 7; aturan §4 di atas
menangani game yang diam tanpa merusak apa pun.

**Sematan lintas-situs: sudah diuji, aman.** Perlu dibedakan dari pemakaian CCL selama
ini:

| Kasus | Origin | Penyimpanan browser | Status |
|---|---|---|---|
| Controller CCL menyematkan game | **sama** (`ccl-gaming-v2` → `ccl-gaming-v2`) | pihak pertama, utuh | sudah lama terbukti |
| Game dibuka standalone | — | pihak pertama, utuh | sudah lama terbukti |
| **Portal menyematkan game** | **beda situs** | **dipartisi** | **diuji 26 Agu 2026: berjalan** |

Kasus ketiga adalah satu-satunya yang baru, dan itulah yang diuji: induk `example.com`,
anak game CCL. Hasilnya UI tampil penuh (overlay "SEBELUM MENONTON" dengan pilihan
jawaban), telemetri mengalir, tidak ada galat konsol. Artinya rantai ESM →
`firebase-init.js` **tidak** melempar galat meski penyimpanannya dipartisi — Firebase
mundur ke persistensi in-memory, dan `submitScore` cukup mengembalikan `NOT_AUTH`.

Sisa ketidakpastian: Safari/iOS dan mode privasi ketat (Firefox ETP strict, Brave)
belum dicoba. Taruhannya rendah — kalaupun Firebase gagal di sana, jalur gagalnya sama
dengan tanpa login, yaitu game tetap jalan dan skor tidak tersimpan. Penawar bila perlu:
bungkus impor `game-ui.js` dengan `try/catch`, satu perubahan di satu berkas.

**Tidak dikerjakan**: penilaian server per-soal, `CCL_TOKEN` sebagai mekanisme ujian,
mengubah `DATA_PATH`. Semua itu hanya relevan kalau hasil CCL harus jadi nilai ujian
sungguhan — dan §2 membuatnya tidak diperlukan.

---

## 7. Model Data

Firebase project baru, database `(default)`.

Dibawa dari TNA apa adanya: `auth/session.ts`, `auth/user-profile.ts`,
`services/user-invitation.ts`, `services/system-parameter.ts`, `AdminShell`,
kerangka `hasRole()`/`isAdmin()`/`isSuperAdmin()`, pola service + hook + halaman.

| Collection | ID | Ditulis oleh | Catatan |
|---|---|---|---|
| `users/{uid}` | uid | Client — **satu fungsi saja** (§8 KA-2) | profil, peran, status akun |
| `undangan/{id}` | auto | Admin | whitelist / undangan, mode pendaftaran |
| `parameter/global` | tetap | Admin | dibaca sekali, dioper sebagai argumen |
| `topik/{id}` | auto | Admin | pengelompokan bank soal |
| `soal/{id}` | auto | Admin | opsi **tanpa** kunci |
| `kunci_soal/{soalId}` | = soalId | **Server saja** | `allow read, write: if false` |
| `kegiatan/{id}` | auto | Admin | satu gelombang = satu dokumen; jendela waktu, syarat, template sertifikat |
| `kegiatan/{id}/modul/{mid}` | auto | Admin | kategori referensi \| atestasi \| evaluasi |
| `pendaftaran/{kegiatanId}_{uid}` | deterministik | **Server saja** | snapshot modul, nomor urut, status |

> Pendaftaran diubah jadi **server saja** (29 Agu 2026, saat menyiapkan slice 3.3).
> Alasannya nomor urut: §10 mengalokasikannya saat pendaftaran agar tidak ada dokumen
> penghitung yang jadi titik panas saat penerbitan sertifikat. Kalau klien yang mendaftar,
> ia harus boleh menaikkan penghitung di dokumen `kegiatan` — padahal `kegiatan` hanya
> boleh ditulis admin. Route Handler menyelesaikannya sekaligus memusatkan pemeriksaan
> kelayakan (kegiatan terbit, jendela waktu terbuka, belum pernah mendaftar) dan
> pengambilan snapshot modul di satu tempat yang tidak bisa dilewati.
| `attempt/{id}` | auto | **Server saja** | `jawaban[]` sebagai array (§5), skor, pernyataan atestasi |
| `sertifikat/{kegiatanId}_{uid}` | deterministik | **Server saja** | serial, snapshot, item, kode verifikasi |
| `template_sertifikat/{id}` | auto | Admin | latar, koordinat, penandatangan |

**Nomor serial dialokasikan saat pendaftaran, bukan saat penerbitan** — pendaftaran
tersebar berhari-hari sehingga tidak ada satu dokumen counter yang jadi titik panas.
Serial = `{kodeKegiatan}/{tahun}/{urutan}`.

**Jangan dibuat**: `standar_kompetensi`, `tna_recaps`, `training_proposals`,
`unit_kerja`, `jabatan`, `pangkat`, `tusi`, likert atasan, leaderboard.

---

## 8. Aturan yang Tidak Boleh Dilanggar

**KA-1 — `.data.get('field', default)`, tidak pernah `.data.field`.**
Field yang tidak ada ≠ `null` di rules; `.field == null` menghasilkan evaluation error
dan menolak. Insiden nyata TNA: dokumen dibuat manual lewat Console tanpa field `usedAt`
→ pendaftaran tertutup gagal total + rollback akun (REUSABLE.md §4). Audit menyeluruh
sekali di awal.

**KA-2 — Satu fungsi tunggal *pembuat* `users/{uid}`.**
`createProfileForNewAccount()` adalah satu-satunya yang **membuat** dokumen profil.
Auth provider **hanya membaca** (`onSnapshot`), tidak pernah menulis. Race condition ini
lolos dari skrip Node karena skrip tidak me-mount provider — **uji registrasi lewat
browser sungguhan**.

Yang dilarang adalah **pembuatan** dari dua tempat, bukan semua tulisan. Update
administratif — mengubah status atau peran lewat `/admin/pengguna` — tetap sah: ia
berjalan dari aksi eksplisit admin terhadap dokumen yang **sudah ada**, tidak pernah
bersamaan dengan alur registrasi, dan rules membatasi field yang boleh disentuh tiap
peran. (Dipertajam setelah audit pra-tahap 2, 28 Agu 2026.)

**KA-3 — Kunci jawaban tidak pernah turun ke browser *peserta*.**
`kunci_soal/{soalId}`: read dan write **hanya** oleh admin dan superadmin. Ditolak untuk
peserta dan panitia, tanpa kecuali. Admin yang menyusun soal jelas harus bisa melihat
dan menyunting kuncinya — merekalah yang menulisnya. Yang dijaga adalah agar kunci tidak
pernah sampai ke browser orang yang sedang dinilai.

Ini menghapus kerumitan gerbang-baca-per-periode dari TNA sekaligus: peserta tidak pernah
membaca `soal` maupun `kunci_soal` secara langsung. Di tahap 3, soal sampai ke peserta
lewat Route Handler yang membuang field kunci sebelum mengirim.
(Dipertajam saat menyiapkan slice 2.2, 29 Agu 2026.)

**KA-4 — Syarat kelulusan adalah parameter sejak hari pertama.**
Jangan hardcode "nilai ≥ 70". Kalau syarat bisa berupa
`formulir_terisi | kehadiran_terverifikasi | nilai_minimum | atestasi_tuntas |
kombinasi | manual_admin`, maka sertifikat keikutsertaan tanpa ujian datang gratis.
Kalau di-hardcode, ia jadi pekerjaan besar belakangan.

**KA-5 — Pendaftaran menyimpan snapshot modul.**
Mengedit kegiatan setelah ada peserta tidak boleh mengubah hasil dan sertifikat yang
sudah ada.

**KA-6 — Bank soal tidak terikat kegiatan.**
Kegiatan menyimpan *rujukan* — daftar ID eksplisit, atau "N soal acak dari topik X" —
bukan salinan soal. Ini yang membuat bank soal terpakai ulang lintas gelombang.

**KA-7 — Klien tidak pernah menulis `skor`, `lulus`, atau apa pun di `sertifikat`.**

**KA-8 — Setiap URL gambar yang dibekukan harus publik dan permanen.**
Ditambahkan 1 Sep 2026 setelah insiden nyata: tanda tangan diambil dari tautan gambar
hasil tempel di percakapan GitHub (`private-user-images.githubusercontent.com`), yang
ternyata **bertanda tangan dan kedaluwarsa dalam 300 detik** serta terikat sesi login
pengunggahnya. Karena KA-6 membekukan blok penandatangan ke dalam dokumen sertifikat,
tautan semacam itu membuat sertifikat rusak permanen — dan rusaknya di halaman verifikasi
publik `/s/{kode}`, tempat orang luar memeriksa keaslian.
`periksaUrlGambar()` menolak tautan bertanda tangan di dua tempat: form template admin
dan `terbitkanSertifikatUntuk()` di server. Heuristik yang mudah diingat: **URL gambar
permanen berakhir di `.png`/`.jpg`; kalau ada tanda tanya, curigai.**
Tempat penyimpanan yang dipakai: repo GitHub publik khusus aset → `raw.githubusercontent.com`.

---

## 9. Urutan Pembangunan

Prinsip: bangun **tulang punggung** dulu (peserta → kegiatan → evaluasi → nilai →
sertifikat), pasang anggota badan opsional belakangan. Tiap tahap meninggalkan aplikasi
yang bisa dijalankan.

| # | Tahap | Selesai berarti |
|---|---|---|
| 1 | Repo, Firebase baru, rules aman, auth + undangan (port TNA), AdminShell, parameter | Admin mengundang, peserta masuk |
| 2 | Topik + CRUD soal + kunci terpisah + **impor JSON berbantuan AI** | Bank soal terisi cepat, terkelompok |
| 3 | Kegiatan + modul evaluasi + pendaftaran + runner soal + **penilaian server** | Peserta dapat nilai |
| 4 | Sertifikat + `/s/{kode}` + penerbitan massal berpratinjau | **Masalah asli selesai** |
| 5 | Modul referensi (YouTube, tautan) + syarat "harus dibuka" | Alur belajar utuh |
| 6 | Formulir peserta + impor daftar hadir + sertifikat keikutsertaan | **Jalur webinar utuh** |
| 7 | `demo-activity.html` + adapter CCL + pernyataan atestasi | **Eksperimen intinya** |
| 8 | Rekap, ekspor XLSX/CSV, peran panitia | Admin berhenti manual |
| 9 | Poles HP 390px, empty state, landing | Layak dipakai orang lain |

**Impor AI ditaruh di tahap 2**, bukan akhir. Alasannya dua: kodenya sudah ada dan
teruji (REUSABLE.md §5 — tinggal ganti `kompetensiKode` jadi `topikKode`), dan bank soal
yang kosong membuat semua tahap berikutnya tidak bisa dicoba dengan sungguhan.

**CCL di tahap 7**, setelah tulang punggung terbukti. Bukan karena tidak penting — ia
justru inti eksperimennya — tapi karena ia bagian dengan kejutan terbanyak dan tidak
boleh menyandera bagian yang menyelesaikan masalah nyata.

### Tes penerimaan wajib

Diadopsi dari RANCANGANPLATFORMUJI.md §16, karena bisa dinyatakan gagal atau lulus:

> Kegiatan seed punya Modul A dan B dicentang, Modul C tidak. Sertifikat memuat A dan B,
> **tanpa C**, dan tanpa tulisan "tidak diuji". Kalau C tercetak, tahap itu gagal.

### Enam hal yang akan menghambat kalau salah di awal

1. Syarat kelulusan di-hardcode → sertifikat keikutsertaan jadi mahal (KA-4)
2. Soal disalin ke dalam kegiatan → bank soal tidak terpakai ulang (KA-6)
3. Jawaban ditulis per-dokumen → kuota tulis gratis habis (§5)
4. Kegiatan diedit tanpa snapshot → sertifikat lama berubah (KA-5)
5. Menumpang project/collection CCL → tabrakan `users/{uid}` (§3)
6. CCL dikerjakan sebelum tulang punggung → project berhenti di tengah

---

## 10. Sertifikat

Yang otoritatif adalah **catatan**, bukan berkas PDF-nya — PDF apa pun bisa disunting.
Yang membuatnya bisa dipercaya adalah halaman verifikasi `/s/{kode}`.

Maka: **print CSS untuk tahap awal** (layar boleh gelap, cetak wajib terang). Naik ke
render server (`pdf-lib`) hanya kalau butuh konsistensi visual ketat atau kirim massal.
Perubahan itu tidak menyentuh model data.

**Penerbitan massal berpratinjau**: sistem menghitung siapa memenuhi syarat → admin
melihat daftar → mencoret yang perlu → terbitkan sekali klik. Ini memberi admin wewenang
penuh tanpa memaksanya memeriksa ratusan orang satu per satu.

Isi lembar: nama, judul kegiatan, tanggal, serial, **tabel modul yang dinilai saja**,
nilai akhir, pernyataan atestasi bila ada, QR ke halaman verifikasi.
Footer: *"Daftar di atas hanya memuat materi yang ditetapkan pada kegiatan ini.
Bukan dokumen negara."*

---

## 11. Formulir & Sertifikat — Standar Minimum

Prinsipnya: **pakai standar umum**, jangan berinovasi di sini. Semua bisa diperluas
belakangan tanpa mengubah model data, asalkan minimumnya benar sejak awal.

### Formulir peserta (diisi sendiri, sekali, bisa disunting sampai sertifikat terbit)

| Field | Wajib | Catatan |
|---|---|---|
| **Nama lengkap** | **Ya** | **Field paling penting di seluruh sistem** — lihat peringatan di bawah |
| Email | otomatis | dari akun, tidak diketik ulang |
| Institusi / asal | Ya | untuk rekap admin |
| Nomor identitas | Tidak | NIP/NIK/NIM, diaktifkan per kegiatan lewat parameter |
| No. telepon | Tidak | opsional per kegiatan |

> **Peringatan.** `displayName` dari Google Sign-In sering informal ("agus", "Rama W").
> Kalau sertifikat memakai itu, Anda akan menerbitkan ulang ratusan lembar. Peserta
> **wajib** mengisi nama lengkap dengan label eksplisit *"nama yang akan tercetak di
> sertifikat"*, dan sistem menampilkan pratinjau nama itu sebelum sertifikat diterbitkan.
> Setelah terbit, nama di-snapshot dan terkunci (KA-6).

### Sertifikat — dua tingkat, satu model data

**Minimum** (cukup untuk tahap 4): nama, judul kegiatan, tanggal, nomor serial,
nilai akhir atau pernyataan atestasi, kode verifikasi + tautan `/s/{kode}`.

**Lanjutan** (tambahan, semuanya opsional per template): URL logo, URL kop/header,
penandatangan (nama + jabatan + URL gambar tanda tangan), tabel modul beserta nilai,
QR code ke halaman verifikasi, teks kustom.

Logo dan kop **ditautkan lewat URL**, tidak diunggah — tidak perlu Cloud Storage di
tahap awal. Semua field lanjutan boleh kosong; template minimum adalah default.

### Kebijakan percobaan (default, semuanya parameter)

Percobaan per modul: 1 (admin boleh 1–3). Skor yang dipakai: **tertinggi**.
Urutan soal: diacak. Urutan opsi: tidak diacak. Timer: mati.

### Ambang atestasi (default)

Kredit tonton ≥ 90% dari `WATCH_CREDIT_CAP_SEC` → "telah menuntaskan".
`score` ≥ target yang diisi admin per modul → "telah menuntaskan dan memahami".
Target diisi saat mendaftarkan URL game; kalau dikosongkan, hanya pernyataan
"menuntaskan" yang tersedia.

---

## 12. Masih Terbuka

1. Nama produk & domain (dibutuhkan untuk nama repo dan nama Firebase project)
2. Tanggal gelombang nyata pertama yang jadi target pemakaian

### Pengukuran lanjutan — 6 game, dari origin portal (3 Sep 2026)

Utang §6 ("baru 1 dari 12 diuji") dibayar. Kali ini induknya adalah
**`insighttest-gamma.vercel.app` sungguhan**, bukan `example.com` — konfigurasi
produksi yang sebenarnya. Semua game disematkan serentak dalam satu halaman.

`games/registry.json` di controller mendaftar **20 entri**; 16 `live`, 4 `dummy`
(`cnc-zero-hour`, `black`, `black-hawk-down`, `counter-strike` — `file: null`).
Registry ini juga **sumber daftar game yang bisa dipakai portal**.

| Game | Pesan/15 dtk | `CCL_READY` | Laporan keadaan | `duration_sec` |
|---|---|---|---|---|
| `ccl-video-player` (VP1) | 12 | ✅ v1.0 | ✅ 10 field | 2141 |
| `ccl-video-player-2` (VP2) | 12 | ✅ v1.0 | ✅ 10 field | 1249 |
| `ccl-vidio-player-3` (VP3) | 14 | ✅ v1.0 | ✅ 10 field | 1806 |
| `ccl-vidio-player-12` | 14 | ✅ v1.0 | ✅ 10 field | 1546 |
| `space-commander` | 1 | ✅ v2.0 | **tidak ada** | — |
| `ccl-runner` | 1 | ✅ v2.1 | **tidak ada** | — |

**VP1–2 dan VP3–12 mengirim protokol yang identik.** Kekhawatiran INTEGRASI.md §3
soal jalur data berbeda tidak berdampak pada telemetri: keempatnya mengirim sepuluh
field yang sama persis — `chapter_index, current_time_sec, duration_sec, game_id, hp,
running, score, source, watch_credit_sec, wave`. Portal tidak perlu cabang per game.

**Temuan baru yang mengubah rancangan:** game non-video (`space-commander`,
`ccl-runner`) mengirim `CCL_READY` **tetapi tidak pernah mengirim laporan keadaan**
selama diam. Keduanya menunggu interaksi commander sebelum mulai. Artinya:

> Gerbang pendaftaran modul atestasi (§6 aturan 4) **tidak boleh** menunggu laporan
> keadaan pertama. Ia harus menerima `CCL_READY` sebagai bukti hidup, lalu memperlakukan
> `duration_sec` sebagai **opsional**. Kalau `duration_sec` tidak pernah datang, modul
> tetap boleh didaftarkan — tetapi ambang kredit tonton tidak bisa dipakai untuk game
> itu, dan admin harus diberi tahu bahwa hanya ambang `score` yang tersedia.

Kalau gerbangnya menuntut laporan keadaan, empat belas game video lolos dan dua game
aksi ditolak tanpa alasan yang bisa dipahami admin.

`duration_sec` berbeda-beda per game (1249–2141 detik), jadi ia memang harus diambil
dari telemetri, bukan diisi tangan.

### CCL Video Player vs CCL Game — dua bentuk atestasi (4 Sep 2026)

Dijelaskan langsung oleh perancang CCL. Perbedaannya bukan kosmetik; ia mengubah
aturan penilaian.

| | CCL Video Player | CCL Game |
|---|---|---|
| Batas | berhingga, ada `duration_sec` | **tak berhingga**, sampai game over |
| Ukuran keterlibatan | kredit tonton / kapasitas → persen | lama bertahan → menit |
| Sifat `score` | akumulatif, hanya naik | akumulatif, **hanya naik** |
| Ketuntasan | sampai akhir video | tidak ada; hanya bertahan sampai kalah |
| Yang dibuktikan | menyimak & memahami sampai tuntas | menjawab cepat dan tepat di bawah tekanan |

**Skor dan poin adalah dua hal berbeda, dan ini pernah saya salah pahami.** *Poin*
adalah mata uang di dalam permainan: dihasilkan dengan menjawab soal, dibelanjakan untuk
mengeluarkan perintah. *Skor* adalah pencapaian — ia bertambah saat misi berhasil dan
**tidak pernah turun**. Telemetri membawa `score`, bukan poin. Jadi aturan §11 "skor yang
dipakai: tertinggi" tetap benar untuk keduanya.

**Video player memaksa pemahaman, bukan sekadar keterpaparan.** Video tidak bisa
dipercepat, dan peserta harus menjawab benar minimal dua soal tiap penggal sesi; kalau
gagal, video mundur ke sesi sebelumnya. Artinya kredit tonton yang mencapai ambang
**sudah** membuktikan pemahaman. Ini memperkuat §2, yang semula menyebut atestasi
sebagai pernyataan keterpaparan saja.

Konsekuensi lain: peserta yang dilempar mundur akan melanjutkan di lain waktu, sehingga
**mengumpulkan kredit lintas sesi adalah perilaku normal** — bukan tanda kecurangan.
Itu sebabnya pemeriksaan kewajaran harus berbasis **pertambahan**, bukan angka mutlak.

**CCL Game adalah lapisan perintah di atas game apa pun.** Poin dari menjawab soal
menjadi hak memerintah bot (serang, bertahan, pulih, hindar); soal lebih sulit memberi
poin lebih besar; kesulitan meningkat sehingga peserta harus terus menjawab benar untuk
bertahan. Perintah berupa pilihan, bukan kendali gerak — karena itu latensi tidak
relevan, dan visinya bisa diperluas ke game berat lewat streaming dengan agen AI yang
mengeksekusi perintah secara otonom.

### Generalisasi: satu rancangan, dua satuan

Keduanya punya **dua variabel yang sama** — lama keterlibatan dan skor yang dihasilkan.
Yang berbeda hanya satuan variabel pertama. Karena itu tidak perlu rancangan terpisah
per jenis game, dan **tidak perlu pengkodean setiap kali game CCL baru didaftarkan**:

| `duration_sec` dari gerbang | Satuan ambang keterlibatan |
|---|---|
| ada | **persen** — mis. 90% dari kredit tonton |
| tidak ada | **menit** — mis. minimal 10 menit bertahan |

Gerbang verifikasi slice 7.1 sudah mendeteksi ada-tidaknya `duration_sec`, jadi satuannya
dipilih otomatis; admin hanya mengisi angkanya. Field: `ambangKeterlibatan { mode:
'persen' | 'menit', nilai }`.

Satu konsep menyatukan keduanya: **`detikTersaksikan`** — detik yang portal saksikan
sebagai keterlibatan nyata.

- **Video**: bertambah hanya saat `watch_credit_sec` bertambah. Dijeda → tidak dihitung.
- **Game**: bertambah hanya saat ada perubahan pada `score`/`wave`/`hp`. Tab dibiarkan
  terbuka tanpa dimainkan → tidak dihitung.

Dihitung klien dari aliran telemetri, lalu **dibatasi jam server**: tidak boleh bertambah
lebih cepat dari waktu nyata yang berlalu (toleransi 10%); kelebihannya dipangkas dan
ditandai, **tidak pernah ditolak** — menolak berarti membuang data yang mungkin sah, dan
kegagalannya senyap.

Pernyataan akhir tetap tiga tingkat yang sama untuk kedua jenis: keterlibatan belum
memenuhi ambang → *belum menuntaskan*; cukup tapi skor < target → *telah menuntaskan*;
cukup dan skor ≥ target → *telah menuntaskan dan memahami*.

Visi yang mendasarinya: CCL adalah **lapisan soal interaktif di atas kegiatan yang sudah
disukai orang** — menonton, scrolling, bermain — supaya kegiatan itu meninggalkan ilmu.
Arah berikutnya: video pendek YouTube/TikTok, dan game strategi berat lewat streaming.
Rancangan atestasi portal harus tetap berlaku tanpa perubahan untuk semua itu.

Belum terukur: apakah CCL Game mengirim laporan keadaan saat benar-benar dimainkan (saat
diam ia hanya mengirim `CCL_READY`). Terjawab dengan sekali memainkannya di dalam portal
setelah slice 7.2a.