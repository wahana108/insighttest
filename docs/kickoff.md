# Kickoff — Langkah Memulai Pembangunan

Pendamping `ARSITEKTUR.md`. Dokumen itu menjawab **apa** dan **mengapa**; dokumen ini
menjawab **mulai dari mana**.

Pembagian kerja: bagian **A** dan **B** Anda kerjakan sendiri (Claude CLI tidak bisa
mengklik konsol dan tidak boleh memegang kredensial). Bagian **D** dijalankan Claude CLI.

---

## A. Sebelum apa pun — amankan CCL (± 45 menit)

Didahulukan karena portal akan mulai bergantung pada URL CCL, sementara versi live
saat ini hanya punya **satu salinan** (PC + Vercel).

### Keadaan sebenarnya (diperiksa 26 Agu 2026)

| Tempat | Isi | Sama dengan yang live? |
|---|---|---|
| `CCL-Cognitive-Command-Layer` | manifesto, whitepaper, `CCL_Runner_Game.html`. Publik, 7 commit | tidak, dan memang bukan tujuannya |
| `ccl-universal-controller` | `index.html`, `ccl-controller-FINAL.html`, README, spec. 2 commit | **tidak** — tanpa `games/`, `lib/`, `registry.json` |
| `space-commander-v2` | `index.html`, `questions.json`, `space-commander-FINAL.html`, `vercel.json`. Publik, **1 commit** | **tidak** — proyek satu game terpisah |
| `C:\game\CCL-Auith-login` (PC) | controller + `games/` + `lib/` + `docs/` + `firestore.rules` + `CLAUDE.md`. **Sudah punya `.git`** | **ini yang live** |

### Hasil diagnosa (26 Agu 2026)

```
On branch master
No commits yet
Untracked files: .gitignore  firestore.rules  games/  index.html  lib/  vercel.json
(git remote -v tidak menampilkan apa pun)
```

Kesimpulannya: `.git` pernah di-`init` tapi **belum pernah ada satu commit pun**, dan
**belum ada remote**. Jadi seluruh kode live saat ini tidak terlindungi git sama sekali —
tapi juga tidak ada riwayat yang bisa bentrok. Ini kasus paling bersih yang mungkin:
tidak ada merge, tidak ada konflik, tidak ada yang bisa tertimpa.

### Langkah 1 — Periksa apa yang sedang diabaikan

`git status` hanya menyebut enam entri, padahal folder berisi `docs/`, `CLAUDE.md`, dan
beberapa berkas `.md` serta `.html` uji. Itu berarti `.gitignore` (3 KB) sedang
mengabaikannya.

```bash
git status --ignored --short
git check-ignore -v docs CLAUDE.md
```

`.claude/` dan `.vercel/` memang layak diabaikan. Tapi `docs/` (tersentuh 25 Agustus)
dan `CLAUDE.md` (21 KB instruksi project) sebaiknya **ikut tersimpan** — kalau tidak,
git bukan cadangan yang utuh. Kalau keduanya memang diabaikan, hapus barisnya dari
`.gitignore` sebelum commit.

### Langkah 2 — Commit

```bash
git add -A
git commit -m "Snapshot versi live: controller, 12 game, lib, rules"
git branch -M main          # samakan dengan repo Anda yang lain
git log --oneline           # pastikan commit-nya ada
```

Setelah baris ini, kode Anda tersimpan permanen di riwayat git lokal.

### Langkah 3 — Repo GitHub baru

Di GitHub → **New repository**, nama **`ccl-gaming-v2`** (sama dengan domain Vercel-nya,
jadi tidak membingungkan nanti).

> **Penting**: jangan centang *Add a README*, *Add .gitignore*, maupun *Choose a license*.
> Ketiganya membuat commit di sisi GitHub, dan push pertama Anda akan ditolak.
> Repo harus benar-benar kosong.

Mulai **private**. Nanti diubah publik setelah rules diperiksa — lihat catatan di bawah.

```bash
git remote add origin https://github.com/wahana108/ccl-gaming-v2.git
git push -u origin main
```

### Langkah 4 — Sebelum diubah jadi publik

CCL memang open source, jadi repo ini pantas publik. Tapi sebelum tombol itu ditekan,
periksa `firestore.rules` untuk `scores/**` — INTEGRASI.md §7 mencatat bagian itu belum
eksplisit. Config Firebase yang ikut publik bukan masalah (memang dikirim ke browser),
tapi rules yang longgar plus repo publik membuatnya mudah ditemukan.

### Kabar baik: push tidak akan mengubah situs live

Folder Anda punya `.vercel/`, artinya deployment dilakukan lewat Vercel CLI
(`vercel --prod`), bukan integrasi Git. Jadi `git push` **tidak memicu deploy** dan tidak
menyentuh `ccl-gaming-v2.vercel.app` sama sekali. Anda bebas merapikan git tanpa risiko
terhadap URL yang sudah Anda sebar.

### Tiga hal yang perlu diperhatikan

**Jangan sambungkan Vercel ke Git dulu.** Selama deployment lewat Vercel CLI, git dan
situs live terpisah — dan itu justru menguntungkan sekarang. Kalau nanti repo
disambungkan ke project Vercel yang ada, push berikutnya akan men-deploy isi repo, dan
selisih sekecil apa pun akan mengubah situs live. Padahal URL-nya sudah Anda sebar di
kolom komentar YouTube dan akan dipakai portal. Kalau ingin menyambungkan, buat
**project Vercel baru** dari repo itu lebih dulu, bandingkan hasilnya, baru pindahkan
produksinya.

**Config Firebase di `firebase-init.js` boleh publik, rules-nya yang tidak boleh longgar.**
API key Firebase web memang dirancang untuk dikirim ke browser — mempublikasikannya bukan
kebocoran. Yang berisiko adalah catatan INTEGRASI.md §7: rules untuk `scores/**` belum
eksplisit. Karena repo ini publik dan CCL memang open source, sempatkan mengetatkan rules
itu — sekarang lebih mudah daripada nanti.

**Path game jadi kontrak.** Begitu portal menautkan modul ke
`/games/ccl-vidio-player-12`, path itu tidak boleh berubah lagi. Kalau ingin merapikan
struktur folder, lakukan **sekarang**, sebelum tahap 7.

### JANGAN deploy `firestore.rules` dari repo ini sebelum disamakan

Diperiksa 26 Agu 2026 di `wahana108/ccl-gaming-v2`: berkas `firestore.rules` di repo
berkomentar "(Step 2)" dan hanya berisi dua blok — `users/{uid}` dan `nicknames/{nickname}`.
**Tidak ada blok `scores/**` sama sekali.**

Di Firestore, path yang tidak cocok dengan blok mana pun **otomatis ditolak**. Kalau
berkas ini benar-benar yang berlaku, `submitScore()` pasti gagal — padahal skor Anda
tersimpan saat login. Artinya **rules yang aktif di Firebase berbeda dari berkas di repo**;
kemungkinan besar rules pernah disunting langsung lewat Console dan tidak pernah
disalin balik.

Bahayanya konkret: siapa pun (termasuk agen CLI) yang menjalankan
`firebase deploy --only firestore:rules` dari folder ini akan **menimpa rules yang
berlaku** dan mematikan penyimpanan skor CCL.

Tindakan: buka **Firebase Console → Firestore → Rules**, salin isi yang **aktif**,
timpakan ke `firestore.rules` di repo, commit. Setelah itu repo jadi sumber kebenaran
dan aman di-deploy.

**Pola yang jangan ditiru di portal**: blok `users/{uid}` di CCL memberi pengguna hak
tulis penuh atas dokumennya sendiri. Untuk CCL tidak apa-apa (tidak ada peran di sana),
tapi di portal itu berarti peserta bisa menulis sendiri field `role`-nya jadi admin.
Di portal, field peran dan status **wajib** dikunci dari tulisan pengguna.

---

## B. Menyiapkan Firebase & Vercel

### B1. Firebase project baru

Di `console.firebase.google.com` → **Add project**.

| Pilihan | Isi | Catatan |
|---|---|---|
| Project name | **InsightTest** | nama tampilan, bisa diubah kapan saja |
| **Project ID** | **`insighttest`** | **PERMANEN.** Huruf kecil dan tanda hubung saja. Kalau sudah dipakai orang lain, Firebase menambahkan akhiran acak — terima saja, atau pakai `insighttest-app` |
| Google Analytics | matikan | tidak dipakai, menyederhanakan setup |

Lalu:

1. **Build → Authentication → Get started** → aktifkan **Email/Password** dan **Google**
2. **Build → Firestore Database → Create database** → **Production mode**
   → **Region: `asia-southeast2` (Jakarta)** atau `asia-southeast1` (Singapura).
   **Region juga permanen.** Jakarta lebih dekat ke peserta Anda.
3. **Project settings → Your apps → Web (`</>`)** → daftarkan → **salin objek config**
4. **Project settings → Service accounts → Generate new private key** → simpan file JSON
   ini **di luar repo**. Ini kunci server; jangan pernah di-commit, jangan pernah
   ditempel ke chat.

### B2. Urutan yang benar — Firebase dulu, baru kode

Pertanyaan "Firebase dulu atau kode dulu?" jawabannya **Firebase dulu**, karena:

- prosesnya murni klik, ± 15 menit, dan Claude CLI tidak bisa melakukannya
- dua pilihannya permanen (Project ID dan region) — lebih baik diputuskan tenang
  daripada di tengah menulis kode
- kriteria selesai Slice 1.1 adalah "halaman menampilkan status Firebase terhubung",
  jadi config-nya memang dibutuhkan sejak baris pertama

Urutan lengkapnya:

| # | Langkah | Siapa |
|---|---|---|
| 1 | Buat Firebase project (B1), salin config | Anda |
| 2 | Buat folder project + `.env.local` berisi config itu | Anda |
| 3 | **Slice 1.1** — scaffold Next.js, jalan di `localhost` | Claude CLI |
| 4 | Buat repo GitHub **private** kosong, `git push` | Anda |
| 5 | Slice 1.2–1.4 | Claude CLI |
| 6 | Sambungkan Vercel ke repo, isi env var, deploy | Anda |

Vercel sengaja ditaruh di nomor 6, bukan di awal: sampai ada yang layak dilihat orang
lain, `npm run dev` di komputer Anda sudah cukup, dan menundanya menghapus satu sumber
kebingungan di awal.

Langkah 4 memakai pola yang sudah Anda jalankan untuk `ccl-gaming-v2`: buat repo
**benar-benar kosong** (tanpa README, tanpa .gitignore, tanpa license), lalu
`git remote add origin ...` dan `git push -u origin main`.

> **GitHub Free sudah termasuk private repository tanpa batas** — tidak perlu berbayar.
> Repo portal sebaiknya private sejak awal, karena isinya bukan karya yang ingin
> dipublikasikan seperti manifesto CCL.

### B3. Environment variables

Isi di `.env.local` untuk kerja lokal, dan nanti di Vercel saat langkah 6:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

FIREBASE_ADMIN_PROJECT_ID      # dari file JSON service account
FIREBASE_ADMIN_CLIENT_EMAIL    # dari file JSON
FIREBASE_ADMIN_PRIVATE_KEY     # dari file JSON, pertahankan \n-nya
```

4. Setelah domain Vercel terbit: **Firebase → Authentication → Settings →
   Authorized domains** → tambahkan domain itu. Tanpa ini, Google Sign-In gagal.

---

## C. Stack

Sama dengan TNA, supaya modul yang disalin tidak perlu diterjemahkan:

- Next.js 15 (App Router) + TypeScript + Tailwind
- Firebase JS SDK via **npm** (bukan CDN) untuk client
- `firebase-admin` untuk Route Handler
- Deploy: Vercel

Aturan kerja yang berlaku di semua slice:

- `tsc --noEmit` dan lint **wajib bersih** sebelum commit
- Claude CLI **tidak pernah commit** tanpa instruksi eksplisit dari Anda
- Satu slice = satu sesi. Selesai berarti kriterianya terlihat di browser, bukan di kode.

---

## D. Slice Tahap 1

Tahap 1 di ARSITEKTUR.md §9 terlalu besar untuk satu sesi. Dipecah empat:

### Slice 1.1 — Kerangka yang hidup

Hasil: aplikasi Next.js jalan di `localhost` dan melaporkan Firebase terhubung.

**Prompt ini sengaja mandiri** — tidak menyuruh membaca `docs/`, karena folder
`docs/` baru disalin setelah scaffold selesai (create-next-app rewel terhadap folder
yang sudah berisi). Mulai slice 1.2 barulah prompt merujuk `docs/ARSITEKTUR.md`.

Buat folder kosong, misalnya `C:\game\insighttest`, buka di VSCode, lalu berikan:

```text
Kamu membangun project baru bernama InsightTest — platform evaluasi.
Kerjakan HANYA langkah-langkah di bawah, tidak lebih.

1. Scaffold di folder ini (non-interaktif):
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   --import-alias "@/*" --use-npm

2. npm install firebase

3. Buat SATU modul tunggal src/lib/firebase/client.ts:
   - initializeApp dari env NEXT_PUBLIC_FIREBASE_*
   - pakai pola singleton: getApps().length ? getApp() : initializeApp(cfg)
     supaya tidak dobel saat hot reload
   - ekspor app, auth, db
   ATURAN KERAS: tidak boleh ada initializeApp / getAuth / getFirestore di berkas
   lain mana pun. Semua akses Firebase melewati modul ini.

4. Ganti src/app/page.tsx dengan halaman sederhana berisi:
   - nama project dari NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - status "Firebase terhubung" atau "Firebase gagal"
   - JANGAN menampilkan apiKey atau isi env lain di layar

5. Buat firestore.rules di root, tolak semua untuk sementara:
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }

6. Pastikan .gitignore memuat .env*.local

Jalankan npx tsc --noEmit dan npm run lint sampai bersih.
JANGAN commit apa pun. Laporkan hasil dan cara menjalankannya.
```

**Cara Anda memeriksa**: `npm run dev`, buka `http://localhost:3000`, statusnya
"Firebase terhubung". Belum perlu Vercel.

**Setelah slice 1.1 selesai**, salin `ARSITEKTUR.md` dan `KICKOFF.md` ke folder
`docs/` di dalam project. Slice berikutnya merujuk ke sana.

### Slice 1.2 — Autentikasi

Hasil: bisa daftar, masuk, keluar. Dokumen `users/{uid}` terbentuk sekali dan benar.

**Ini slice paling rawan di seluruh tahap 1.** Salin **seluruh** `firestore.rules` dari
project TNA ke `docs/referensi/tna/firestore.rules` lebih dulu — jangan dipisah-pisah,
biarkan agen yang mengambil bagian yang relevan.

```text
Baca docs/arsitektur.md sampai selesai, terutama KA-1, KA-2, KA-3, dan KA-7.
Berkas di docs/referensi/tna/ adalah KODE RUJUKAN untuk disesuaikan, bukan disalin
mentah. JANGAN bawa konsep kompetensi, unit kerja, jabatan, pangkat, atau tusi.

Kerjakan HANYA Slice 1.2 — Autentikasi.

1. src/types/user.ts
   UserProfile: uid, email, displayName, photoURL,
   role: 'superadmin' | 'admin' | 'panitia' | 'peserta',
   status: 'pending' | 'aktif' | 'nonaktif',
   createdAt, updatedAt. Tanpa field khas TNA.

2. src/lib/auth/user-profile.ts
   createProfileForNewAccount(user) — SATU-SATUNYA fungsi di seluruh project yang
   membuat atau menulis dokumen users/{uid}. Default role 'peserta',
   status 'aktif' (gerbang undangan menyusul di slice 1.3).

3. src/lib/auth/session.ts
   registerWithEmail(), signInWithEmail(), signInWithGoogle(), signOutUser().
   Setiap jalur pendaftaran memanggil createProfileForNewAccount().
   Kalau pembuatan profil GAGAL, hapus akun Firebase Auth yang baru dibuat
   (rollback), supaya tidak ada akun yatim tanpa profil.

4. Auth provider (React context) di src/lib/auth/
   HANYA MEMBACA: onAuthStateChanged + onSnapshot ke users/{uid}.
   DILARANG KERAS menulis atau membuat dokumen users di provider ini.
   Ini mencegah race condition dua penulis — lihat KA-2.

5. Halaman: /masuk, /daftar, tombol keluar, dan /beranda yang menampilkan
   email, role, dan status pengguna yang sedang masuk.
   Redirect ke /masuk kalau belum login.

6. firestore.rules — ganti deny-all dengan:
   - fungsi bantu isSignedIn(), isOwner(uid), hasRole(r), isAdmin(), isSuperAdmin()
   - users/{uid}: pemilik boleh read; pemilik boleh create HANYA dokumen dirinya
     sendiri dengan role 'peserta' dan status 'aktif'; pemilik boleh update HANYA
     displayName dan photoURL — TIDAK BOLEH mengubah role maupun status;
     admin boleh read semua; superadmin boleh update role dan status.
   ATURAN KERAS: selalu resource.data.get('field', default),
   TIDAK PERNAH resource.data.field. Lihat KA-1.

Tanpa library UI tambahan; Tailwind polos cukup.
Jalankan npx tsc --noEmit dan npm run lint sampai bersih.
JANGAN commit. Laporkan hasil dan daftar berkas yang dibuat atau diubah.
```

**Setelah agen selesai, rules harus diterbitkan** — berkas di repo belum berlaku
sampai dipasang. Cara termudah untuk sekarang: buka Firebase Console → Firestore →
Rules, tempel isi `firestore.rules`, klik **Publish**. (Firebase CLI dipasang belakangan.)

**Cara Anda memeriksa** — ini pengujian terpenting di seluruh tahap 1:

1. Daftar akun baru **lewat browser sungguhan**, bukan skrip. Race condition ini lolos
   dari skrip Node karena skrip tidak me-mount provider.
2. Buka Firestore Console → `users`. Harus ada **tepat satu** dokumen, field lengkap.
3. Ulangi dengan Google Sign-In memakai email berbeda. Tetap satu dokumen per akun.
4. Di Console, ubah `role` salah satu akun jadi `superadmin` secara manual. Ini
   sekaligus membuktikan rules bekerja: pengguna tidak bisa melakukannya sendiri.
5. Coba ubah `role` sendiri lewat aplikasi (kalau ada jalannya) — harus ditolak.

> **Urutan 1.3 dan 1.4 ditukar** dari rencana awal. Undangan membutuhkan dua hal yang
> belum ada: sebuah **parameter** untuk menyimpan mode pendaftaran, dan sebuah **halaman
> admin** tempat undangan dikelola. Jadi kerangka admin dibangun lebih dulu.

### Slice 1.3 — AdminShell & parameter sistem

Hasil: area admin yang terjaga peran, dan pengaturan yang bisa diubah tanpa deploy ulang.

**Sebelum menguji**, ubah `role` akun Anda jadi `superadmin` lewat Firestore Console —
tanpa itu Anda tidak bisa masuk ke `/admin`.

```text
Baca docs/arsitektur.md, terutama §7 (peran bertingkat) dan KA-1.
Rujukan pola ada di docs/referensi/tna/.

Kerjakan HANYA Slice 1.3 — AdminShell & parameter.

1. src/types/parameter.ts
   SystemParameter: namaPlatform (string), modePendaftaran ('terbuka' | 'undangan'),
   pesanBeranda (string), updatedAt, updatedBy.

2. src/lib/services/system-parameter.ts
   getSystemParameter() dan updateSystemParameter().
   Dokumen tunggal: parameter/global.
   POLA WAJIB: parameter dibaca SEKALI oleh pemanggil lalu dioper sebagai argumen
   fungsi. Fungsi lain TIDAK BOLEH membaca ulang parameter di dalam dirinya.
   Kalau dokumen belum ada, kembalikan nilai default (namaPlatform 'InsightTest',
   modePendaftaran 'terbuka', pesanBeranda kosong) — jangan membuat dokumen diam-diam.

3. Area admin dengan route group (admin):
   - AdminShell: sidebar + header, satu tautan "Parameter" untuk sekarang
   - Penjaga peran: hanya role admin atau superadmin yang boleh masuk.
     peserta atau belum login dialihkan ke /beranda atau /masuk.
     Penjaga di klien HANYA untuk pengalaman pengguna — rules yang menegakkan.

4. Halaman /admin/parameter
   Form untuk mengubah ketiga field. Hanya superadmin yang boleh menyimpan;
   admin boleh melihat. Menyimpan saat dokumen belum ada berarti membuatnya.

5. Pakai namaPlatform dari parameter di halaman depan dan di judul AdminShell,
   dengan fallback 'InsightTest' kalau dokumen belum ada.

6. firestore.rules — tambahkan blok parameter/global:
   - read: siapa pun (termasuk belum login), karena isinya murni teks tampilan
   - write: hanya superadmin
   ATURAN KERAS: selalu resource.data.get('field', default). Lihat KA-1.
   CATATAN: karena dokumen ini terbuka dibaca, JANGAN pernah menaruh field
   sensitif di dalamnya. Beri komentar peringatan itu di rules.

Tanpa library UI tambahan; Tailwind polos cukup.
Jalankan npx tsc --noEmit dan npm run lint sampai bersih.
Terbitkan rules dengan: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasil dan daftar berkas yang dibuat atau diubah.
```

**Cara memeriksa**: masuk sebagai peserta → `/admin` ditolak. Masuk sebagai superadmin
→ sidebar muncul, ubah `namaPlatform` jadi sesuatu yang lain, muat ulang halaman depan
→ namanya berubah **tanpa deploy ulang**. Lalu coba tulis `parameter/global` sebagai
peserta lewat Rules Playground → harus ditolak.

### Slice 1.4 — Undangan & status akun

Dipecah dua supaya bagian paling berisiko — rules dan gerbang pendaftaran — diuji
**terpisah** sebelum UI dibangun di atasnya. Undangan uji dibuat manual lewat Firestore
Console di 1.4a; halaman adminnya baru dibuat di 1.4b.

Tiga mode pendaftaran, disimpan di `parameter/global.modePendaftaran`:

| Mode | Perilaku |
|---|---|
| `terbuka` | siapa pun boleh daftar, langsung `status: aktif` |
| `persetujuan` | siapa pun boleh daftar, tapi `status: pending` sampai admin mengaktifkan |
| `undangan` | hanya email yang punya undangan belum terpakai; ditolak kalau tidak ada |

#### Slice 1.4a — Model, rules, dan gerbang pendaftaran

```text
Baca docs/arsitektur.md, terutama KA-1, KA-2, KA-3, dan §7.
Rujukan: docs/referensi/tna/user-invitation.ts dan firestore.rules.

Kerjakan HANYA Slice 1.4a. JANGAN membuat halaman admin apa pun di slice ini.

1. src/types/undangan.ts
   Undangan: email, role ('admin' | 'panitia' | 'peserta'), catatan,
   createdAt, createdBy, usedAt (string | null), usedBy (string | null).

2. src/lib/services/user-invitation.ts
   ID dokumen = alamat email yang sudah di-trim dan di-lowercase, koleksi 'undangan'.
   ID deterministik ini WAJIB (KA-3) supaya rules bisa exists()/get() tanpa query.
   Sediakan getUndanganByEmail(), createUndangan(), deleteUndangan().

3. Perluas modePendaftaran di src/types/parameter.ts menjadi
   'terbuka' | 'persetujuan' | 'undangan'. Perbarui halaman /admin/parameter
   agar ketiganya bisa dipilih.

4. Gerbang pendaftaran di src/lib/auth/session.ts:
   - Baca parameter SEKALI di awal alur pendaftaran, lalu OPER sebagai argumen.
     Fungsi di bawahnya TIDAK BOLEH membaca ulang parameter.
   - terbuka     -> profil role 'peserta', status 'aktif'
   - persetujuan -> profil role 'peserta', status 'pending'
   - undangan    -> harus ada undangan untuk email itu dengan usedAt masih null.
                    Profil memakai role dari undangan, status 'aktif'.
                    Kalau tidak ada undangan atau sudah terpakai: TOLAK, dan
                    rollback akun Firebase Auth yang baru dibuat.
   - Pada mode undangan, pembuatan profil dan penandaan undangan terpakai
     (usedAt, usedBy) HARUS satu writeBatch — semua atau tidak sama sekali.

5. Gerbang masuk:
   Pengguna dengan status 'pending' atau 'nonaktif' TIDAK boleh masuk ke /beranda.
   Tampilkan halaman penjelasan yang sopan beserta tombol keluar.

6. firestore.rules:
   - undangan/{email}: read hanya oleh admin/superadmin ATAU oleh pengguna yang
     request.auth.token.email-nya sama dengan id dokumen.
     create/delete hanya admin/superadmin.
     update hanya oleh pengguna yang diundang, HANYA untuk mengisi usedAt dan usedBy,
     dan HANYA jika usedAt saat ini masih kosong.
   - users/{uid} create jadi dua jalur:
     (a) mode terbuka/persetujuan -> role dipaksa 'peserta'
     (b) mode undangan -> role harus sama dengan role di dokumen undangan
     Mode dibaca di rules dengan
     get(/databases/$(database)/documents/parameter/global).data.get('modePendaftaran','terbuka')
   - admin boleh update status pengguna; superadmin boleh update role dan status.

   PERINGATAN KHUSUS: gunakan .data.get('usedAt', null), JANGAN PERNAH .data.usedAt.
   Field yang tidak ada bukan null — ia menghasilkan evaluation error dan menolak.
   Insiden nyata di TNA persis pada field usedAt ini membuat pendaftaran tertutup
   gagal total dan akun ter-rollback. Lihat KA-1.

Tanpa library UI tambahan. Jalankan npx tsc --noEmit dan npm run lint sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa** (undangan dibuat manual lewat Firestore Console):

1. Mode `terbuka` → daftar email baru → berhasil, `status: aktif`.
2. Mode `persetujuan` → daftar email baru → berhasil tapi `status: pending`, dan
   pengguna itu tidak bisa masuk ke `/beranda`. Ubah status jadi `aktif` lewat Console
   → sekarang bisa masuk.
3. Mode `undangan`, tanpa undangan → daftar → **ditolak**. Lalu buka
   **Authentication → Users** dan pastikan tidak ada akun yatim tertinggal.
4. Mode `undangan`, buat dokumen `undangan/{email}` di Console berisi
   `role: "panitia"` dan `usedAt: null` → daftar dengan email itu → berhasil, profil
   ber-`role: panitia`, dan `usedAt` di undangan terisi.
5. Daftar lagi dengan email yang sama → **ditolak** karena undangan sudah terpakai.
6. **Uji kasus field hilang**: buat dokumen undangan di Console **tanpa** field `usedAt`
   sama sekali, lalu daftar dengan email itu. Harus tetap **berhasil**. Kalau gagal,
   berarti rules memakai `.data.usedAt` dan bukan `.data.get('usedAt', null)` —
   itu persis insiden TNA yang terulang.

#### Slice 1.4b — Halaman admin

`/admin/undangan` (daftar, tambah, hapus, tampak mana yang sudah terpakai) dan
`/admin/pengguna` (daftar pengguna, aktifkan/nonaktifkan, ubah peran — peran hanya oleh
superadmin). Setelah ini, mengubah peran tidak perlu lagi lewat Firestore Console.

---

## E. Audit sekali jalan setelah Slice 1.4

Sebelum lanjut ke tahap 2, lakukan sekali dan jangan diulur:

1. **Audit `.data.get()`** di seluruh `firestore.rules`. Cari setiap `.data.` yang tidak
   memakai `.get(...)`. Ini pelajaran termahal dari TNA (ARSITEKTUR.md KA-1) — dokumen
   yang dibuat manual lewat Console tanpa suatu field pernah membuat pendaftaran gagal
   total.
2. **Uji dari HP sungguhan**, bukan hanya emulator desktop.
3. **Pastikan tidak ada `getFirestore()` telanjang** di luar `src/lib/firebase/client.ts`.

---

## F. Tahap 1 selesai — 28 Agustus 2026

Live di `https://insighttest-gamma.vercel.app`. Firebase project `insighttest-66524`.
Auth (email + Google), profil penulis-tunggal, tiga mode pendaftaran, undangan, halaman
admin untuk parameter/undangan/pengguna. Audit KA-1 bersih, `npm run build` bersih.

---

## G. Tahap 2 — Topik & bank soal

Bank soal yang terisi membuat seluruh tahap berikutnya bisa dicoba dengan data
sungguhan. Itu sebabnya ia didahulukan sebelum kegiatan dan sertifikat.

| Slice | Isi |
|---|---|
| 2.1 | Topik sebagai data master, ID dokumen = kode |
| 2.2 | Bank soal + kunci jawaban di koleksi terpisah |
| 2.3 | Impor JSON berbantuan AI (REUSABLE.md §5) |

**Keputusan yang menentukan di 2.1**: ID dokumen topik = **kodenya sendiri**
(`topik/PENALARAN`), bukan auto-ID. Alasannya baru terasa di 2.3 — berkas impor merujuk
topik lewat `topikKode`, dan dengan ID deterministik validasinya cukup `exists()` tanpa
query, sekaligus mencegah kode ganda by construction (KA-3).

### Slice 2.1 — Topik

```text
Baca docs/arsitektur.md, terutama KA-3 (ID deterministik) dan §7 (peran).
Ikuti pola yang sudah ada di /admin/undangan: service murni CRUD, hook onSnapshot,
halaman memakai keduanya.

Kerjakan HANYA Slice 2.1.

0. Perbaikan kecil: ganti metadata title di src/app/layout.tsx dari "Create Next App"
   menjadi "InsightTest". Judul tab browser masih bawaan scaffold.

1. src/types/topik.ts
   Topik: kode, nama, deskripsi, urutan (number), isActive (boolean),
   createdAt, createdBy, updatedAt, updatedBy.

2. src/lib/services/topik.ts
   Koleksi 'topik'. ID DOKUMEN = kode (KA-3), dinormalkan: trim, huruf besar,
   hanya A-Z, 0-9, dan tanda hubung. Tolak kode di luar pola itu dengan pesan jelas.
   createTopik menolak kalau kode sudah dipakai.
   TIDAK ADA hapus permanen — sediakan nonaktifkan/aktifkan lewat isActive.
   Alasannya: topik yang dihapus akan meninggalkan soal yatim.

3. src/lib/hooks/use-topik-list.ts — onSnapshot, urut berdasarkan 'urutan' lalu 'nama'.

4. /admin/topik
   Tabel: kode, nama, deskripsi, urutan, status aktif.
   Form tambah dan sunting. Kode hanya bisa diisi saat membuat — saat menyunting
   kode dikunci, karena ia adalah ID dokumen.
   Tombol aktifkan/nonaktifkan. Hanya admin dan superadmin yang boleh membuka.
   Tambahkan ke sidebar AdminShell.

5. firestore.rules — tambahkan blok topik/{kode}:
   - read: semua pengguna yang sudah masuk (peserta perlu melihat topik nanti)
   - create, update: admin atau superadmin
   - delete: tidak diizinkan siapa pun
   ATURAN KERAS: selalu .data.get('field', default). Lihat KA-1.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**: buat topik `PENALARAN` dan `UMUM`. Coba buat `PENALARAN` lagi →
ditolak. Coba isi kode `Penalaran Dasar` (ada spasi dan huruf kecil) → dinormalkan jadi
`PENALARAN-DASAR` atau ditolak dengan pesan jelas, bukan tersimpan apa adanya.
Nonaktifkan satu topik → tetap ada di daftar, ditandai nonaktif. Masuk sebagai peserta →
`/admin/topik` tertolak.

### Slice 2.2 — Bank soal & kunci jawaban

Dua keputusan menentukan di sini, dan keduanya baru terasa manfaatnya belakangan.

**Kunci jawaban di koleksi terpisah** (KA-3). `soal` tidak pernah memuat penanda jawaban
benar. Kuncinya di `kunci_soal/{soalId}`, hanya terbaca admin. Di tahap 3, soal sampai ke
peserta lewat Route Handler yang tidak pernah menyentuh koleksi kunci.

**Satu helper penulis yang menerima `batch` dari luar** (REUSABLE.md §3). Form manual dan
importer massal nanti memakai fungsi yang **sama**, jadi validasinya satu sumber
kebenaran dan impor massal tetap bersifat semua-atau-tidak.

```text
Baca docs/arsitektur.md, terutama KA-1, KA-3, dan KA-6 (bank soal tidak terikat kegiatan).
Ikuti pola yang sudah ada di /admin/topik.

Kerjakan HANYA Slice 2.2.

1. src/types/soal.ts
   Soal: teks, tipe ('pilihan_ganda'), topikKode, tingkat ('mudah'|'sedang'|'sulit'),
   opsi: array { id, label }, isActive, createdAt/By, updatedAt/By.
   PENTING: opsi TIDAK punya penanda benar/salah sama sekali. Tipe KunciSoal terpisah:
   { opsiBenarId, pembahasan }.

2. src/lib/services/soal.ts
   - normalisasiTeks(): trim, rapatkan spasi ganda, untuk deteksi duplikat.
   - validasiSoal(): dipakai BERSAMA oleh form manual dan importer nanti —
     minimal 2 opsi, tepat satu opsi ditandai benar oleh pemanggil, teks tidak kosong,
     topikKode harus ada di koleksi topik dan aktif.
   - buildSoalWrite(batch, data, ctx): helper yang MENERIMA writeBatch dari luar
     lalu menambahkan tulisan ke 'soal' DAN 'kunci_soal' sekaligus.
     Ini wajib — slice 2.3 (impor massal) akan memakai fungsi yang sama.
   - createSoal() dan updateSoal(): buat batch sendiri, panggil buildSoalWrite,
     lalu commit. Soal dan kuncinya harus tersimpan atomik — semua atau tidak.
   - TIDAK ADA hapus permanen; pakai isActive.

3. src/lib/hooks/use-soal-list.ts — onSnapshot, bisa disaring per topikKode.

4. /admin/soal
   - Tabel: teks (dipotong), topik, tingkat, jumlah opsi, status aktif.
   - Saringan berdasarkan topik.
   - Form tambah/sunting: teks, topik (dropdown dari topik AKTIF saja), tingkat,
     dan daftar opsi dengan tepat satu yang ditandai benar (radio).
   - Saat menyunting, kunci jawaban yang tersimpan ikut dimuat dan ditampilkan.
   - Peringatan duplikat: kalau teks soal yang dinormalkan sudah ada di topik yang sama,
     tampilkan peringatan sebelum menyimpan.
   - Hanya admin dan superadmin. Tambahkan ke sidebar.

5. firestore.rules:
   - soal/{id}: read admin/superadmin; create/update admin/superadmin; delete ditolak.
     Peserta TIDAK membaca koleksi ini — di tahap 3 soal dikirim lewat Route Handler.
   - kunci_soal/{soalId}: read DAN write hanya admin/superadmin.
     Ditolak untuk peserta dan panitia tanpa kecuali. Lihat KA-3.
   ATURAN KERAS: selalu .data.get('field', default).

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**:

1. Buat tiga soal di topik `PENALARAN`. Buka Firestore Console → koleksi `soal` →
   pastikan **tidak ada** field apa pun yang menandai jawaban benar. Lalu buka
   `kunci_soal` → kuncinya ada di sana, satu dokumen per soal dengan ID yang sama.
2. Sunting satu soal, ubah jawaban benarnya, simpan. Periksa `kunci_soal` ikut berubah.
3. Coba simpan soal dengan hanya satu opsi → ditolak.
4. Simpan soal dengan teks yang sama persis di topik yang sama → muncul peringatan.
5. **Rules Playground**: simulasi `get` ke `/kunci_soal/<id soal>` dengan uid akun
   **peserta** → harus **ditolak**. Ulangi dengan uid superadmin → diizinkan.
   Ini pengujian terpenting di slice ini.

### Slice 2.3 — Impor soal berbantuan AI

Selesai 29 Agu 2026. Skema JSON berversi `1.0`, validasi dua lapis (zod untuk bentuk,
lalu `validasiSoal()` yang sama dengan form manual), pratinjau per baris, simpan dalam
satu `writeBatch` lewat `buildSoalWrite()`. Batas 200 soal per berkas karena satu batch
maksimal 500 operasi dan tiap soal memakai dua.

---

## H. Tahap 3 — Kegiatan, pendaftaran, dan penilaian server

Tahap terbesar, dan yang pertama memakai **Route Handler + Firebase Admin SDK**.
Sampai sekarang semua kode berjalan di browser; mulai di sini ada kode yang berjalan
di server dan memegang kunci yang tidak boleh dilihat siapa pun.

| Slice | Isi |
|---|---|
| 3.1 | Fondasi Admin SDK + satu Route Handler uji |
| 3.2 | Kegiatan + modul evaluasi (sisi admin) |
| 3.3 | Katalog kegiatan + pendaftaran peserta |
| 3.4 | Attempt, runner soal, penilaian di server |

3.1 sengaja kecil. Ia tidak menghasilkan fitur yang terlihat, tapi membuktikan tiga hal
yang kalau salah akan menyulitkan seluruh tahap: kunci service account terbaca di server,
token pengguna bisa diverifikasi, dan peran bisa dibaca dari sisi server.

### Yang Anda siapkan sendiri sebelum 3.1

Dari berkas JSON service account yang diunduh saat menyiapkan Firebase (Project settings
→ Service accounts), ambil tiga nilai dan masukkan ke `.env.local`:

```
FIREBASE_ADMIN_PROJECT_ID=insighttest-66524
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Tanpa awalan `NEXT_PUBLIC_`.** Awalan itu membuat nilainya ikut dikirim ke browser —
untuk kunci server, itu kebocoran total. Private key dibungkus tanda kutip dan tetap
memuat `\n` sebagai dua karakter; kodenya yang akan menerjemahkannya.

Nilai yang sama nanti juga perlu ditambahkan di **Vercel → Settings → Environment
Variables** sebelum deploy berikutnya.

### Slice 3.1 — Fondasi Route Handler

```text
Kerjakan HANYA Slice 3.1 — fondasi Route Handler dengan Firebase Admin SDK.
Slice ini sengaja kecil karena memperkenalkan hal baru: kode yang berjalan
di server, bukan di browser.

1. npm install firebase-admin

2. src/lib/firebase/admin.ts — SATU-SATUNYA tempat Admin SDK diinisialisasi.
   - Baca FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
     FIREBASE_ADMIN_PRIVATE_KEY dari process.env.
   - PENTING: private key di env memuat urutan karakter \n secara harfiah.
     Wajib diubah jadi baris baru sungguhan: .replace(/\\n/g, "\n").
     Tanpa ini inisialisasi gagal dengan pesan galat yang menyesatkan.
   - Pola singleton, seperti client.ts.
   - Ekspor adminAuth dan adminDb.
   - Berkas ini TIDAK BOLEH diimpor dari komponen klien mana pun.

3. src/lib/api/auth-server.ts
   verifyRequest(req): baca header Authorization: Bearer <idToken>,
   verifikasi dengan adminAuth.verifyIdToken(), lalu ambil profil pengguna
   dari adminDb koleksi users.
   Kembalikan { uid, email, role, status }, atau lempar galat terstruktur:
   401 kalau token tidak ada atau tidak sah, 403 kalau status bukan 'aktif'.

4. src/lib/api/client-fetch.ts
   Helper sisi klien: ambil ID token lewat auth.currentUser.getIdToken(),
   lalu panggil fetch dengan header Authorization: Bearer <token>.

5. GET /api/whoami — Route Handler yang memakai verifyRequest dan mengembalikan
   { uid, email, role, status }. Semata alat uji fondasi.

6. Di /beranda, tambahkan tombol kecil "Uji koneksi server" yang memanggil
   /api/whoami lewat helper poin 4 dan menampilkan hasilnya apa adanya.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**: masuk sebagai superadmin, klik "Uji koneksi server" di `/beranda` —
harus muncul uid, email, dan `role: superadmin` yang dibaca **dari sisi server**, bukan
dari keadaan di browser. Lalu masuk sebagai peserta dan ulangi — `role: peserta`.

Uji jalur gagal: buka `/api/whoami` langsung di alamat browser tanpa header apa pun →
harus membalas **401**, bukan data.

> **Catatan yang sering membingungkan**: alamat di bilah browser **selalu** menghasilkan
> 401, siapa pun yang sedang masuk. Browser mengirim cookie, tapi token identitas Firebase
> bukan cookie — ia hanya bisa dilampirkan oleh kode aplikasi lewat `fetchWithAuth`.
> Jadi 401 dari bilah alamat adalah tanda penjaganya bekerja, bukan tanda rusak.
> Pengujian yang sesungguhnya hanya lewat tombol di `/beranda`.

Selesai 29 Agu 2026: `{"status":200, "role":"superadmin", "status":"aktif"}`.

### Slice 3.2 — Kegiatan & modul evaluasi

Sisi admin saja. Peserta, pendaftaran, dan penilaian menyusul di 3.3 dan 3.4.

```text
Baca docs/arsitektur.md, terutama §2 (tiga kategori isi kegiatan), §5 (model data),
KA-4 (syarat kelulusan sebagai parameter), KA-5 (snapshot), dan KA-6 (bank soal
tidak terikat kegiatan). Ikuti pola yang sudah ada di /admin/soal.

Kerjakan HANYA Slice 3.2 — kegiatan dan modul evaluasi, sisi admin.
JANGAN membuat halaman peserta, pendaftaran, attempt, maupun Route Handler baru.

1. src/types/kegiatan.ts
   Kegiatan: judul, deskripsi, dibukaPada, ditutupPada (ISO string atau null),
   isPublished, isArchived, syaratSertifikat, createdAt/By, updatedAt/By.
   syaratSertifikat: { jenis: 'nilai_minimum' | 'manual_admin', nilaiMinimum: number }
   — disimpan sekarang meski sertifikat baru dibangun di tahap 4.
   KA-4: syarat kelulusan TIDAK BOLEH di-hardcode di kode.

   ModulKegiatan: judul, kategori ('referensi' | 'atestasi' | 'evaluasi'),
   urutan, wajib (boolean), dan konfigurasi khusus evaluasi:
   { pemilihanSoal: { mode: 'tetap' | 'acak', soalIds: string[],
     topikKode: string | null, jumlah: number | null },
     nilaiMinimum, maksPercobaan, batasWaktuMenit, acakUrutanSoal }
   Di slice ini HANYA kategori 'evaluasi' yang diimplementasikan. Dua kategori lain
   sudah masuk tipe supaya tidak perlu migrasi nanti, tapi belum ada UI-nya.

2. src/lib/services/kegiatan.ts dan modul.ts
   Koleksi 'kegiatan' (auto-ID), subkoleksi 'kegiatan/{id}/modul' (auto-ID).
   TIDAK ADA hapus permanen untuk kegiatan — pakai isArchived.
   KA-6: modul menyimpan RUJUKAN ke soal (daftar id, atau topikKode + jumlah),
   TIDAK PERNAH menyalin isi soal.
   Validasi: mode 'tetap' wajib punya minimal 1 soalId; mode 'acak' wajib punya
   topikKode dan jumlah >= 1, dan jumlah tidak boleh melebihi banyaknya soal
   aktif di topik itu.

3. Hook use-kegiatan-list.ts dan use-modul-list.ts (onSnapshot).

4. /admin/kegiatan
   Tabel: judul, jendela waktu, jumlah modul, status terbit/arsip.
   Form tambah/sunting. Tombol terbitkan/tarik dan arsipkan.

5. /admin/kegiatan/[id]
   Sunting kegiatan dan kelola daftar modulnya.
   Form modul evaluasi: judul, urutan, wajib, nilai minimum, maks percobaan,
   batas waktu, acak urutan, dan pemilihan soal — mode tetap dengan pemilih soal
   per topik, atau mode acak dengan topik + jumlah.
   Kalau kegiatan sudah diterbitkan, tampilkan peringatan sebelum menyunting modul:
   perubahan setelah ada peserta bisa membuat hasil lama tidak konsisten (KA-5).

6. firestore.rules:
   - kegiatan/{id}: read kalau sudah masuk DAN (isPublished true ATAU admin);
     create/update admin/superadmin; delete ditolak.
   - kegiatan/{id}/modul/{mid}: read semua yang sudah masuk; write admin/superadmin.
   ATURAN KERAS: selalu .data.get('field', default).

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**: buat kegiatan, tambahkan satu modul evaluasi mode **acak** dengan
topik `PENALARAN` dan jumlah melebihi banyaknya soal di topik itu → harus ditolak.
Buat modul mode **tetap** tanpa memilih soal sama sekali → ditolak. Terbitkan kegiatan,
lalu coba sunting modulnya → muncul peringatan. Terakhir, di Firestore Console periksa
dokumen modul: ia hanya memuat **id soal atau topik + jumlah**, tidak pernah teks soal.

### Slice 3.3 — Profil, katalog, dan pendaftaran

Slice pertama yang benar-benar menyentuh peserta. Tiga bagian yang saling bergantung.

**Nama lengkap peserta** disimpan di profil, bukan diketik ulang tiap mendaftar — lalu
di-snapshot ke pendaftaran. §11 sudah memperingatkan: `displayName` dari Google sering
informal, dan sertifikat yang salah nama berarti mencetak ulang ratusan lembar.

**Pendaftaran dikerjakan Route Handler, bukan klien.** Nomor urut sertifikat dialokasikan
di sini (§10), dan menaikkan penghitung di dokumen `kegiatan` menuntut hak tulis yang
tidak boleh dimiliki peserta. Sekalian pemeriksaan kelayakan dan pengambilan snapshot
modul dipusatkan di satu tempat yang tidak bisa dilewati.

```text
Baca docs/arsitektur.md: §7 (model data), §10 (nomor serial dialokasikan saat
pendaftaran), §11 (formulir peserta), KA-3, KA-5.
Slice 3.1 sudah menyediakan verifyRequest() dan fetchWithAuth() — pakai keduanya.

Kerjakan HANYA Slice 3.3. JANGAN membuat attempt, runner soal, atau penilaian.

1. Perluas UserProfile di src/types/user.ts:
   tambahkan namaLengkap, institusi, nomorIdentitas, noTelepon (semua string,
   boleh kosong). Jangan sentuh role dan status.

2. Halaman /profil untuk peserta mengisi keempat field itu.
   Label namaLengkap harus eksplisit: "Nama lengkap — inilah yang akan tercetak
   di sertifikat". Tampilkan pratinjau nama itu di bawah kolomnya.

3. firestore.rules — perluas izin update users/{uid} oleh pemilik menjadi
   displayName, photoURL, namaLengkap, institusi, nomorIdentitas, noTelepon.
   role dan status TETAP terlarang bagi pemilik. Lihat KA-1 dan KA-7.

4. Katalog peserta:
   - /kegiatan — daftar kegiatan yang isPublished true dan tidak diarsipkan.
   - /kegiatan/[id] — judul, deskripsi, jendela waktu, daftar modul (hanya judul,
     kategori, dan wajib/opsional — JANGAN tampilkan konfigurasi soal), status
     pendaftaran pengguna, dan tombol Daftar.

5. POST /api/pendaftaran — Route Handler, memakai verifyRequest.
   Body: { kegiatanId }. Semua pemeriksaan di server:
   - kegiatan ada, isPublished true, tidak diarsipkan
   - waktu sekarang berada di dalam dibukaPada..ditutupPada (kalau diisi)
   - pengguna belum terdaftar di kegiatan ini
   - profil pengguna sudah punya namaLengkap tidak kosong; kalau kosong balas
     400 dengan pesan yang menyuruh melengkapi profil dulu
   Lalu dalam SATU transaksi Firestore:
   - baca kegiatan.nomorUrutTerakhir (default 0), naikkan satu, tulis balik
   - buat pendaftaran/{kegiatanId}_{uid} berisi: kegiatanId, uid, email,
     namaLengkap dan institusi (snapshot dari profil), nomorUrut,
     modulSnapshot (array { modulId, judul, kategori, wajib, nilaiMinimum }),
     status 'terdaftar', daftarPada
   KA-5: snapshot ini yang dipakai nanti, bukan modul yang bisa berubah.

6. GET /api/pendaftaran/saya — daftar pendaftaran milik pengguna yang sedang masuk.
   Tampilkan di /beranda sebagai "Kegiatan saya".

7. firestore.rules — pendaftaran/{id}:
   read oleh pemilik (uid cocok) atau admin/superadmin.
   create, update, delete DITOLAK untuk semua klien — hanya server yang menulis.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**:

1. Sebagai peserta yang profilnya kosong, coba daftar → ditolak dengan pesan yang
   menyuruh melengkapi nama lengkap.
2. Isi profil, daftar lagi → berhasil. Di Firestore, `pendaftaran/{kegiatanId}_{uid}`
   berisi `nomorUrut: 1` dan `modulSnapshot` yang lengkap.
3. Daftar lagi di kegiatan yang sama → ditolak, dan **tidak ada** dokumen kedua.
4. Daftarkan peserta kedua → `nomorUrut: 2`. Periksa `kegiatan.nomorUrutTerakhir`
   ikut menjadi 2.
5. **Rules Playground**: simulasi `create` ke `/pendaftaran/apa_saja` sebagai peserta
   → harus **ditolak**. Ini membuktikan pendaftaran tidak bisa dipalsukan dari
   console browser, melewati semua pemeriksaan di Route Handler.
6. Ubah kegiatan jadi belum terbit, lalu coba daftar → ditolak.

**Pelajaran dari 3.2/3.3 yang berlaku seterusnya**: rules Firestore **bukan penyaring**.
Query yang tidak menjamin batasannya ditolak seluruhnya, bukan disaring. Karena itu
query peserta wajib menyertakan `where('isPublished','==',true)`. Dan hook yang menelan
galat lalu menampilkannya sebagai keadaan kosong lebih berbahaya daripada bug-nya
sendiri — semua hook kini membedakan memuat, gagal, dan kosong.

### Slice 3.4a — Attempt, pengerjaan soal, penilaian server

Slice yang menutup janji utama platform: peserta mengerjakan, nilai keluar, dan nilainya
tidak bisa dipalsukan dari browser. Antarmuka sengaja sederhana dulu; penghitung waktu
yang terlihat dan poles tampilan menyusul di 3.4b.

```text
Baca docs/arsitektur.md: KA-1, KA-3 (kunci jawaban), KA-5 (snapshot),
§5 (jebakan kuota tulis), §7 (model data).
Slice 3.1 menyediakan verifyRequest() dan fetchWithAuth(). Pakai keduanya.

Kerjakan HANYA Slice 3.4a. Antarmuka sederhana: semua soal dalam satu halaman,
satu tombol kirim. Penghitung waktu terlihat dan poles tampilan menyusul di 3.4b.

1. src/types/attempt.ts
   Attempt: kegiatanId, modulId, uid, attemptKe, status
   ('berlangsung' | 'selesai' | 'kadaluarsa'), mulaiPada, kadaluarsaPada (ISO | null),
   selesaiPada (ISO | null), soalIds (string[]), jawaban (array {soalId, opsiId}),
   skor, benar, total, lulus.

   PENTING (§5): jawaban disimpan sebagai ARRAY di dalam dokumen attempt,
   BUKAN dokumen per soal. 500 peserta x 40 soal = 20.000 tulis, tepat
   menghabiskan kuota gratis harian. Satu attempt selesai = satu tulis.

2. POST /api/attempt — body { kegiatanId, modulId }. Semua diperiksa di server:
   - pengguna terdaftar di kegiatan itu
   - jendela waktu kegiatan terbuka
   - jumlah attempt sebelumnya belum mencapai maksPercobaan
   - kalau ada attempt 'berlangsung' yang belum kadaluarsa, KEMBALIKAN ITU,
     jangan membuat yang baru
   - pilih soal: mode 'tetap' pakai soalIds modul; mode 'acak' ambil soal aktif
     bertopik itu, acak, ambil sebanyak 'jumlah'
   - acak urutan kalau acakUrutanSoal true
   - SIMPAN soalIds ke dokumen attempt — dibekukan, supaya memuat ulang halaman
     tidak mengacak ulang soal
   - hitung kadaluarsaPada dari batasWaktuMenit (null kalau tidak dibatasi)
   - balas { attemptId, kadaluarsaPada, soal: [{id, teks, opsi:[{id,label}]}] }
   ATURAN MUTLAK: handler ini TIDAK BOLEH menyentuh koleksi kunci_soal sama sekali.
   Jawaban benar tidak pernah ikut ke browser. Lihat KA-3.

3. POST /api/attempt/[id]/submit — body { jawaban: [{soalId, opsiId}] }
   - verifikasi pemilik attempt; tolak kalau status bukan 'berlangsung'
   - PERIKSA WAKTU DI SERVER: kalau sudah melewati kadaluarsaPada, set status
     'kadaluarsa' dan nilai apa adanya. Jangan percaya penghitung di browser.
   - baca kunci_soal untuk soalIds yang beku (Admin SDK), hitung benar,
     skor = round(benar / total * 100)
   - lulus = skor >= nilaiMinimum dari modulSnapshot di pendaftaran (KA-5),
     bukan dari modul yang bisa berubah
   - tulis hasil ke attempt dalam SATU operasi tulis
   - perbarui pendaftaran: hasilModul[modulId] =
     { skorTertinggi, lulus, percobaan } — skor yang dipakai adalah TERTINGGI
   - balas { skor, benar, total, lulus }

4. GET /api/attempt/[id] — kembalikan attempt milik pengguna beserta soalnya
   (tanpa kunci), untuk halaman yang dimuat ulang.

5. Halaman /kegiatan/[id]/modul/[modulId]
   - Layar mulai: judul modul, jumlah soal, nilai minimum, batas waktu,
     percobaan ke berapa dari berapa. Tombol "Mulai mengerjakan".
   - Layar pengerjaan: semua soal dalam satu halaman, radio per soal,
     tombol "Kirim jawaban" dengan konfirmasi.
   - Layar hasil: skor, benar dari total, lulus atau belum.
   - WAJIB nyaman di layar 390px potret. Peserta mengerjakan sambil memegang
     ponsel berdiri — ini bukan halaman admin yang boleh desktop-first.
   - Tautkan dari /kegiatan/[id]: tiap modul evaluasi punya tombol menuju sini.

6. firestore.rules — attempt/{id}:
   read oleh pemilik atau admin/superadmin.
   create, update, delete DITOLAK untuk semua klien — server saja.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa** — tiga di antaranya menguji hal yang tidak terlihat dari tampilan:

1. Kerjakan modul sebagai peserta, kirim jawaban, lihat skornya keluar.
2. **DevTools → tab Network**, buka respons `POST /api/attempt`. Periksa isinya:
   soal dan opsi ada, **tidak ada satu pun penanda jawaban benar**. Kalau ada,
   siapa pun bisa membaca kunci sebelum menjawab.
3. Muat ulang halaman di tengah pengerjaan → soalnya **sama persis**, tidak teracak
   ulang. Itu bukti `soalIds` dibekukan.
4. Kerjakan ulang sampai melewati maksPercobaan → ditolak.
5. Kerjakan dua kali dengan skor berbeda → `pendaftaran.hasilModul` menyimpan yang
   **tertinggi**.
6. **Rules Playground**: `update` ke `/attempt/<id>` sebagai pemiliknya sendiri →
   harus **ditolak**. Ini yang membuktikan peserta tidak bisa menimpa skornya sendiri
   lewat console browser.

**Tahap 3 selesai 30 Agu 2026.** Diverifikasi lewat browser: respons `POST /api/attempt`
hanya memuat `attemptId`, `kadaluarsaPada`, dan `soal[].{id, teks, opsi[].{id,label}}` —
tidak ada field kunci jawaban di jalur mana pun. Memuat ulang halaman mempertahankan
urutan soal yang sama persis. Penilaian benar di kedua arah: 67 tidak lulus, 100 lulus,
ambang 70.

**Slice 3.4b (penghitung waktu terlihat, poles tampilan) ditunda** ke fase poles bersama
perapian tabel admin. Alasannya: runner soal sudah mobile-first, dan poles yang dikerjakan
setelah gelombang nyata pertama jauh lebih tepat sasaran daripada menebak sekarang.

---

## I. Tahap 4 — Sertifikat

| Slice | Isi |
|---|---|
| 4.1 | Penerbitan di server: kode kegiatan, serial, kelayakan, snapshot terkunci |
| 4.2 | Halaman sertifikat peserta, cetak, dan verifikasi publik `/s/{kode}` |
| 4.3 | Penerbitan massal berpratinjau untuk admin |

**Buah dari keputusan lama**: nomor serial memakai `nomorUrut` yang sudah dialokasikan
saat pendaftaran (§10). Jadi di saat ratusan peserta selesai bersamaan, tidak ada satu pun
dokumen penghitung yang perlu dinaikkan — titik panas yang akan mematikan penerbitan
massal sudah dihindari berbulan sebelum ia sempat terjadi.

### Slice 4.1 — Penerbitan sertifikat di server

```text
Baca docs/arsitektur.md: §10 (sertifikat), KA-3, KA-4, KA-6 (snapshot & kunci), §7.
Slice 3.1 menyediakan verifyRequest(). Pakai itu.

Kerjakan HANYA Slice 4.1. JANGAN membuat halaman cetak, halaman verifikasi publik,
atau penerbitan massal — itu 4.2 dan 4.3.

1. Tambahkan field `kode` ke Kegiatan: huruf besar, hanya A-Z 0-9 dan tanda hubung,
   wajib diisi, unik di antara kegiatan yang belum diarsipkan.
   Tampilkan di form /admin/kegiatan. Kode ini menyusun nomor serial sertifikat.
   Kegiatan lama yang belum punya kode: tolak penerbitan dengan pesan jelas
   yang menyuruh admin mengisi kodenya dulu.

2. src/types/sertifikat.ts
   Sertifikat: kegiatanId, uid, serial, kodeVerifikasi, namaLengkap,
   judulKegiatan, nilaiAkhir, items (array {modulId, judul, skor, lulus}),
   status ('berlaku' | 'dicabut'), terbitPada, diterbitkanOleh.
   SEMUANYA snapshot (KA-6): nama dan judul DISALIN saat terbit, bukan dirujuk.
   Sertifikat yang sudah terbit tidak boleh berubah kalau nama profil atau judul
   kegiatan disunting kemudian.

3. src/lib/sertifikat-syarat.ts — evaluasiKelayakan(pendaftaran, kegiatan):
   - jenis 'nilai_minimum': layak kalau SEMUA modul di modulSnapshot yang wajib
     dan berkategori evaluasi punya hasilModul.lulus === true
   - jenis 'manual_admin': tidak pernah layak otomatis; hanya admin yang menerbitkan
   - kembalikan { layak, alasan, nilaiAkhir, items }.
     nilaiAkhir = rata-rata skor modul wajib berkategori evaluasi.
   Fungsi ini dipakai BERSAMA oleh penerbitan mandiri dan penerbitan massal nanti.

4. POST /api/sertifikat/terbitkan — body { kegiatanId, uid? }
   - tanpa uid: peserta menerbitkan miliknya sendiri. Hanya boleh kalau
     syaratSertifikat.jenis 'nilai_minimum' DAN evaluasiKelayakan bilang layak.
   - dengan uid: hanya admin/superadmin, boleh untuk jenis apa pun.
   - ID deterministik: sertifikat/{kegiatanId}_{uid} (KA-3).
     Kalau sudah ada dan status 'berlaku', KEMBALIKAN yang ada — jangan menerbitkan
     ulang dan jangan menimpa.
   - serial = `${kegiatan.kode}/${tahun}/${nomorUrut dipad 4 digit}`.
     nomorUrut diambil dari dokumen pendaftaran — SUDAH dialokasikan saat mendaftar,
     jadi TIDAK ADA penghitung yang dinaikkan di sini. Lihat §10.
   - kodeVerifikasi: acak 10 karakter (huruf besar + angka), TIDAK boleh bisa
     ditebak dari serial. Pastikan belum dipakai sertifikat lain.
   - perbarui pendaftaran.status jadi 'selesai' kalau layak.

5. GET /api/sertifikat/saya — daftar sertifikat milik pengguna yang masuk.
   Tampilkan ringkas di /beranda: judul kegiatan, serial, tanggal terbit.

6. firestore.rules — sertifikat/{id}:
   read oleh pemilik atau admin/superadmin.
   create, update, delete DITOLAK untuk semua klien — server saja.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
Terbitkan rules: npx firebase deploy --only firestore:rules
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**:

1. Isi kode kegiatan, misalnya `UJI2026`. Sebagai peserta yang sudah lulus, terbitkan
   sertifikat → serial berbentuk `UJI2026/2026/0001` dengan nomor yang sama dengan
   `nomorUrut` pendaftarannya.
2. Terbitkan lagi → mengembalikan sertifikat yang sama, **tidak** membuat dokumen kedua
   dan tidak mengubah serialnya.
3. **Uji snapshot**: setelah sertifikat terbit, ubah `namaLengkap` di `/profil` dan ubah
   judul kegiatan di admin. Buka sertifikatnya lagi — nama dan judul di dalamnya harus
   **tetap yang lama**. Kalau ikut berubah, snapshot-nya gagal dan sertifikat lama bisa
   berubah isi diam-diam.
4. Sebagai peserta yang **belum** lulus, coba terbitkan → ditolak dengan alasan jelas.
5. **Rules Playground**: `create` ke `/sertifikat/apa_saja` sebagai peserta → ditolak.

**Slice 4.1 selesai 31 Agu 2026.** Serial `UJI2026/2026/0001`. Uji snapshot lolos telak:
nama profil diubah jadi "wahana garuda" dan judul kegiatan jadi "kegiatan pionir
pengujian", dokumen sertifikat tetap menyimpan "agus wahana" dan "kegiatan tahap
pengujian".

**Pelajaran operasional dari pengujian ini**: cuplikan modul dibekukan saat peserta
mendaftar. Modul yang ditambahkan **setelah** itu tidak masuk ke program peserta lama —
tidak ke penilaian, tidak ke sertifikat. Prosedur yang benar: susun seluruh modul dulu,
terbitkan kegiatan, baru buka pendaftaran. Kalau program berubah setelah peserta masuk,
itu gelombang baru — buat kegiatan baru.

### Slice 4.2 — Halaman sertifikat, cetak, dan verifikasi publik

```text
Baca docs/arsitektur.md: §10 (sertifikat), §11 (standar minimum & lanjutan), KA-6.

Kerjakan HANYA Slice 4.2. Penerbitan massal untuk admin tetap di 4.3.

0. PERBAIKAN PENTING: di /kegiatan/[id], untuk peserta yang SUDAH terdaftar,
   tampilkan daftar modul dari modulSnapshot miliknya sendiri — BUKAN daftar modul
   kegiatan yang hidup. Sekarang keduanya bisa berbeda, dan peserta melihat modul
   yang tidak dinilai untuknya. Untuk yang belum terdaftar, tetap tampilkan
   daftar hidup sebagai gambaran isi kegiatan.

1. Field template sertifikat pada Kegiatan (semua opsional, semua berupa URL/teks):
   logoUrl, kopUrl, penandatanganNama, penandatanganJabatan, tandaTanganUrl,
   teksTambahan. Tampilkan di form /admin/kegiatan/[id] dalam satu blok
   "Template sertifikat". Semuanya boleh kosong — sertifikat minimum tetap sah.
   Gambar DITAUTKAN lewat URL, tidak diunggah. Belum perlu Cloud Storage.

2. npm install qrcode dan @types/qrcode

3. Halaman /sertifikat/[id] — hanya pemilik atau admin yang boleh membuka.
   Isi wajib: nama lengkap, judul kegiatan, tanggal terbit, serial, tabel modul
   dari items (judul, skor, status), nilai akhir, kode verifikasi,
   dan QR code menuju halaman verifikasi publiknya.
   Isi opsional: logo, kop, penandatangan beserta gambar tanda tangan, teks tambahan
   — tampilkan hanya kalau terisi.
   Footer wajib: "Daftar di atas hanya memuat materi yang ditetapkan pada kegiatan
   ini. Bukan dokumen negara."
   Tombol "Cetak" memanggil window.print().

   CETAK: tambahkan @media print yang WAJIB memaksa latar putih dan teks hitam,
   menyembunyikan navigasi dan tombol, dan memakai @page { size: A4 landscape }.
   Versi layar boleh gelap seperti sisa aplikasi; versi cetak harus terang —
   sertifikat gelap akan menghabiskan tinta dan tidak terbaca.

   Tautkan dari /beranda (seksi "Sertifikat saya") dan dari /kegiatan/[id].

4. Halaman publik /s/[kode] — TANPA login.
   Server component yang membaca sertifikat lewat Admin SDK berdasarkan
   kodeVerifikasi (rules menolak baca publik, jadi WAJIB lewat Admin SDK).
   Tampilkan HANYA: nama lengkap, judul kegiatan, tanggal terbit, serial,
   nilai akhir, daftar modul, dan status berlaku atau dicabut.
   JANGAN pernah menampilkan email, uid, nomor identitas, nomor telepon,
   atau institusi. Halaman ini terbuka untuk siapa pun di internet.
   Kode tidak dikenal: tampilkan "Sertifikat tidak ditemukan" yang sama untuk
   semua kasus — jangan membocorkan apakah formatnya benar atau kodenya pernah ada.
   Sertifikat dicabut: tampilkan jelas bahwa ia TIDAK berlaku.

5. Jangan mengubah firestore.rules. Halaman publik memakai Admin SDK, bukan
   klien. Kalau menurutmu ada yang kurang, LAPORKAN saja.

Jalankan npx tsc --noEmit dan npm run build sampai bersih.
JANGAN commit. Laporkan hasilnya.
```

**Cara memeriksa**:

1. Buka `/sertifikat/[id]` sebagai pemiliknya → semua isi tampil, QR muncul.
2. Tekan **Ctrl+P**. Di pratinjau cetak, latar harus **putih** dan teks hitam,
   navigasi hilang, muat dalam satu halaman A4 lanskap.
3. Pindai QR-nya dengan ponsel, atau buka `/s/{kodeVerifikasi}` **di jendela incognito
   tanpa login** → halaman verifikasi tampil.
4. **Uji kebocoran**: di halaman `/s/{kode}` itu, tekan Ctrl+U atau periksa DevTools →
   pastikan **tidak ada** email, uid, nomor identitas, atau nomor telepon di mana pun
   dalam sumber halamannya. Halaman ini terbuka untuk seluruh internet.
5. Buka `/s/KODEASAL-ASALAN` → "Sertifikat tidak ditemukan", bukan galat server.
6. Buka `/sertifikat/[id]` milik orang lain sebagai peserta biasa → ditolak.
7. Isi logo dan penandatangan di admin, muat ulang sertifikat → keduanya muncul.
   Kosongkan lagi → sertifikat tetap sah tanpa keduanya.

**Pelajaran cetak (31 Agu 2026)**: `@page { size: landscape }` hanya *mengusulkan*
orientasi. Microsoft Print to PDF — tujuan cetak bawaan Windows — mengabaikannya dan
memutar hasilnya, meski pratinjau Chrome sudah benar. Karena peserta mencetak di
komputer dan driver yang tidak kita kendalikan, sertifikat memakai **A4 potret**:
orientasi bawaan di mana pun, tidak pernah perlu diputar siapa pun.

### Slice 4.3 — Penerbitan massal & pembekuan penandatangan

```text
Baca docs/arsitektur.md: §10 (penerbitan massal berpratinjau), KA-6 (snapshot).
evaluasiKelayakan() sudah ada di src/lib/sertifikat-syarat.ts — pakai itu, jangan
menulis ulang logikanya.

Kerjakan HANYA Slice 4.3.

0. Perbaikan cetak: isi sertifikat sekarang menumpuk di separuh atas halaman.
   Buat kartu cetak MENGISI tinggi halaman: flex kolom dengan pembagian ruang,
   sehingga blok atas (SERTIFIKAT, nama, kegiatan, nilai, tabel modul) di bagian
   atas, dan blok bawah (kiri QR+kode+serial+tautan, kanan tanggal+tanda tangan+
   nama/jabatan) terdorong ke BAWAH halaman, footer di baris paling akhir.
   Berlaku saat cetak; tampilan layar boleh tetap seperti sekarang.

1. BEKUKAN PENANDATANGAN. Saat sertifikat diterbitkan, salin penandatanganNama dan
   penandatanganJabatan dari template kegiatan ke dalam dokumen sertifikat.
   Alasannya: nama penandatangan bukan branding, melainkan pernyataan seseorang.
   Kalau pejabatnya berganti, mencetak ulang sertifikat lama tidak boleh menampilkan
   orang yang tidak terlibat, dan cetakan ulang tidak boleh berbeda dari lembar yang
   sudah dipegang peserta.
   logoUrl, kopUrl, dan tandaTanganUrl TETAP diambil hidup — itu memang branding.
   Sertifikat lama yang belum punya field ini: mundur ke template hidup.

2. GET /api/admin/pendaftaran?kegiatanId=... — hanya admin/superadmin.
   Kembalikan daftar peserta terdaftar: nama, email, institusi, nomor urut,
   status, hasil per modul, hasil evaluasiKelayakan (layak + alasan), dan
   apakah sertifikatnya sudah terbit beserta serialnya.

3. POST /api/sertifikat/terbitkan-massal — body { kegiatanId, uids: string[] }.
   Hanya admin/superadmin. Terbitkan untuk tiap uid memakai jalur penerbitan yang
   SUDAH ADA (jangan menduplikasi logikanya). Kembalikan hasil per uid:
   berhasil dengan serial, atau gagal dengan alasan.
   BATAS PENTING: tolak permintaan berisi lebih dari 25 uid. Menerbitkan ratusan
   sertifikat dalam satu permintaan akan melewati batas waktu fungsi serverless.

4. /admin/kegiatan/[id]/peserta
   - Tabel peserta dengan kolom kelayakan dan status sertifikat.
   - Kotak centang per baris; baris yang sudah punya sertifikat otomatis tidak
     tercentang dan tidak bisa dipilih.
   - Tombol "Terbitkan terpilih" yang mengirim dalam POTONGAN 25 uid berurutan,
     menampilkan kemajuan ("menerbitkan 25 dari 120…") dan merangkum hasilnya
     per peserta setelah selesai.
   - Ini pratinjau yang dimaksud §10: admin melihat siapa yang memenuhi syarat,
     mencoret yang perlu dicoret, lalu menerbitkan.

5. Pencabutan: tombol "Cabut" per baris yang sudah bersertifikat, memanggil
   POST /api/sertifikat/cabut { kegiatanId, uid, alasan }. Hanya admin/superadmin.
   Mengubah status jadi 'dicabut' — JANGAN menghapus dokumennya, jejaknya harus
   tetap ada dan halaman verifikasi publik harus menyatakan TIDAK BERLAKU.

6. firestore.rules tidak perlu berubah — semua lewat Admin SDK.
   Kalau menurutmu ada yang kurang, LAPORKAN saja.

Jalankan npx tsc --noEmit dan npm run build sampai bersih. JANGAN commit.
```

**Cara memeriksa**: daftarkan tiga peserta uji, satu di antaranya belum lulus.
Buka halaman peserta → yang belum lulus ditandai tidak layak dan tidak bisa dicentang.
Terbitkan dua sisanya sekaligus → dua serial berurutan. Cabut salah satunya → buka
`/s/{kode}` di incognito → harus menyatakan **TIDAK BERLAKU**. Terakhir, isi
penandatangan di template, terbitkan sertifikat baru, lalu **ubah nama penandatangannya**
— sertifikat yang sudah terbit harus tetap menampilkan nama lama.

**Tahap 4 selesai 1 Sep 2026.** Tujuh sertifikat terbit dengan serial berurutan,
pencabutan bekerja, dan seluruh blok penandatangan — nama, jabatan, gambar tanda
tangan — terbukti beku per sertifikat.

**Dua koreksi yang lahir dari pengujian**, keduanya ditemukan pemilik project:

1. Gambar tanda tangan semula dibiarkan hidup dengan alasan "branding". Itu keliru —
   membekukan nama tapi membiarkan gambarnya berubah menghasilkan sertifikat yang
   mencantumkan satu orang dengan coretan orang lain. Seluruh blok penandatangan
   dibekukan bersama; hanya logo dan kop yang tetap hidup.
2. Label kelayakan menampilkan "Belum layak" merah pada kegiatan bersyarat manual,
   padahal artinya "sistem sengaja tidak menilai". Status jadi bertiga:
   `layak` | `belum_layak` | `ditentukan_admin`.

---

## J. Menjalankan gelombang nyata pertama

Alur webinar sudah bisa dijalankan **tanpa menunggu tahap 5 sampai 9**: kegiatan tanpa
modul evaluasi, syarat sertifikat `manual_admin`, peserta mendaftar dan mengisi namanya
sendiri, admin mencoret yang tidak hadir lalu menerbitkan sekali klik.

### Yang WAJIB dikerjakan sebelum go-live

**Tambahkan variabel Admin SDK ke Vercel.** Selama ini semuanya diuji di `localhost`,
di mana `.env.local` terbaca. Di Vercel ketiganya belum ada:

```
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

Tanpa ini, **seluruh Route Handler gagal di produksi** — pendaftaran, pengerjaan soal,
penilaian, dan penerbitan sertifikat. Situsnya tetap terbuka dan halaman biasa tetap
tampil, jadi kegagalannya tidak kentara sampai ada yang mencoba mendaftar.

Vercel → Settings → Environment Variables. Private key tetap dibungkus tanda kutip
dengan `\n` apa adanya, sama persis seperti di `.env.local`. Setelah ditambahkan,
**deploy ulang** — variabel baru tidak berlaku pada build lama.

### Daftar periksa gelombang pertama

1. Env Admin SDK di Vercel + deploy ulang (di atas)
2. Uji satu pendaftaran di domain Vercel, bukan localhost
3. Buat kegiatan sungguhan: kode, judul, deskripsi, jendela waktu
4. Syarat sertifikat `manual_admin` untuk webinar murni
5. Isi template: logo, kop, penandatangan (nama, jabatan, tautan tanda tangan)
6. Modul: kosongkan untuk webinar murni, atau satu modul evaluasi kalau ada kuis
7. Tentukan mode pendaftaran di `/admin/parameter` — terbuka atau undangan
8. Terbitkan kegiatan, sebarkan tautan `/kegiatan`
9. Setelah acara: `/admin/kegiatan/[id]/peserta` → coret yang tidak hadir →
   Terbitkan terpilih
10. Peserta mengunduh sendiri dari `/beranda`

### Yang belum ada, dan tidak menghalangi

Kode kehadiran otomatis, formulir tambahan, referensi video, atestasi CCL, ekspor rekap,
peran panitia, dan poles tampilan. Semuanya berguna; tidak satu pun menghalangi gelombang
pertama berjalan. Urutkan ulang tahap 5–9 berdasarkan keluhan yang benar-benar muncul,
bukan tebakan.

---

## K. Produksi Vercel — 401 terpecahkan (1 Sep 2026)

### Gejala
`/beranda` menampilkan kartu profil dengan benar, tetapi "Kegiatan saya" dan
"Sertifikat saya" gagal dengan `Token tidak sah atau kedaluwarsa.`
`GET /api/sertifikat/saya` dan `/api/pendaftaran/saya` → 401. Log Vercel: fungsi
berjalan 938 ms lalu 401, tanpa satu pun baris console (filter Error = 0).

### Cara mempersempit (dilakukan lewat browser pengguna)
ID token diambil dari IndexedDB `firebaseLocalStorageDb`, payload JWT dibaca, lalu
dikirim manual ke `/api/whoami`. Hasil: `aud = insighttest-66524`, belum kedaluwarsa,
header terkirim, server tetap 401. **Kesimpulan: separuh klien sehat; kegagalan murni
di Admin SDK sisi server.** Ini memangkas kandidat dari lima jadi dua.

### Penyebab sebenarnya
`FIREBASE_ADMIN_PRIVATE_KEY` disalin ke Vercel **beserta tanda kutip pembungkusnya**.

Di laptop, `.env.local` dibaca `@next/env` (berbasis dotenv), yang **melucuti tanda
kutip dan sudah mengubah `\n` jadi baris baru sungguhan** sebelum kode kita jalan —
sehingga `.replace(/\\n/g, "\n")` di `src/lib/firebase/admin.ts` hanyalah no-op di
localhost. Vercel tidak melakukan itu: nilainya disimpan huruf per huruf. Akibatnya PEM
diawali `"`, `cert()` gagal, error tertangkap dan muncul sebagai 401.

**Perbaikan:** hapus tanda kutip di awal dan akhir nilai di Vercel, lalu Redeploy tanpa
build cache. Nilai yang benar dimulai persis dengan `-----BEGIN` dan berakhir
`PRIVATE KEY-----`. Isi di antaranya boleh `\n` maupun baris baru sungguhan.

### Pelajaran yang bisa dipakai ulang
1. **Localhost sehat tidak membuktikan apa pun tentang Vercel.** Diagnostik yang
   dijalankan CLI di laptop mengukur mesin yang salah; ia membaca `.env.local`, bukan
   env Vercel. Diagnostik produksi harus berupa route yang benar-benar dideploy.
2. Cara tercepat memisahkan klien dari server: kirim token manual ke `/api/whoami` dari
   konsol browser dan periksa `aud` + `exp`-nya.
3. Route Handler yang menelan error jadi pesan generik menyembunyikan penyebab. Kalau
   404/401 misterius muncul lagi, `console.error` di blok catch adalah langkah pertama.

---

## L. Slice 5.0 — pagar URL gambar (1 Sep 2026)

Muncul dari insiden: tanda tangan pada sertifikat tidak tampil, console `404`. Tautannya
berasal dari gambar yang ditempel ke percakapan GitHub —
`private-user-images.githubusercontent.com/...?jwt=...` dengan `X-Amz-Expires=300`.
Tautan itu hidup **5 menit** dan terikat sesi login pengunggahnya. Terlihat "berhasil"
saat diuji karena diuji beberapa detik setelah disalin.

Bahayanya khusus di sini: blok penandatangan **dibekukan** ke dokumen sertifikat
(KA-6), jadi tautan fana merusak sertifikat selamanya, di halaman verifikasi publik.
Ini melahirkan **KA-8** di ARSITEKTUR §8.

Yang dibangun:
- `src/lib/validasi-url-gambar.ts` — `periksaUrlGambar()`, fungsi murni. Menolak: bukan
  `https://`, host `private-user-images.githubusercontent.com`, query mengandung
  `jwt`/`X-Amz-Signature`/`X-Amz-Expires`, `github.com` tanpa `/raw/`. Memperingatkan
  (tidak menolak) kalau path tidak berakhiran ekstensi gambar. String kosong = valid.
- Komponen `FieldUrlGambar` di `/admin/kegiatan/[id]`: pesan merah untuk penolakan,
  kuning untuk peringatan, pratinjau `<img>` dengan `onError` terpisah — supaya tautan
  mati ketahuan sebelum penerbitan, bukan sesudah. Submit diblokir kalau ada yang invalid.
- Pagar terakhir di `terbitkanSertifikatUntuk()`: `SertifikatRouteError(400, ...)` kalau
  `tandaTanganUrl` tidak lolos.

### Tempat menyimpan aset
Repo GitHub **publik** khusus aset (logo, kop, tanda tangan — semuanya memang tercetak
di sertifikat publik), diunggah lewat **Add file → Upload files**, bukan ditempel ke
komentar. Tautan diambil dari tombol **Raw**:
`https://raw.githubusercontent.com/{user}/{repo}/main/logo.png`.
Alternatif CDN: `https://cdn.jsdelivr.net/gh/{user}/{repo}@main/logo.png`.

### Utang teknis yang ditemukan sambil jalan
`npm run lint` melaporkan **11 error `react-hooks/set-state-in-effect` pra-ada di 10
berkas** (`use-kegiatan-list.ts`, `use-soal-list.ts`, `/profil/page.tsx`,
`/sertifikat/[id]/page.tsx`, dll). Lolos selama ini karena `npm run build` di proyek ini
tidak menjalankan eslint. Polanya "fetch saat mount lalu setState di dalam useEffect" —
berfungsi, bukan bug runtime.

**Keputusan: ditunda ke tahap 9**, digabung dengan poles lain. Sampai itu beres, kriteria
sebelum commit dibaca sebagai **"tidak ada error lint baru"**, bukan "lint bersih" —
kalau tidak, pagarnya jadi lampu merah permanen yang diabaikan. Tahap 9 menambah dua
pekerjaan: bereskan 11 error itu, lalu nyalakan eslint di `npm run build` supaya tidak
menumpuk lagi.

---

## M. Slice 5.0b & 5.0c — penerbitan ulang sertifikat (2 Sep 2026)

### 5.0b — bug: sertifikat yang dicabut tidak bisa diterbitkan ulang
Kotak centang di `/admin/kegiatan/[id]/peserta` dinonaktifkan untuk **setiap** peserta
yang punya dokumen sertifikat, tanpa membedakan `berlaku` dari `dicabut`. Padahal itulah
satu-satunya alasan orang mencabut: memperbaiki sesuatu lalu menerbitkan lagi. Sekali
salah cetak, peserta itu terkunci selamanya.

Aturan sekarang: centang aktif kalau belum punya sertifikat **atau** statusnya `dicabut`;
terkunci hanya kalau `berlaku`. Tombol per-baris berbunyi "Terbitkan ulang" untuk yang
dicabut.

Pada penerbitan ulang: `nomorUrut`, serial, dan `kodeVerifikasi` **dipertahankan** (orang
yang sama pada kegiatan yang sama tetap memegang serial yang sama; kode yang sudah
disebar tidak boleh berubah arti). Nama, judul, item+skor, seluruh blok penandatangan,
dan `diterbitkanPada` **diambil ulang** — itulah yang membuat penerbitan ulang
memperbaiki terbitan yang salah. Field `riwayat[]` mencatat tiap terbit/cabut.

Pencabutan tidak menyentuh `attempt` atau nilai — tidak perlu menguji ulang peserta.

### 5.0c — jebakan: `arrayUnion` di dalam `set()` non-merge

CLI melaporkan bahwa `FieldValue.arrayUnion` "tetap dievaluasi terhadap `riwayat` lama
walau field lain ditimpa penuh". **Klaim itu salah**, dan letaknya persis di fitur audit
yang baru dibangun.

Spesifikasi `Write` Firestore, properti `updateTransforms`:
> "The transforms to perform **after update**… equivalent to performing update and
> transform to the same document atomically and in order."

Transform berjalan **sesudah** update, terhadap dokumen hasilnya. `set()` tanpa merge
adalah penggantian penuh: SDK mengeluarkan sentinel `arrayUnion` dari payload, menulis
dokumen **tanpa** `riwayat` (menghapus yang lama), baru menjalankan arrayUnion terhadap
array kosong. Hasilnya `riwayat` terpangkas jadi satu entri **setiap** penerbitan ulang.

Pola yang sama dengan `FieldValue.increment` di dalam `set()` non-merge, yang terkenal
me-reset penghitung alih-alih menambah.

**Diverifikasi di emulator Firestore** (terbit → cabut → terbit ulang): entri lama hilang.
Setelah perbaikan: dua entri bertahan utuh dan berurutan.

**Perbaikan:** transaksi sudah membaca dokumen lama untuk memeriksa status; ambil
`riwayat` dari snapshot itu dan tulis `[...riwayatLama, entriBaru]` sebagai array biasa.
Di dalam transaksi tidak ada balapan yang perlu diselesaikan transform. Komentar
ditinggalkan di kode supaya tidak "dirapikan" balik.

`/api/sertifikat/cabut` **tidak** kena — memakai `update()`, yang punya field mask parsial
sehingga `riwayat` lama tidak terhapus. Di sana `arrayUnion` tetap benar.

### Aturan umum yang bisa dipakai ulang
> `arrayUnion` dan `increment` aman di `update()` dan `set(..., { merge: true })`.
> Di `set()` **non-merge** keduanya berangkat dari nol. Kalau sudah di dalam transaksi,
> baca nilai lama dan susun sendiri — lebih jelas dan tidak punya jebakan.

Riwayat pada tujuh sertifikat uji tidak lengkap akibat bug ini. Dibiarkan — data percobaan.

---

## N. Slice 5.1 — modul referensi (3 Sep 2026)

`kegiatan/{id}/modul/{mid}` kategori `referensi` mendapat `referensi: { tipe, sumber,
deskripsi }` dengan `tipe: 'youtube' | 'tautan' | 'teks'`. `src/lib/youtube.ts` —
`ekstrakYoutubeId()` menangani `youtu.be/{id}`, `watch?v={id}`, `/embed/{id}`; dipakai
di validasi simpan dan di render dari **sumber yang sama**, ID tidak pernah disimpan
terpisah. Render: `youtube-nocookie.com/embed/{id}` dalam wadah `aspect-video`;
`tautan` → tombol `target="_blank" rel="noopener noreferrer"`; `teks` → paragraf.

`evaluasiKelayakan()` sudah memfilter `kategori === 'evaluasi'` sebelum menghitung
`items`/`nilaiAkhir`, jadi modul referensi otomatis tidak pernah masuk sertifikat —
dikonfirmasi lewat pembacaan kode dan tabel peserta ("1/1 modul lulus" walau ada dua
modul referensi).

### Dua jam hilang karena satu kebingungan: data dibagi, kode tidak

Modul referensi dibuat lewat `localhost:3000`, lalu diuji sebagai peserta di
`insighttest-gamma.vercel.app`. Barisnya **muncul** (lengkap dengan label
"Referensi · Wajib") tetapi tanpa tautan "Lihat", sehingga terlihat seperti bug render.

Sebabnya: localhost dan Vercel memakai **Firestore yang sama** (`insighttest-66524`),
tetapi Vercel masih menjalankan build lama yang belum mengenal kategori referensi.
Data langsung tersedia di kedua sisi; kode tidak.

> **Aturan kerja:** fitur yang baru selesai di CLI dan belum di-push **hanya ada di
> localhost**. Kalau sesuatu "tidak muncul", periksa dulu alamat di address bar
> sebelum mencari bug. Data dibagi, kode tidak.

Dugaan susulan (konfigurasi referensi tidak tersimpan pada jalur *sunting* modul) diuji
terpisah — buat modul Evaluasi, sunting jadi Referensi, simpan — dan **tidak terbukti**:
jalur sunting menyimpan dengan benar.

### Tautan YouTube tidak berubah, ekornya yang berubah
Tombol Share YouTube menambahkan `?si=...`, kode pelacak berbagi yang berbeda **setiap
kali disalin**; kadang ikut `&t=` kalau disalin sambil menandai menit. ID videonya
permanen. Karena ekstraktor hanya mengambil ID, semua bentuk itu diterima — jadi tautan
yang "terlihat berubah" bukan tanda ada yang salah.

### Belum berlaku
Centang **"Wajib"** pada modul referensi belum berpengaruh apa pun — tidak ada yang
memeriksa apakah peserta membukanya. Itu pekerjaan slice 5.2 (`wajibBukaReferensi`).
Sampai itu ada, label "Wajib" pada referensi adalah niat, bukan aturan.

### Slice 5.1a — alamat verifikasi harus kanonik (3 Sep 2026)

Ditemukan saat memeriksa PDF sertifikat hasil uji: teks dan QR memuat
`http://localhost:3000/s/{kode}` — alamat diambil dari `window.location.origin`, yaitu
tempat sertifikat kebetulan dicetak.

Bahayanya bukan localhost, melainkan Vercel: tiap deployment preview punya URL sendiri
(`insighttest-a1b2c3.vercel.app`) yang mati begitu deployment dihapus. Satu sertifikat
yang kebetulan dicetak dari preview akan membawa QR mati selamanya — dan matinya baru
ketahuan saat orang luar memindainya untuk memeriksa keaslian. Ini kelas kesalahan yang
sama dengan KA-8, hanya obyeknya alamat, bukan gambar.

`src/lib/sertifikat-url.ts` — `urlVerifikasiSertifikat(kode, urlPublik)`, murni, dengan
urutan: `NEXT_PUBLIC_SITE_URL` → `urlPublik` (field baru di `parameter/global`, bisa
diubah superadmin tanpa deploy) → `null`. Kalau null, peringatan merah menggantikan QR;
tidak pernah mencetak alamat kosong diam-diam. Diperbaiki di dua halaman yang punya
cacat identik: `/sertifikat/cetak/[kodeVerifikasi]` dan `/sertifikat/[id]`.

Diverifikasi: dicetak dari localhost dengan env dikosongkan, yang tercetak tetap alamat
produksi (jatuh ke `urlPublik`); QR pada sertifikat produksi dipindai dengan ponsel dan
membuka halaman verifikasi yang benar.

**Catatan Vercel:** variabel `NEXT_PUBLIC_*` harus bertipe **Config**, bukan Secret —
Vercel memprotes "rahasia yang dipublikasikan", dan protes itu benar. Yang tanpa awalan
(`FIREBASE_ADMIN_*`) tetap Secret. Cukup dicentang Production; deployment preview yang
tidak punya env akan jatuh ke `urlPublik`, yang justru perilaku yang diinginkan.

### Slice 5.2 — syarat "harus dibuka" (3 Sep 2026)

`pendaftaran.referensiDibuka: string[]`; ditulis hanya lewat `POST /api/modul/dibuka`
(verifyRequest → pastikan terdaftar → pastikan modulId ada di `modulSnapshot` dengan
kategori `referensi` → `update()` + `arrayUnion`, aman karena update punya field mask —
lihat §M). Halaman modul memanggilnya **sekali**, hanya kalau modulId belum tercatat;
tidak menulis berulang (ARSITEKTUR §5).

`syaratSertifikat.wajibBukaReferensi: boolean`, default `false` (KA-4). Kalau `true`,
`evaluasiKelayakan()` menghasilkan `belum_layak` selama masih ada modul referensi
**wajib** di `modulSnapshot` yang belum dibuka. Yang opsional tidak dihitung. Sumbernya
`modulSnapshot` milik pendaftaran, bukan modul kegiatan hidup (KA-5) — menambah referensi
baru tidak membuat peserta lama mendadak belum layak.

### Pengujian pindah dari klik ke skrip

Tujuh langkah klik manual diganti dua alat, dijalankan lewat Claude CLI:

- **`scripts/uji-kelayakan.ts`** (`npm run uji`) — menguji `evaluasiKelayakan()` sebagai
  fungsi murni dengan `node:assert`, tanpa database dan tanpa browser. Tujuh kasus,
  termasuk: fitur baru tidak mengubah perilaku lama; referensi opsional tidak dihitung;
  urutan gerbang tidak tertukar (evaluasi belum lulus → alasan nilai, bukan alasan
  referensi); dan pendaftaran lama tanpa field `referensiDibuka`.
- **`scripts/seed-uji-referensi.ts <kegiatanId>`** — menulis tiga pendaftaran `[UJI]`
  dengan `referensiDibuka` kosong/satu/lengkap, semua berskor lulus, ID deterministik
  `{kegiatanId}_uji-slice52-*`, `nomorUrut` sentinel 900001+ supaya tidak menaikkan
  penghitung kegiatan. `--bersihkan` menghapus tepat tiga dokumen itu. Satu kali buka
  halaman peserta memperlihatkan tiga status berjajar — tidak perlu mendaftar dan
  mengerjakan soal secara manual.

**Tes itu langsung menemukan cacat nyata:** `evaluasiKelayakan()` memanggil
`referensiDibuka.includes(...)` tanpa pagar, sehingga akan melempar `TypeError` pada
pendaftaran yang dibuat sebelum field ini ada. Ketiga pemanggil kebetulan sudah
memagari — tapi pagar di tiga tempat terpisah adalah pagar yang pemanggil keempat akan
lupa pasang. Fungsi intinya dibuat defensif.

> **Pelajaran:** logika keputusan yang ditulis sebagai fungsi murni bisa diuji tujuh
> kasus dalam sekejap, berulang kali, tanpa browser. Sisakan mata untuk hal yang memang
> hanya bisa dilihat — tampilan, dan lalu lintas jaringan.

### Slice 5.2 & 5.2a — syarat "harus dibuka" (3 Sep 2026) — TAHAP 5 SELESAI

`pendaftaran.referensiDibuka: string[]`; `POST /api/modul/dibuka` (verifyRequest →
peserta terdaftar → modulId ada di `modulSnapshot` berkategori `referensi` → `update()`
+ `arrayUnion`, aman karena update punya field mask). `SyaratSertifikat.wajibBukaReferensi`
default `false` (KA-4). Gerbang dipasang **setelah** cek lulus-evaluasi, sehingga alasan
yang muncul selalu yang paling relevan. Modul referensi **opsional** tidak dihitung.

Commit `ecda82b`, 17 berkas.

#### Pergeseran cara menguji: fungsi murni dulu, mata belakangan

Menguji gerbang ini lewat klik berarti tujuh langkah: daftar, kerjakan soal sampai lulus,
buka satu referensi, tahan diri tidak membuka yang kedua, periksa, buka, periksa lagi.
Melelahkan sehingga cenderung dilewati saat aturannya berubah nanti.

`scripts/uji-kelayakan.ts` (`npm run uji`) menguji `evaluasiKelayakan()` sebagai fungsi
murni — tujuh kasus, tanpa database, tanpa browser, sekejap:
non-aktif → layak; 2 belum dibuka → belum_layak menyebut 2; 1 → menyebut 1; lengkap →
layak; semua opsional → layak; `referensiDibuka` **undefined** → tidak melempar;
referensi lengkap tapi evaluasi belum lulus → alasan nilai, bukan alasan referensi.

**Tes ini langsung membayar dirinya:** kasus keenam menemukan `evaluasiKelayakan()` akan
melempar `TypeError` pada pendaftaran lama tanpa field `referensiDibuka`. Ketiga
pemanggil kebetulan sudah memagari — tapi pagar di tiga tempat terpisah adalah pagar yang
pemanggil keempat pasti lupa. Fungsi intinya kini defensif sendiri.

`scripts/seed-uji-referensi.ts <kegiatanId> [--bersihkan]` membuat tiga pendaftaran dummy
(referensi kosong/satu/lengkap, semua skor lulus) untuk melihat tiga status berjajar dalam
satu kali buka halaman. ID deterministik, `nomorUrut` sentinel 900001+ supaya tidak
memakan nomor urut sungguhan, `--bersihkan` menghapus tepat tiga dokumen itu.

> **Pembagian kerja pengujian.** Fungsi murni menguji **aturannya** (semua keadaan, murah,
> berulang). Manual menguji **jalurnya** (route handler, snapshot, rules) — seed menulis
> langsung dengan Admin SDK sehingga tidak pernah menyentuh `POST /api/pendaftaran`, jadi
> ia tidak bisa membuktikan alur itu utuh. Pakai keduanya untuk pertanyaan yang berbeda.

Pola ini dipakai lagi di tahap berikutnya: aturan kelayakan, perhitungan skor, dan ambang
atestasi CCL semuanya fungsi murni, digabung lewat `npm run uji`.

#### Dua kata "wajib" yang membingungkan (slice 5.2a)

Ada dua centang berbeda dengan kata yang sama: **"Modul wajib"** pada tiap modul, dan
**"wajibkan referensi dibuka"** pada syarat kegiatan. Yang pertama tanpa yang kedua tidak
berpengaruh apa-apa — dan itu memakan waktu saat pengujian, karena tiga baris uji tampil
"Layak" semua dan terlihat seperti gerbangnya rusak.

Diperbaiki: "Modul ini wajib" + keterangan; "Peserta harus membuka semua materi referensi
yang wajib" + hitungan hidup *"kegiatan ini punya N modul referensi wajib dan M opsional"*,
dan peringatan kuning kalau N = 0 bahwa centang itu belum berpengaruh.

> **Pelajaran:** kalau perancangnya sendiri bingung membedakan dua kontrol, pemakai
> berikutnya pasti lebih bingung. Memperjelas label lebih murah daripada menjelaskannya
> berulang kali.

---

## O. Tahap 7 — Atestasi CCL (3–4 Sep 2026) — SELESAI

Enam slice: 7.1 pendaftaran modul + gerbang verifikasi, 7.1a pembeda pesan berbasis
bentuk, 7.2 pemutaran + perekaman, 7.2a kewajaran berbasis pertambahan + tata letak,
7.3 pernyataan + kelayakan, 7.4 pemisahan kelayakan/prasyarat + alat diagnosa,
7.5 normalisasi ambang, 7.6 kejujuran pelaporan. `npm run uji`: 34 kasus.

### Yang dibangun
Kategori modul `atestasi` menyematkan game CCL lewat iframe dan mengonsumsi telemetri
`postMessage` yang sudah ada — **nol modifikasi CCL**. Gerbang pendaftaran memuat URL di
iframe tersembunyi, menunggu `CCL_READY` (10 detik), lalu `duration_sec` (5 detik lagi,
opsional). `gameId`/`gameName`/`versi`/`originDiizinkan` diisi game itu sendiri, tidak
pernah diketik admin.

### Jebakan kuota — bagian tersulit, dan berhasil
Video 1546 detik mengirim ~1 laporan/detik. Menulis tiap laporan = **1500 tulis per
peserta**; 13 peserta menghabiskan kuota gratis harian. Rancangannya menulis **2–3 kali**:
sekali saat modul dibuka, sekali saat ambang tercapai (menyelamatkan hasil kalau tab
ditutup mendadak), sekali saat ditutup. Laporan disimpan di `useRef`, bukan state.
**Terukur di produksi: 3 panggilan dalam sesi 25 menit.**

### `detikTersaksikan` — portal hanya mengakui yang ia saksikan
Satu konsep menyatukan video dan game: detik yang portal saksikan sebagai keterlibatan
nyata. Video → bertambah saat `watch_credit_sec` bertambah. Game → bertambah saat
`score`/`wave`/`hp` berubah. Laporan identik tidak menambah apa pun. Dihitung klien,
**dibatasi jam server** — tidak boleh bertambah lebih cepat dari waktu nyata.

Versi pertama membandingkan **angka mutlak** dan menolak dengan 400. Itu menolak peserta
jujur yang menonton sampai 95%, karena CCL menyimpan kredit tontonnya sendiri sehingga
sesi baru dimulai dengan angka tinggi.

> **Pagar yang menolak orang jujur lebih berbahaya daripada tidak ada pagar**, karena
> kegagalannya senyap. Jangan pernah menolak data dengan alasan kewajaran — simpan
> laporannya, akui hanya bagian yang tersaksikan, tandai yang dipangkas.

### Kelayakan ≠ pembukaan kunci (7.4)
Dirumuskan oleh pemilik produk: *"sertifikatnya sudah ada kalau dia lulus, tapi untuk
membukanya, lapisan CCL yang harus dituntaskan."* `evaluasiKelayakan()` kini
mengembalikan `{ kelayakan, prasyaratMateri }` terpisah. Mode otomatis: prasyarat
**menghalangi** (digerbang di server, bukan cuma menyembunyikan tombol). Mode manual
admin: prasyarat **menginformasikan**, admin tetap bebas.

### Dua cacat yang lahir dari asumsi
**7.5 — syarat yang mustahil.** Migrasi 7.3 memetakan `ambangKreditPersen` lama ke mode
persen tanpa memeriksa apakah durasi ada. Game tanpa durasi jadi "55% dari durasi yang
tidak diketahui" — mustahil dipenuhi, tanpa pesan apa pun. Form admin bahkan sudah
menjanjikan ambang itu diabaikan; janjinya tidak pernah diterapkan.

> **Sistem tidak boleh pernah menyimpan syarat yang mustahil dipenuhi.** Ambang yang
> tidak bisa dievaluasi diabaikan, bukan dianggap gagal selamanya.

**7.6 — mengklaim tuntas padahal tidak.** Ketika gerbang atestasi dimatikan, laporan
berbunyi *"Semua materi wajib sudah tuntas"* walau ada modul wajib yang `belum`. Bukan
salah hitung, **salah bicara** — dan kalimat itulah yang dibaca admin untuk memutuskan.
Sekarang tiga keadaan: tuntas / belum tuntas (menghalangi) / belum tuntas (gerbang tidak
aktif, tidak menghalangi).

### Titik balik: berhenti menguji lewat klik
Pengujian kelayakan gagal berulang kali karena empat keadaan tersembunyi sekaligus:
`modulSnapshot` beku, sertifikat yang sudah terlanjur terbit, keadaan centang di luar
layar, dan halaman yang menampilkan data lama. Empat putaran habis untuk menebak.

`scripts/periksa-kelayakan.ts <kegiatanId>` menjawab **"kenapa orang ini layak?"** dalam
satu perintah — baca-saja, menyebut isi snapshot tiap peserta beserta peringatan kalau
ada field yang hilang, hasil atestasi per modul, dan kesimpulan beserta alasannya. Ia
langsung menemukan cacat 7.5 pada percobaan pertama.

> **Kalau sebuah pertanyaan butuh tujuh klik untuk dijawab dan tetap salah, yang perlu
> dibangun adalah alat yang menjawabnya — bukan instruksi klik yang lebih teliti.**

### Bukti alur utuh
Peserta `kadal itokimo`: lulus evaluasi 100; `ccl game bermain` 62 detik/skor 3930 →
*memahami*; `ccl vidio testing` 322 detik/skor 205 → *memahami*; **BISA TERBIT**.
Peserta lain dengan nilai 100 tapi atestasi belum tuntas: **BELUM BISA TERBIT**.

### Warisan untuk tahap berikutnya
Aturan operasional dipindahkan ke dokumen tersendiri: `ATURAN-MAIN-kelayakan-sertifikat.md`
— tiga kategori modul, apa yang dibekukan kapan, tiga kontrol prasyarat yang mudah
tertukar, dan tabel "terlihat seperti bug padahal bukan".

---

## P. Tahap 8 — Peran bertingkat, rekap, ekspor (6–8 Sep 2026) — SELESAI

Enam slice: 8.1 peran panitia + saklar izin, 8.1a daftar izin menggantikan daftar
larangan, 8.1b panitia boleh membaca bank soal, 8.2 kepemilikan soal, 8.3 rekap + ekspor
CSV, 8.3a sel kosong yang ambigu. `npm run uji`: 100 kasus, 7 skrip.

Menyelesaikan tujuan yang ditulis di deskripsi project sejak awal dan belum pernah
tersentuh: *"administrator bertingkat agar platform bisa ditangani bersama yang ditunjuk."*

### Rancangan
Panitia **ditunjuk per kegiatan** (`kegiatan.panitiaUids` + `kegiatan.panitiaIzin`),
dengan dua saklar per penugasan: terbitkan sertifikat, sunting kegiatan & modul.
`izinPanitia(profil, kegiatan)` adalah satu-satunya sumber kebenaran, dipakai identik di
server dan klien.

### Enam pelajaran yang berlaku di luar proyek ini

**1. Lingkup izin harus cocok dengan lingkup dampaknya.**
Saklar ketiga semula ikut di penugasan per-kegiatan: "boleh buat soal". Tapi bank soal
**global** (KA-6) — soal buatan panitia masuk ke bank yang dipakai semua kegiatan. Izin
berlingkup sempit dengan dampak luas adalah kebohongan, dan aturan Firestore tidak bisa
menegakkannya (ia hanya bisa membaca satu dokumen, tidak bisa menelusuri semua kegiatan
tempat seseorang jadi panitia). Dipindahkan jadi `users/{uid}.bolehBuatSoal` — global,
karena dampaknya memang global.

**2. Daftar larangan gagal terbuka; daftar izin gagal tertutup.**
Aturan pertama: panitia boleh menulis semua field kegiatan **kecuali** `panitiaUids` dan
`panitiaIzin`. Itu berarti ia juga boleh menulis `nomorUrutTerakhir` — penghitung nomor
serial sertifikat; memundurkannya menghasilkan dua sertifikat bernomor sama, permanen,
tanpa ada yang menyadarinya. Juga `isPublished`, `isArchived`, `kode`.
Diganti `hasOnly([...])`: hanya field yang disebut yang boleh disentuh.
**Dibuktikan gagal-tertutup** dengan menulis field fiktif `fieldMasaDepanYangBelumDipikirkan`
— ditolak tanpa menyentuh rule sama sekali.

**3. `get()` di rules tidak melihat dokumen yang ditulis dalam batch yang sama.**
Ditemukan CLI lewat emulator, bukan lewat kegagalan produksi. `soal` dan `kunci_soal`
selalu ditulis berpasangan dalam satu `writeBatch`, jadi aturan
"`kunci_soal` boleh dibaca kalau `get(soal/{id}).dibuatOleh == uid`" **selalu gagal**.
Perbaikannya: `dibuatOleh` disalin ke dokumen `kunci_soal` sendiri oleh fungsi tulis yang
sama, sehingga tidak ada `get()` lintas dokumen sama sekali.

**4. Cara membuktikan KA-1, bukan sekadar mengklaimnya.**
CLI membuat salinan rules yang **sengaja dirusak** (`.data.panitiaUids` tanpa default) dan
menjalankannya berdampingan di emulator. Versi rusak: `Property panitiaUids is undefined
on object`. Versi asli: penolakan `false` yang bersih. Perbedaan terukur, bukan pembacaan
kode yang optimistis.

Nuansa yang ikut ditemukan: karena `allow read` memakai `A || B || C` dengan hubung-singkat,
kegiatan **terbit** tidak pernah menyentuh cabang panitia. Untuk menguji cabang itu,
kasus ujinya harus memakai kegiatan **draf** — kalau tidak, ujiannya lulus tanpa pernah
menjalankan kode yang diuji.

**5. Aturan Firestore punya jalur pemasangan sendiri.**
Push ke `main` men-deploy kode lewat Vercel; `firestore.rules` tetap berkas teks sampai
`firebase deploy --only firestore:rules` dijalankan. Dan karena rules hidup di server
Google, **localhost pun memakai rules produksi** — mengubah berkasnya di komputer tidak
berpengaruh apa pun sampai dipasang. Gejalanya: panitia ditolak dengan "Missing or
insufficient permissions" meski kodenya benar.

> Varian dari pelajaran tahap 5: **data dibagi, kode tidak** — dan **aturan dibagi, dengan
> jalur pemasangannya sendiri.**

**6. Jangan menebak lokal pengguna.**
Ekspor CSV memakai titik koma sebagai bawaan, dengan alasan Excel Indonesia
mengharapkannya. Excel pengguna ternyata berlokal Inggris; seluruh baris menumpuk di satu
kolom. Diganti **dua tombol berlabel jelas** — koma dan titik koma — plus keterangan
"kalau menumpuk, coba yang satunya". Dua pilihan yang terlihat lebih baik daripada satu
tebakan yang benar sebagian waktu.

### Sel kosong yang berbohong (8.3a)
Kolom CSV disusun dari modul kegiatan **saat ini**; nilai peserta dari `modulSnapshot`
yang **beku** (KA-5). Sel kosong jadi punya dua arti yang tak terbedakan: modul ada di
pendaftarannya tapi belum dikerjakan (dihitung nol, menurunkan nilai akhir), atau modul
belum ada saat ia mendaftar (tidak dihitung).

Terlihat dari data nyata: peserta dengan dua modul bernilai 100 dan dua sel kosong punya
nilai akhir **67** — 100+100+0 dibagi tiga. Sekarang: kosong = belum dikerjakan,
`-` = tidak ada di pendaftarannya.

> Kelas yang sama dengan cacat 7.6: bukan angkanya yang salah, **kalimatnya yang
> menyembunyikan kenyataan** — dan kalimat itulah yang dibaca orang untuk memutuskan.

### Standar verifikasi baru
Setiap slice yang menyentuh `firestore.rules` diverifikasi dengan **Firestore Emulator
sungguhan** (12, 20, 13, 11, dan 3 kasus fungsional di slice-slice ini), lalu diperiksa
sekali lagi di **Rules Playground** Firebase Console — karena emulator menguji berkas di
komputer, Playground menguji yang benar-benar terpasang.

---

## Q. Tahap 9 — Poles (8–9 Sep 2026)

### Slice 9.1 — jalur peserta di 390px
Sembilan halaman peserta ditinjau untuk layar 390px potret. Yang benar-benar diubah cuma
lima berkas — sisanya sudah aman karena dibangun dengan `max-w-*` sejak awal.

Yang berubah: baris modul di `/kegiatan/[id]` bertumpuk di layar sempit; baris jawaban
soal dinaikkan ke `min-h-11` dan dibungkus `<label>` supaya seluruh baris jadi target
sentuh 44px, bukan hanya lingkaran radionya; bilah "Kirim jawaban" diberi
`env(safe-area-inset-bottom)` dan jarak konten dinaikkan supaya soal terakhir tidak
tertutup; padding sertifikat dikecilkan di layar sempit sementara `@media print` dibiarkan
utuh.

### Slice 9.1a — portal memberi ruang, bukan memaksa bentuk
Pembungkus iframe CCL memakai `aspect-video max-h-[80vh] overflow-hidden`. Di lebar 390px
itu berarti tinggi iframe **~219px**, dan `overflow-hidden` memotong sisanya. Gamenya
sendiri responsif — dibuka langsung di platform aslinya ia tampil normal di potret maupun
mendatar.

> **Portal memberi ruang, bukan memaksa bentuk.** Konten pihak ketiga yang punya tata
> letaknya sendiri tidak boleh dijejalkan ke rasio tetap. Beri kotak yang jujur, biarkan
> ia menyusun dirinya.

Perbaikannya: potret memakai `h-[min(78svh,700px)]` tanpa `overflow-hidden`; mendatar
kembali ke `aspect-video` yang memang sudah benar di orientasi itu. **Murni media query
CSS** (`landscape:`), bukan listener `orientationchange` — kalau React me-render ulang saat
HP diputar, iframe ter-remount dan kredit tonton CCL hilang di tengah peserta bermain.

Ikut diperbaiki: atribut `allow`/`allowFullScreen` pada kedua iframe; `playsinline=1` pada
URL embed YouTube **di titik render saja**, tidak ditulis ke Firestore; dan cadangan layar
penuh untuk Safari iOS, yang tidak mendukung Fullscreen API pada elemen selain `<video>` —
`requestFullscreen()` dicoba dulu, gagal jatuh ke `fixed inset-0 z-50`.

### Empat jam hilang karena menguji kode yang tidak pernah sampai

Setelah 9.1a, pengujian dari HP melaporkan gejala baru dan menakutkan: **sentuhan tidak
menembus iframe**. Tiga iframe yang tidak berhubungan — game CCL, pemutar video CCL, embed
YouTube — gagal identik. Bekerja dengan mouse di PC, bekerja saat layar penuh, bekerja saat
situs CCL dibuka langsung.

Dugaan saya: sentuhan ditelan sebagai gerak-isyarat menggulung, obatnya `touch-action`.
**Dugaan itu salah.** Dibuktikan salah oleh `public/uji-sentuh-iframe.html` — halaman statis
yang menyematkan URL apa pun lalu menukar kelas pembungkus di antara lima varian **tanpa
memuat ulang iframe**, sambil mencatat apakah ketukan mendarat di halaman induk atau
menembus ke dalam. Hasilnya: sentuhan tembus di **semua** varian, termasuk iframe polos
tanpa CSS sama sekali.

Penyebab sebenarnya jauh lebih memalukan. Selama ini push hanya ke **branch**, dan branch
tidak mengubah alamat produksi. HP menguji `insighttest-gamma.vercel.app` — yaitu kode
**lama**, masih dengan kotak 219px. Kendali game memang berada di luar area yang terlihat.
Begitu `poles-tampilan` di-merge ke `main`, ketiga media langsung berfungsi tanpa satu baris
perbaikan tambahan.

> **Sebelum mendiagnosis gejala, pastikan dulu kode yang diuji adalah kode yang ditulis.**
> Ini pengulangan pelajaran tahap 5 ("saya menguji di Vercel padahal kodenya baru ada di
> lokal"), dalam bentuk terbalik: kali ini kodenya ada di GitHub, tapi di branch yang tidak
> pernah dipasang. Dua deploy path yang berbeda (§7 ATURAN-MAIN) punya anak ketiga:
> **branch bukan produksi.**

Yang tetap dipertahankan meski dugaannya salah: `touch-action: none` **tidak** dipasang.
Sentuhan sudah tembus tanpanya, dan pagar untuk masalah yang tidak ada punya harga —
peserta jadi tidak bisa menggulung halaman dengan menggeser jari di atas iframe. Kunci
gulung halaman hanya berlaku di dalam mode layar penuh, tidak pernah di tampilan biasa.

### Slice 9.2 & 9.2a — area admin di layar sempit
Sidebar admin jadi menu geser di bawah `sm:` dengan tiga jalur keluar (tombol ✕, tap di
luar, hamburger). Delapan halaman bertabel diubah jadi **daftar kartu berlabel** di layar
sempit — bukan tabel mini, bukan scroll mendatar, karena tabel yang digeser-geser di HP
tidak terbaca. Tabel 11 kolom di rekap peserta adalah yang tersulit dan jadi ukuran
keberhasilannya.

Ditemukan sambil jalan: baris `<input type="date">` + jam + tombol "Kosongkan" dalam satu
flex row menolak mengecil di bawah lebar intrinsiknya. `min-w-0` saja tidak cukup — tiga
elemen itu memang tidak muat di 390px, jadi barisnya harus **bertumpuk**. Akibatnya tombol
"Kosongkan" terpotong di tepi kanan dan tidak bisa dijangkau, karena halaman (dengan benar)
tidak bisa digeser mendatar.

### Slice 9.3 — landing pengunjung
`/` tidak lagi melempar pengunjung ke `/masuk`. Isinya: apa platform ini, tiga hal yang
bisa dilakukannya, tombol masuk/daftar — dan **kotak verifikasi sertifikat di posisi
menonjol**, karena `/s/{kode}` adalah satu-satunya fungsi platform yang berguna bagi orang
yang tidak punya akun sama sekali: perusahaan yang menerima sertifikat peserta dan ingin
memastikan keasliannya. Kotak itu hanya menyusun URL lalu menavigasi — nol bacaan
Firestore.

Tombol debug "Uji koneksi server" dihapus dari `/beranda`. `/api/whoami` **dipertahankan**
meski tak dipanggil dari UI mana pun — endpoint itu yang membuka kunci bug 401 produksi,
dan alat diagnosis memang seharusnya dipanggil saat dibutuhkan, bukan dipajang di halaman
peserta.

Dua koreksi dari CLI yang benar: proyek ini di **Next 16**, bukan 15 — dan Next 16 menghapus
total integrasi ESLint bawaan, jadi `eslint.ignoreDuringBuilds` tidak punya efek apa pun.
Pagar lint yang sesungguhnya sudah terpasang di `package.json`:
`"build": "npm run lint && next build"`. Utang lint tahap 9 ternyata sudah lunas dua kali.

### Slice 9.3a — halaman verifikasi yang berbohong

Kode sertifikat yang benar tapi diketik **huruf kecil** menghasilkan "Sertifikat tidak
ditemukan". Pencocokan peka huruf besar-kecil di dua titik: `/s/[kode]` dan route cetak.

> Ini bukan cacat tampilan. Halaman verifikasi adalah janji tentang keaslian. HRD yang
> mengetik kode apa adanya lalu dibilang tidak ditemukan tidak menyimpulkan "saya salah
> ketik" — ia menyimpulkan **"sertifikat ini palsu"**.

Kelas yang sama dengan cacat 7.6 dan sel CSV kosong: bukan datanya yang salah, kalimatnya
yang menyembunyikan kenyataan. Diperbaiki dengan fungsi murni `normalisasiKodeVerifikasi()`
— trim, buang tanda hubung, huruf besar — dipasang di **titik pencocokan**, bukan di titik
input, supaya berlaku sama bagi yang mengetik langsung di bilah alamat atau menyalin dari
QR. Data yang sudah beku tidak disentuh (KA-6). Delapan kasus uji baru.

### Slice 9.3b — admin buta terhadap kodenya sendiri

Ditemukan lewat pertanyaan pengguna, bukan lewat pengujian: selama menguji, kode sertifikat
hanya bisa didapat dengan **masuk sebagai peserta pemiliknya**. `kodeVerifikasi` dibaca dari
Firestore di kedua Route Handler admin lalu **dibuang** sebelum masuk ke respons.

Akibatnya tiga hal mustahil dilakukan admin: mengirim ulang sertifikat yang hilang,
menjawab telepon "apakah sertifikat atas nama X asli", dan menyusun laporan gelombang.

Kode verifikasi **bukan rahasia** — ia tercetak di sertifikat dan tertanam di QR-nya. Yang
memang tidak pernah dikembalikan adalah `nomorUrut` **ke peserta saat mendaftar**, supaya ia
tidak tahu ia orang ke berapa. Admin melihatnya wajar. Aturan itu tentang penerima, bukan
tentang siapa saja.

Sekarang kode muncul di rekap peserta sebagai tautan ke `/s/{kode}`, dan sebagai kolom baru
di kedua ekspor CSV. Sertifikat yang dicabut **tetap menampilkan kodenya**, dengan penanda
merah "(dicabut — tidak berlaku)" di sebelahnya — bukan hanya mengandalkan baris status di
atasnya.

### Tahap 9 selesai — 9 Sep 2026

Delapan dari sembilan tahap peta awal tuntas. `npm run uji` kini 105 kasus di 8 skrip.
Tersisa tahap 6.

> **Pelajaran tahap 9 yang paling mahal**, dan berlaku di luar proyek ini:
> *sebelum mendiagnosis gejala, pastikan kode yang diuji adalah kode yang ditulis.*
> Dua hari dihabiskan memburu masalah sentuh yang tidak pernah ada.

### Rencana tahap 10 — keamanan akun (setelah tahap 6)

Dicatat 9 Sep 2026 atas usulan pengguna. **Belum dikerjakan.**

1. **Lupa password.** Bukan fitur keamanan — kebutuhan operasional. Tanpa itu setiap
   peserta yang lupa password jadi pekerjaan manual di Firebase Console.
   `sendPasswordResetEmail` sudah tersedia; kerjanya satu halaman `/lupa-password`, satu
   tautan di `/masuk`, dan template email berbahasa Indonesia di Console.

2. **Verifikasi email sebagai parameter** (`wajibVerifikasiEmail`, bawaan mati).
   Pertanyaannya bukan "apakah diverifikasi" tapi **apa yang diblokir kalau belum**.
   Rekomendasi: blokir **pendaftaran ke kegiatan**, bukan login — identitas baru penting
   saat ia dibekukan ke `pendaftaran` dan nanti ke sertifikat. Penegakannya nyata, bukan
   di klien: `pendaftaran` hanya ditulis Admin SDK, dan token membawa `email_verified`.
   Akun Google datang dengan `emailVerified: true`, jadi otomatis lolos.

3. Tiga setelan Firebase Console yang gratis: perlindungan enumerasi email, kebijakan
   password, dan App Check nanti kalau pendaftaran dibuka umum.

> Catatan yang menghemat pekerjaan: untuk gelombang sertifikasi tertutup, **mode
> pendaftaran "undangan" sudah menyelesaikan penyamaran identitas sepenuhnya** — hanya
> email yang didaftarkan lebih dulu yang boleh masuk. Verifikasi email baru benar-benar
> dibutuhkan kalau pendaftaran dibuka bebas untuk umum.

### Slice 6.0 — setel ulang password (9 Sep 2026)

Dikerjakan lebih dulu daripada rencananya di tahap 10, karena keputusan tahap 6 mengubah
urutannya: impor daftar hadir akan **membuatkan akun** untuk peserta yang hadir tapi belum
punya akun, dan akun itu lahir tanpa password. Alur setel ulang adalah satu-satunya pintu
masuk mereka.

Halaman `/lupa-password` memakai `sendPasswordResetEmail` dari client SDK. Halaman "password
baru" sengaja **tidak** dibuat sendiri — Firebase sudah menyediakan halaman aksinya, dan
menggantinya berarti menangani `oobCode` sendiri: permukaan keamanan tambahan tanpa manfaat.

> **Pesan yang sama untuk email terdaftar maupun tidak.** Halaman yang menjawab "email tidak
> terdaftar" adalah alat rapi bagi siapa pun untuk memeriksa satu per satu apakah seseorang
> jadi peserta di sini. `auth/user-not-found` ditangkap dan diperlakukan seperti sukses;
> error lain (jaringan, terlalu banyak percobaan, format salah) tetap ditampilkan apa adanya
> — jangan menelan semua error jadi pesan sukses palsu.

Diuji sampai tuntas: email datang, tautan bekerja, password baru dipakai untuk masuk, dan
email yang belum terdaftar menghasilkan kalimat yang persis sama.

**Keterbatasan Firebase Console, bukan utang teknis:** project ini menolak penyuntingan
template email — *"Email template updates are currently unavailable for this project."*
Isi email tetap berbahasa Inggris. Yang berhasil diubah dan yang paling penting:
**Sender name** dari `insighttest-66524` jadi `InsightTest`. Nama pengirim yang benar adalah
yang menentukan email terlihat sah atau seperti penipuan; bahasa isinya jauh kurang
berdampak. Kalau suatu saat benar-benar dibutuhkan, jalurnya adalah SMTP kustom — bukan
prioritas.

### Slice 6.1 & 6.1-bug — formulir peserta, dan uji rules yang lulus palsu

`formulirPeserta` ditambahkan sebagai pengaturan **per kegiatan**: `institusi`,
`nomorIdentitas`, `noTelepon`, masing-masing `'tidak' | 'opsional' | 'wajib'`.

Temuan yang menentukan bawaannya: ketiga field itu ternyata milik **profil akun**, bukan
pendaftaran — hanya `institusi` yang disalin ke dokumen pendaftaran, dan tidak ada validasi
wajib sama sekali kecuali `namaLengkap`. Karena itu bawaan untuk kegiatan lama harus
`'tidak'`, bukan `'opsional'`: bawaan `'opsional'` akan memunculkan blok baru di halaman
kegiatan lama, melanggar syarat "berperilaku persis seperti sekarang".

Penegakan ada di Route Handler, di dalam transaksi, sebelum pendaftaran dibuat — bukan di
klien. Dan **tidak surut ke belakang**: peserta yang sudah terdaftar tidak diminta melengkapi
apa pun dan tidak kehilangan kelayakan, sama seperti `modulSnapshot` yang beku (KA-5).

#### Panitia tiba-tiba tidak bisa menyimpan apa pun

Gejala: `Missing or insufficient permissions` untuk panitia, sementara admin lancar.
Dugaan pertama — `formulirPeserta` belum masuk `panitiaKegiatanKunciDiizinkan()` — **salah**;
kunci itu sudah ada dan rules sudah terpasang (log deploy menyebut
`already up to date, skipping upload`, yang membuktikan versi server identik dengan berkas
lokal).

Penyebab sebenarnya: `validasiKegiatan()` — dipanggil setiap `updateKegiatan()` — selalu
menjalankan `kodeSudahDipakai()`, sebuah **query koleksi** yang bentuknya tidak diizinkan
untuk non-admin.

> **Yang ditolak bukan tulisannya, melainkan bacaannya.** Aturan Firestore menolak *bentuk
> query*, bukan menyaring hasilnya — prinsip yang sudah tertulis sejak awal, tapi datang dari
> arah yang tidak diduga. Pesan "insufficient permissions" pada sebuah tombol Simpan tidak
> berarti tulisannya yang ditolak; bacaan apa pun di jalur yang sama bisa jadi pelakunya.

Perbaikan: `kodeSaatIni` dioper dari `Kegiatan` yang sudah dimuat pemanggil, dan
`kodeSudahDipakai()` dilewati kalau kode tidak berubah. Aman karena `kode` **tidak ada** di
daftar izin panitia — rules yang menegakkan, bukan sekadar field yang di-*disable* di layar.

#### Kenapa emulator meloloskannya kemarin

CLI menyusun payload `updateDoc()` sendiri, dan tidak pernah memanggil `kodeSudahDipakai()`.
Ujinya lulus karena ia menguji **yang kita asumsikan**, bukan **yang kode lakukan**.

> **Uji rules harus menempuh jalur operasi yang sama dengan aplikasi** — seluruh rangkaian
> baca dan tulisnya, bukan hanya tulisan terakhir yang kita karang. Payload buatan sendiri
> menguji rule; ia tidak menguji kode.
>
> Ini varian ketiga dari pelajaran yang sama sepanjang proyek ini: di tahap 9 kita menguji
> kode yang tidak pernah dipasang; di sini kita menguji jalur yang tidak pernah dijalankan.

### Rencana tahap 11 — ujian berbatas waktu (setelah tahap 6 & 10)

Dicatat 10 Sep 2026. **Belum dikerjakan.** Parameternya sudah ada — modul evaluasi punya
"Batas waktu (menit, opsional)" sejak tahap 3 — yang belum ada adalah **apa yang terjadi
saat waktu habis**.

**Tiga aturan yang menentukan rancangannya:**

1. **Jam milik server, bukan browser.** Tenggat = waktu mulai `attempt` (dicatat server)
   + batas waktu. Hitung mundur di layar hanya tampilan; ia tidak pernah memutuskan apa
   pun. Jam browser bisa diubah peserta dalam dua klik.

2. **Habis waktu berarti dikirim, bukan dikunci.** Mengunci tanpa mengirim menghukum
   peserta atas hal yang bukan pengetahuannya — baterai habis, sinyal putus, tab tertutup.
   Yang sudah dijawab harus tetap dinilai.

3. **Server menolak jawaban yang datang setelah tenggat** (plus kelonggaran ~60 detik untuk
   jaringan), dan menilai dari apa yang sudah tersimpan.

**Konsekuensi yang membuat ini bukan slice kecil:** aturan 2 dan 3 hanya berarti kalau
jawaban tersimpan **di server**, bukan hanya di browser. `pulihkanJawaban` sekarang
menyelamatkan jawaban dari *refresh*, bukan dari perangkat yang mati. Simpan-otomatis ke
server adalah tulisan Firestore berulang — dan kuota adalah batasan nyata proyek ini
(20.000 tulis/hari). Rancangan yang masuk akal: simpan ter-*debounce* saat jawaban berubah,
plus saat tab disembunyikan, bukan setiap beberapa detik. Untuk gelombang 30 orang itu
ratusan tulis, bukan puluhan ribu — sama seperti pelajaran kuota di tahap 7.

Karena menyentuh bentuk `attempt`, rules, dan kuota sekaligus, ini tahap tersendiri —
bukan tempelan pada tahap 6.

#### Tambahan rencana tahap 10 — pendaftaran tanpa kolom kata sandi (usul pengguna, 11 Sep 2026)

Muncul saat menguji impor daftar hadir. Usulnya: **parameter** yang, pada mode pendaftaran
terbuka, **menyembunyikan kolom kata sandi** di `/daftar`. Orang mendaftar dengan email dan
nama saja; setelah itu ia menekan tautan bertuliskan *"Buat kata sandi"* — yang secara teknis
adalah alur setel ulang (6.0) dengan kalimat berbeda.

Kenapa ini lebih dari sekadar kosmetik: **orang baru punya akun yang bisa dipakai setelah
membuktikan ia memiliki emailnya.** Itu verifikasi email yang dilipat ke dalam pendaftaran,
bukan ditempel sesudahnya — dan mekanismenya sudah ada dan sudah terbukti, sama persis
dengan yang dipakai jalur impor.

Harganya jujur: pendaftaran jadi dua langkah, dan surel yang mendarat di folder spam menjadi
titik gagal baru. Karena itu ia **parameter, bawaannya mati** — konsisten dengan prinsip
proyek ini.

Masuk akal digabung dengan `wajibVerifikasiEmail` di tahap 10 sebagai satu keluarga
pilihan tentang *kapan sebuah akun dianggap sah*:

| Pilihan | Yang dibuktikan sebelum akun berguna |
|---|---|
| Sekarang (bawaan) | Tidak ada — siapa pun bisa mendaftar dengan email siapa pun |
| Verifikasi email wajib | Kepemilikan email, sebelum mendaftar ke kegiatan |
| Pendaftaran tanpa kata sandi | Kepemilikan email, sebelum bisa masuk sama sekali |
| Masuk lewat Google | Kepemilikan email, dijamin Google, tanpa surel tambahan |

> Catatan pengguna yang benar: **masuk lewat Google adalah yang paling aman dari keempatnya**
> dan sudah tersedia sejak tahap 1 — tanpa kata sandi untuk dicuri, tanpa surel untuk
> tersesat.