/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji fungsi murni di src/lib/pendaftaran-tanpa-sandi.ts: siapa aktif,
 * pemilihan pesan (termasuk penyamaran auth/email-already-in-use), dan
 * pembuatan kata sandi acak. Pakai node:assert saja.
 *
 * Jalankan: npx tsx scripts/uji-pendaftaran-tanpa-sandi.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  buatKataSandiAcak,
  pendaftaranTanpaSandiAktif,
  pesanGalatAuthIndonesia,
  putuskanTampilanSetelahDaftarTanpaSandi,
} from "../src/lib/pendaftaran-tanpa-sandi";
import type { SystemParameter } from "../src/types/parameter";

// Konstruksi literal langsung — SENGAJA TIDAK mengimpor
// src/lib/services/system-parameter.ts: modul itu mengimpor
// src/lib/firebase/client.ts, yang menjalankan initializeApp()/getAuth() di
// level modul memakai process.env.NEXT_PUBLIC_FIREBASE_* — env yang tidak
// dimuat tsx menjalankan skrip ini secara langsung (bukan lewat next dev),
// sehingga getAuth() melempar "auth/invalid-api-key" sebelum baris tes
// mana pun berjalan. Fungsi yang diuji di sini murni, jadi tidak perlu
// modul itu sama sekali.
const PARAMETER_DASAR: SystemParameter = {
  namaPlatform: "InsightTest",
  modePendaftaran: "terbuka",
  pesanBeranda: "",
  urlPublik: "",
  batasPendaftaranBaruPerHari: 0,
  pendaftaranTanpaKataSandi: false,
  updatedAt: null,
  updatedBy: null,
};

let lulus = 0;
let gagal = 0;

function uji(nama: string, fn: () => void): void {
  try {
    fn();
    lulus += 1;
    console.log(`OK    ${nama}`);
  } catch (err) {
    gagal += 1;
    console.error(`GAGAL ${nama}`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

// --- pendaftaranTanpaSandiAktif() ---

uji("mode 'terbuka' + flag true → aktif", () => {
  assert.equal(
    pendaftaranTanpaSandiAktif({
      ...PARAMETER_DASAR,
      modePendaftaran: "terbuka",
      pendaftaranTanpaKataSandi: true,
    }),
    true
  );
});

uji("mode 'terbuka' + flag false → TIDAK aktif", () => {
  assert.equal(
    pendaftaranTanpaSandiAktif({
      ...PARAMETER_DASAR,
      modePendaftaran: "terbuka",
      pendaftaranTanpaKataSandi: false,
    }),
    false
  );
});

uji("mode 'persetujuan' + flag true → TIDAK aktif (hanya berlaku untuk 'terbuka')", () => {
  assert.equal(
    pendaftaranTanpaSandiAktif({
      ...PARAMETER_DASAR,
      modePendaftaran: "persetujuan",
      pendaftaranTanpaKataSandi: true,
    }),
    false
  );
});

uji("mode 'undangan' + flag true → TIDAK aktif (mode undangan tidak disentuh)", () => {
  assert.equal(
    pendaftaranTanpaSandiAktif({
      ...PARAMETER_DASAR,
      modePendaftaran: "undangan",
      pendaftaranTanpaKataSandi: true,
    }),
    false
  );
});

uji("parameter lama tanpa field pendaftaranTanpaKataSandi (PARAMETER_DASAR) → TIDAK aktif", () => {
  assert.equal(pendaftaranTanpaSandiAktif(PARAMETER_DASAR), false);
});

// --- putuskanTampilanSetelahDaftarTanpaSandi() ---

uji("kodeGalat null (akun berhasil dibuat) → tampilkan sukses", () => {
  const hasil = putuskanTampilanSetelahDaftarTanpaSandi(null);
  assert.equal(hasil.tampilkanSukses, true);
  assert.equal(hasil.pesanGalat, null);
});

uji("auth/email-already-in-use → DISAMARKAN, hasilnya SAMA PERSIS dengan kasus berhasil", () => {
  const berhasil = putuskanTampilanSetelahDaftarTanpaSandi(null);
  const sudahAda = putuskanTampilanSetelahDaftarTanpaSandi("auth/email-already-in-use");
  assert.deepEqual(sudahAda, berhasil);
  assert.equal(sudahAda.tampilkanSukses, true);
});

uji("auth/invalid-email → TIDAK disamarkan, pesan spesifik format email", () => {
  const hasil = putuskanTampilanSetelahDaftarTanpaSandi("auth/invalid-email");
  assert.equal(hasil.tampilkanSukses, false);
  assert.equal(hasil.pesanGalat, "Format email tidak valid.");
});

uji("auth/too-many-requests → TIDAK disamarkan, pesan spesifik", () => {
  const hasil = putuskanTampilanSetelahDaftarTanpaSandi("auth/too-many-requests");
  assert.equal(hasil.tampilkanSukses, false);
  assert.match(hasil.pesanGalat ?? "", /percobaan/i);
});

uji("auth/network-request-failed → TIDAK disamarkan, pesan spesifik jaringan", () => {
  const hasil = putuskanTampilanSetelahDaftarTanpaSandi("auth/network-request-failed");
  assert.equal(hasil.tampilkanSukses, false);
  assert.match(hasil.pesanGalat ?? "", /koneksi|jaringan|server/i);
});

uji("kode error tidak dikenal → TIDAK disamarkan, jatuh ke pesan umum (bukan error mentah)", () => {
  const hasil = putuskanTampilanSetelahDaftarTanpaSandi("auth/sesuatu-yang-baru");
  assert.equal(hasil.tampilkanSukses, false);
  assert.equal(typeof hasil.pesanGalat, "string");
  assert.ok((hasil.pesanGalat ?? "").length > 0);
});

// --- pesanGalatAuthIndonesia() ---

uji("pesanGalatAuthIndonesia: kode dikenal dipetakan ke Bahasa Indonesia", () => {
  assert.equal(pesanGalatAuthIndonesia("auth/invalid-email"), "Format email tidak valid.");
});

uji("pesanGalatAuthIndonesia: kode tidak dikenal → fallback generik, tidak melempar", () => {
  assert.doesNotThrow(() => pesanGalatAuthIndonesia("kode-asing-random"));
  assert.ok(pesanGalatAuthIndonesia("kode-asing-random").length > 0);
});

// --- buatKataSandiAcak() ---

uji("buatKataSandiAcak(): panjang bawaan 32", () => {
  assert.equal(buatKataSandiAcak().length, 32);
});

uji("buatKataSandiAcak(panjang): menghormati panjang yang diminta", () => {
  assert.equal(buatKataSandiAcak(10).length, 10);
  assert.equal(buatKataSandiAcak(64).length, 64);
});

uji("buatKataSandiAcak(): dua panggilan TIDAK PERNAH menghasilkan nilai sama", () => {
  const a = buatKataSandiAcak();
  const b = buatKataSandiAcak();
  assert.notEqual(a, b);
});

uji("buatKataSandiAcak(): banyak panggilan berturut-turut semuanya berbeda satu sama lain (sanity acak, bukan pola tetap)", () => {
  const hasil = new Set(Array.from({ length: 50 }, () => buatKataSandiAcak()));
  assert.equal(hasil.size, 50);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
