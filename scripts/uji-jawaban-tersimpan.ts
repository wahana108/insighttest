/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji pulihkanJawaban() (src/lib/jawaban-tersimpan.ts) sebagai fungsi
 * murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-jawaban-tersimpan.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { pulihkanJawaban } from "../src/lib/jawaban-tersimpan";

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

uji("penyimpanan kosong (null) → peta kosong", () => {
  const hasil = pulihkanJawaban(null, ["s1", "s2"]);
  assert.deepEqual(hasil, {});
});

uji("string kosong → peta kosong", () => {
  const hasil = pulihkanJawaban("", ["s1", "s2"]);
  assert.deepEqual(hasil, {});
});

uji("JSON rusak → peta kosong, tidak melempar", () => {
  const hasil = pulihkanJawaban("{tidak valid", ["s1"]);
  assert.deepEqual(hasil, {});
});

uji("JSON valid tapi bukan objek (array) → peta kosong", () => {
  const hasil = pulihkanJawaban(JSON.stringify(["s1", "opsi-a"]), ["s1"]);
  assert.deepEqual(hasil, {});
});

uji("JSON valid tapi bukan objek (angka) → peta kosong", () => {
  const hasil = pulihkanJawaban(JSON.stringify(42), ["s1"]);
  assert.deepEqual(hasil, {});
});

uji("JSON valid tapi null → peta kosong", () => {
  const hasil = pulihkanJawaban(JSON.stringify(null), ["s1"]);
  assert.deepEqual(hasil, {});
});

uji("soalId asing (bukan bagian attempt ini) → dibuang", () => {
  const mentah = JSON.stringify({ s1: "a", "soal-attempt-lama": "b" });
  const hasil = pulihkanJawaban(mentah, ["s1", "s2"]);
  assert.deepEqual(hasil, { s1: "a" });
});

uji("opsiId yang bentuknya salah (bukan string) → entri itu dibuang", () => {
  const mentah = JSON.stringify({ s1: "a", s2: 123, s3: null, s4: { x: 1 } });
  const hasil = pulihkanJawaban(mentah, ["s1", "s2", "s3", "s4"]);
  assert.deepEqual(hasil, { s1: "a" });
});

uji("semua soalId cocok → peta dikembalikan apa adanya", () => {
  const mentah = JSON.stringify({ s1: "a", s2: "b" });
  const hasil = pulihkanJawaban(mentah, ["s1", "s2"]);
  assert.deepEqual(hasil, { s1: "a", s2: "b" });
});

uji("daftar soalIds kosong (attempt tanpa soal) → semuanya dibuang", () => {
  const mentah = JSON.stringify({ s1: "a" });
  const hasil = pulihkanJawaban(mentah, []);
  assert.deepEqual(hasil, {});
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
