/**
 * Alat pengembangan SEKALI PAKAI — BUKAN bagian aplikasi, TIDAK dipanggil
 * lewat `npm run uji` (butuh Firestore + Auth Emulator hidup, beda dari
 * semua skrip lain di direktori ini yang murni fungsi tanpa Firestore).
 *
 * Slice "gambar-soal" — memverifikasi firestore.rules setelah 'urlGambar'
 * ditambahkan ke panitiaKegiatanKunciDiizinkan(). MEMANGGIL JALUR YANG SAMA
 * dengan aplikasi: bukan menulis Firestore mentah dari skrip ini, tapi
 * mengimpor dan memanggil updateKegiatan()/createSoal()/updateSoal() dari
 * src/lib/services/kegiatan.ts dan src/lib/services/soal.ts — persis fungsi
 * yang dipanggil /admin/kegiatan/[id] dan /admin/soal — lewat sesi Auth
 * Emulator sungguhan (bukan konteks rules-unit-testing sintetis).
 *
 * Jalankan (dua terminal):
 *   1) npx firebase emulators:start --only firestore,auth --project insighttest-66524
 *   2) FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *      npx tsx scripts/uji-rules-emulator-gambar.ts
 */
import "./_muat-env";

import assert from "node:assert/strict";
import { connectAuthEmulator, signInWithCustomToken, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, updateDoc } from "firebase/firestore";
import { getAdminAuth, getAdminDb } from "../src/lib/firebase/admin";
import { auth as clientAuth, db as clientDb } from "../src/lib/firebase/client";
import { createSoal, getKunciSoal, updateSoal } from "../src/lib/services/soal";
import { FORMULIR_PESERTA_DEFAULT } from "../src/lib/formulir-peserta";
import {
  DUKUNGAN_KEGIATAN_KOSONG,
  TEMPLATE_SERTIFIKAT_KOSONG,
  updateKegiatan,
} from "../src/lib/services/kegiatan";
import type { KegiatanWriteInput } from "../src/lib/services/kegiatan";
import type { SoalWriteInput } from "../src/lib/services/soal";

connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
connectAuthEmulator(clientAuth, "http://127.0.0.1:9099", { disableWarnings: true });

let lulus = 0;
let gagal = 0;

async function uji(nama: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    lulus += 1;
    console.log(`OK    ${nama}`);
  } catch (err) {
    gagal += 1;
    console.error(`GAGAL ${nama}`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function masukSebagai(uid: string): Promise<void> {
  const token = await getAdminAuth().createCustomToken(uid);
  await signInWithCustomToken(clientAuth, token);
}

async function main() {
  const adminDb = getAdminDb();
  const adminAuth = getAdminAuth();
  const now = new Date().toISOString();

  const UID_ADMIN = "uji-admin";
  const UID_PANITIA_BOLEH = "uji-panitia-boleh";
  const UID_PANITIA_TIDAK_BOLEH = "uji-panitia-tidak-boleh";

  // --- Bersihkan sisa run sebelumnya + siapkan akun Auth Emulator ---
  for (const uid of [UID_ADMIN, UID_PANITIA_BOLEH, UID_PANITIA_TIDAK_BOLEH]) {
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // belum ada, tidak apa-apa
    }
    await adminAuth.createUser({ uid, email: `${uid}@contoh.test` });
  }

  // --- Seed users/{uid} (Admin SDK, lewat rules) — profil peran ---
  await adminDb.doc(`users/${UID_ADMIN}`).set({
    role: "admin",
    status: "aktif",
    displayName: "Admin Uji",
    email: `${UID_ADMIN}@contoh.test`,
  });
  await adminDb.doc(`users/${UID_PANITIA_BOLEH}`).set({
    role: "panitia",
    status: "aktif",
    displayName: "Panitia Boleh",
    email: `${UID_PANITIA_BOLEH}@contoh.test`,
    bolehBuatSoal: true,
  });
  await adminDb.doc(`users/${UID_PANITIA_TIDAK_BOLEH}`).set({
    role: "panitia",
    status: "aktif",
    displayName: "Panitia Tidak Boleh",
    email: `${UID_PANITIA_TIDAK_BOLEH}@contoh.test`,
    bolehBuatSoal: false,
  });

  // --- Seed topik aktif (dibutuhkan validasiSoal() -> getTopikByKode()) ---
  const topikKode = "UJI-GAMBAR";
  await adminDb.doc(`topik/${topikKode}`).set({
    kode: topikKode,
    nama: "Topik Uji Gambar",
    isActive: true,
  });

  // --- Seed kegiatan dasar, panitiaBoleh punya suntingKegiatan, panitiaTidakBoleh tidak ---
  const kegiatanId = "uji-kegiatan-gambar";
  await adminDb.doc(`kegiatan/${kegiatanId}`).set({
    kode: "UJI-GAMBAR-2026",
    judul: "Kegiatan Uji Gambar",
    deskripsi: "",
    dibukaPada: null,
    ditutupPada: null,
    isPublished: true,
    isArchived: false,
    syaratSertifikat: {
      jenis: "manual_admin",
      nilaiMinimum: 0,
      wajibBukaReferensi: false,
      atestasiJadiSyarat: false,
      terbitkanKeikutsertaan: false,
      hanyaKeikutsertaan: false,
    },
    templateSertifikat: TEMPLATE_SERTIFIKAT_KOSONG,
    formulirPeserta: FORMULIR_PESERTA_DEFAULT,
    kuotaPeserta: 0,
    caraMasuk: "terbuka",
    urlGambar: "",
    penafsiranHasil: "",
    nomorUrutTerakhir: 0,
    panitiaUids: [UID_PANITIA_BOLEH, UID_PANITIA_TIDAK_BOLEH],
    panitiaIzin: {
      [UID_PANITIA_BOLEH]: { terbitkanSertifikat: false, suntingKegiatan: true },
      [UID_PANITIA_TIDAK_BOLEH]: { terbitkanSertifikat: false, suntingKegiatan: false },
    },
    createdAt: now,
    createdBy: UID_ADMIN,
    updatedAt: now,
    updatedBy: UID_ADMIN,
  });

  const kegiatanInputDasar: Omit<KegiatanWriteInput, "urlGambar"> = {
    kode: "UJI-GAMBAR-2026",
    judul: "Kegiatan Uji Gambar",
    deskripsi: "",
    dibukaPada: null,
    ditutupPada: null,
    syaratSertifikat: {
      jenis: "manual_admin",
      nilaiMinimum: 0,
      wajibBukaReferensi: false,
      atestasiJadiSyarat: false,
      terbitkanKeikutsertaan: false,
      hanyaKeikutsertaan: false,
    },
    templateSertifikat: TEMPLATE_SERTIFIKAT_KOSONG,
    formulirPeserta: FORMULIR_PESERTA_DEFAULT,
    kuotaPeserta: 0,
    caraMasuk: "terbuka",
    dukungan: DUKUNGAN_KEGIATAN_KOSONG,
    penafsiranHasil: "",
  };

  // === 1. Panitia DENGAN suntingKegiatan menyimpan urlGambar lewat
  //        updateKegiatan() — JALUR SAMA PERSIS dengan /admin/kegiatan/[id].
  //        Tanpa 'urlGambar' di panitiaKegiatanKunciDiizinkan(), ini akan
  //        ditolak permission-denied oleh hasOnly(). ===
  await uji(
    "updateKegiatan() sebagai panitia BERSUNTING — urlGambar TERSIMPAN (rules mengizinkan field baru)",
    async () => {
      await masukSebagai(UID_PANITIA_BOLEH);
      const input: KegiatanWriteInput = {
        ...kegiatanInputDasar,
        urlGambar: "https://raw.githubusercontent.com/user/aset/main/sampul.png",
      };
      await updateKegiatan(kegiatanId, input, UID_PANITIA_BOLEH, "UJI-GAMBAR-2026");

      const snap = await adminDb.doc(`kegiatan/${kegiatanId}`).get();
      assert.equal(
        snap.data()?.urlGambar,
        "https://raw.githubusercontent.com/user/aset/main/sampul.png"
      );
      await signOut(clientAuth);
    }
  );

  // === 2. Panitia TANPA suntingKegiatan mencoba jalur yang sama — HARUS
  //        DITOLAK (kontrol negatif: bukan urlGambar yang longgar,
  //        suntingKegiatan tetap ditegakkan). ===
  await uji(
    "updateKegiatan() sebagai panitia TANPA suntingKegiatan — DITOLAK permission-denied",
    async () => {
      await masukSebagai(UID_PANITIA_TIDAK_BOLEH);
      const input: KegiatanWriteInput = {
        ...kegiatanInputDasar,
        urlGambar: "https://raw.githubusercontent.com/user/aset/main/percobaan-ilegal.png",
      };
      await assert.rejects(
        () => updateKegiatan(kegiatanId, input, UID_PANITIA_TIDAK_BOLEH, "UJI-GAMBAR-2026"),
        /permission/i
      );
      await signOut(clientAuth);
    }
  );

  // === 3. Admin menyimpan urlGambar lewat jalur yang sama — harus lolos
  //        (admin selalu lewat cabang isAdmin(), tidak pernah lewat
  //        hasOnly()). ===
  await uji("updateKegiatan() sebagai admin — urlGambar TERSIMPAN", async () => {
    await masukSebagai(UID_ADMIN);
    const input: KegiatanWriteInput = {
      ...kegiatanInputDasar,
      urlGambar: "https://raw.githubusercontent.com/user/aset/main/sampul-admin.png",
    };
    await updateKegiatan(kegiatanId, input, UID_ADMIN, "UJI-GAMBAR-2026");
    const snap = await adminDb.doc(`kegiatan/${kegiatanId}`).get();
    assert.equal(
      snap.data()?.urlGambar,
      "https://raw.githubusercontent.com/user/aset/main/sampul-admin.png"
    );
    await signOut(clientAuth);
  });

  // === 4. Kontrol negatif tambahan: field yang TIDAK ADA di daftar izin
  //        (mis. isPublished) tetap ditolak untuk panitia — memastikan
  //        menambah 'urlGambar' tidak diam-diam melonggarkan field lain. ===
  await uji(
    "updateDoc() langsung field TIDAK diizinkan (isPublished) sebagai panitia bersunting — TETAP DITOLAK",
    async () => {
      await masukSebagai(UID_PANITIA_BOLEH);
      await assert.rejects(
        () => updateDoc(doc(clientDb, "kegiatan", kegiatanId), { isPublished: false }),
        /permission/i
      );
      await signOut(clientAuth);
    }
  );

  // === 5. soal/{id}: panitia dengan bolehBuatSoal membuat soal ber-urlGambar
  //        (soal + opsi) lewat createSoal() — JALUR SAMA dengan /admin/soal.
  //        soal/{id} TIDAK memakai hasOnly() (sudah diperiksa di kode), jadi
  //        seharusnya lolos TANPA perubahan rules apa pun. ===
  let soalId = "";
  await uji(
    "createSoal() sebagai panitia bolehBuatSoal — urlGambar (soal + opsi) TERSIMPAN tanpa perubahan rules",
    async () => {
      await masukSebagai(UID_PANITIA_BOLEH);
      const input: SoalWriteInput = {
        teks: "Soal uji gambar",
        topikKode,
        tingkat: "sedang",
        urlGambar: "https://raw.githubusercontent.com/user/aset/main/soal.png",
        opsi: [
          { id: "a", label: "Opsi A", urlGambar: "https://raw.githubusercontent.com/user/aset/main/opsi-a.png" },
          { id: "b", label: "Opsi B", urlGambar: "" },
        ],
        opsiBenarId: "a",
        pembahasan: "",
      };
      const soal = await createSoal(input, UID_PANITIA_BOLEH);
      soalId = soal.id;
      const snap = await adminDb.doc(`soal/${soalId}`).get();
      assert.equal(snap.data()?.urlGambar, "https://raw.githubusercontent.com/user/aset/main/soal.png");
      assert.equal(
        snap.data()?.opsi?.[0]?.urlGambar,
        "https://raw.githubusercontent.com/user/aset/main/opsi-a.png"
      );
      assert.equal(snap.data()?.opsi?.[1]?.urlGambar, "");
      await signOut(clientAuth);
    }
  );

  // === 6. Panitia LAIN (bukan pemilik) mencoba menyunting soal itu — tetap
  //        ditolak seperti sebelum slice ini (kontrol negatif kepemilikan). ===
  await uji(
    "updateSoal() sebagai panitia BUKAN pemilik — DITOLAK permission-denied (tidak berubah oleh slice ini)",
    async () => {
      await masukSebagai(UID_PANITIA_TIDAK_BOLEH);
      const kunci = await getKunciSoal(soalId).catch(() => null);
      const input: SoalWriteInput = {
        teks: "Soal uji gambar (diubah paksa)",
        topikKode,
        tingkat: "sedang",
        urlGambar: "",
        opsi: [
          { id: "a", label: "Opsi A", urlGambar: "" },
          { id: "b", label: "Opsi B", urlGambar: "" },
        ],
        opsiBenarId: "a",
        pembahasan: kunci?.pembahasan ?? "",
      };
      await assert.rejects(
        () => updateSoal(soalId, input, UID_PANITIA_TIDAK_BOLEH),
        /permission|tidak ditemukan/i
      );
      await signOut(clientAuth);
    }
  );

  console.log(`\n${lulus} lulus, ${gagal} gagal.`);
  if (gagal > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("GALAT TAK TERTANGANI:", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
