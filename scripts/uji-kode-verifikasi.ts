/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji normalisasiKodeVerifikasi() (src/lib/kode-verifikasi.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-kode-verifikasi.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { normalisasiKodeVerifikasi } from "../src/lib/kode-verifikasi";

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

uji("huruf besar (bentuk kanonik tersimpan) → tidak berubah", () => {
  assert.equal(normalisasiKodeVerifikasi("U6SK21JGWN"), "U6SK21JGWN");
});

uji("huruf kecil → diubah ke huruf besar (gejala yang dilaporkan)", () => {
  assert.equal(normalisasiKodeVerifikasi("u6sk21jgwn"), "U6SK21JGWN");
});

uji("huruf campur besar-kecil → semuanya jadi huruf besar", () => {
  assert.equal(normalisasiKodeVerifikasi("U6sK21jGwN"), "U6SK21JGWN");
});

uji("spasi di kedua ujung → dibuang", () => {
  assert.equal(normalisasiKodeVerifikasi("  u6sk21jgwn  "), "U6SK21JGWN");
});

uji("bertanda hubung (dikelompokkan seperti nomor seri) → tanda hubung dibuang", () => {
  assert.equal(normalisasiKodeVerifikasi("u6sk-21jg-wn"), "U6SK21JGWN");
});

uji("gabungan spasi ujung + tanda hubung + huruf campur sekaligus", () => {
  assert.equal(normalisasiKodeVerifikasi("  u6SK-21jg-WN  "), "U6SK21JGWN");
});

uji("kode yang memang tidak ada (teks sembarang) → tetap dinormalkan, TIDAK melempar", () => {
  assert.doesNotThrow(() => normalisasiKodeVerifikasi("bukan-kode-yang-valid"));
  assert.equal(normalisasiKodeVerifikasi("bukan-kode-yang-valid"), "BUKANKODEYANGVALID");
  // "Tidak ditemukan" adalah hasil query Firestore setelah normalisasi ini,
  // bukan sesuatu yang diputuskan fungsi murni ini sendiri — di sinilah ia
  // hanya perlu tidak pernah gagal/melempar untuk input apa pun.
});

uji("string kosong → tidak melempar, hasil string kosong", () => {
  assert.doesNotThrow(() => normalisasiKodeVerifikasi(""));
  assert.equal(normalisasiKodeVerifikasi(""), "");
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
