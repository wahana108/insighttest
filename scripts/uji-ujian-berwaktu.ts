/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji periksaJendelaUjian() (src/lib/ujian-berwaktu.ts) sebagai fungsi
 * murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-ujian-berwaktu.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { KELONGGARAN_JARINGAN_DETIK, periksaJendelaUjian } from "../src/lib/ujian-berwaktu";

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

const DITUTUP = new Date("2026-03-10T10:00:00.000Z");

uji("kirim JAUH SEBELUM tutup (1 jam sebelum) -> TIDAK kedaluwarsa", () => {
  const waktuKirim = new Date(DITUTUP.getTime() - 60 * 60 * 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, false);
});

uji("kirim TEPAT SEBELUM tutup (1 detik sebelum) -> TIDAK kedaluwarsa", () => {
  const waktuKirim = new Date(DITUTUP.getTime() - 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, false);
});

uji("kirim TEPAT SAAT tutup (waktuKirim == ditutupPada) -> TIDAK kedaluwarsa (di dalam kelonggaran)", () => {
  const hasil = periksaJendelaUjian(DITUTUP, new Date(DITUTUP.getTime()));
  assert.equal(hasil.kedaluwarsa, false);
});

uji(`kirim DI DALAM kelonggaran ${KELONGGARAN_JARINGAN_DETIK} detik (30 detik setelah tutup) -> TIDAK kedaluwarsa`, () => {
  const waktuKirim = new Date(DITUTUP.getTime() + 30 * 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, false);
});

uji(`kirim TEPAT DI BATAS kelonggaran (${KELONGGARAN_JARINGAN_DETIK} detik setelah tutup) -> TIDAK kedaluwarsa (pas, bukan lewat)`, () => {
  const waktuKirim = new Date(DITUTUP.getTime() + KELONGGARAN_JARINGAN_DETIK * 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, false);
});

uji(`kirim TEPAT SETELAH kelonggaran (1 detik lewat dari ${KELONGGARAN_JARINGAN_DETIK} detik) -> KEDALUWARSA`, () => {
  const waktuKirim = new Date(DITUTUP.getTime() + KELONGGARAN_JARINGAN_DETIK * 1000 + 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, true);
});

uji("kirim JAUH SETELAH tutup (1 hari setelah) -> KEDALUWARSA", () => {
  const waktuKirim = new Date(DITUTUP.getTime() + 24 * 60 * 60 * 1000);
  const hasil = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasil.kedaluwarsa, true);
});

uji("kegiatan TANPA ditutupPada sama sekali (null) -> TIDAK PERNAH kedaluwarsa, berapa pun waktuKirim-nya", () => {
  assert.equal(periksaJendelaUjian(null, new Date("2020-01-01T00:00:00.000Z")).kedaluwarsa, false);
  assert.equal(periksaJendelaUjian(null, new Date("2099-01-01T00:00:00.000Z")).kedaluwarsa, false);
});

uji("fungsi ini TIDAK menerima batasWaktuMenit sama sekali (independen dari timer per-modul) — modul tanpa batasWaktuMenit tidak mengubah hasil", () => {
  // periksaJendelaUjian() cuma tahu ditutupPada kegiatan dan waktuKirim —
  // signature-nya sendiri membuktikan ia tidak bisa dipengaruhi
  // batasWaktuMenit (yang mengatur attempt.kadaluarsaPada, mekanisme
  // TERPISAH dan tidak pernah dioper ke sini).
  const waktuKirim = new Date(DITUTUP.getTime() - 1000);
  const hasilModulTanpaTimer = periksaJendelaUjian(DITUTUP, waktuKirim);
  assert.equal(hasilModulTanpaTimer.kedaluwarsa, false);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
