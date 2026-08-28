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

Salin dari TNA: `src/lib/auth/session.ts`, `src/lib/auth/user-profile.ts`,
`src/types/user.ts`. Yang **wajib** dipertahankan (ARSITEKTUR.md KA-2):

- `createProfileForNewAccount()` adalah **satu-satunya** penulis `users/{uid}`
- Auth provider **hanya membaca** (`onSnapshot`), tidak pernah menulis
- Rollback akun Auth kalau pembuatan profil gagal

**Cara Anda memeriksa** — ini pengujian terpenting di seluruh tahap 1:
daftar akun baru **lewat browser sungguhan** (bukan skrip), lalu buka Firestore Console
dan pastikan `users/{uid}` ada **satu** dokumen dengan field lengkap. Ulangi dengan
Google Sign-In. Race condition ini lolos dari skrip Node — hanya muncul di browser asli.

### Slice 1.3 — Undangan & status akun

Hasil: admin mengendalikan siapa yang boleh mendaftar.

Salin `src/lib/services/user-invitation.ts`. Mode pendaftaran terbuka/tertutup, status
`pending/aktif/nonaktif`, pola create dua-jalur di rules.

**Cara memeriksa**: dengan mode tertutup, pendaftaran email yang tidak diundang harus
**ditolak** dan akun Auth-nya ter-rollback (tidak menyisakan akun yatim).

### Slice 1.4 — AdminShell & parameter

Hasil: kerangka admin dan pengaturan yang bisa diubah tanpa deploy ulang.

Salin `AdminShell`, kerangka `hasRole()/isAdmin()/isSuperAdmin()`, dan
`services/system-parameter.ts` (pola: dibaca sekali oleh pemanggil, dioper sebagai
argumen — jangan dibaca ulang di dalam fungsi).

**Cara memeriksa**: masuk sebagai peserta → halaman admin tertolak. Masuk sebagai
superadmin → sidebar admin muncul, parameter bisa diubah dan efeknya terasa tanpa deploy.

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

## F. Setelah tahap 1

Lanjut ke ARSITEKTUR.md §9 tahap 2 (topik + bank soal + impor AI). Bank soal yang terisi
membuat seluruh tahap berikutnya bisa dicoba dengan data sungguhan — itu sebabnya ia
didahulukan.