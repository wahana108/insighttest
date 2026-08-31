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