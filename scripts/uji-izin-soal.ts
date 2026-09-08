/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji izinSoal() dan bolehSuntingSoal() (src/lib/izin-soal.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-izin-soal.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { izinSoal, bolehSuntingSoal } from "../src/lib/izin-soal";

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

uji("admin: bolehBuat true, apa pun bolehBuatSoal-nya", () => {
  assert.equal(izinSoal({ uid: "u-admin", role: "admin" }).bolehBuat, true);
  assert.equal(izinSoal({ uid: "u-admin", role: "admin", bolehBuatSoal: false }).bolehBuat, true);
});

uji("superadmin: bolehBuat true", () => {
  assert.equal(izinSoal({ uid: "u-super", role: "superadmin" }).bolehBuat, true);
});

uji("panitia dengan bolehBuatSoal true: bolehBuat true", () => {
  assert.equal(izinSoal({ uid: "u-p", role: "panitia", bolehBuatSoal: true }).bolehBuat, true);
});

uji("panitia dengan bolehBuatSoal false/tidak ada: bolehBuat false", () => {
  assert.equal(izinSoal({ uid: "u-p", role: "panitia", bolehBuatSoal: false }).bolehBuat, false);
  assert.equal(izinSoal({ uid: "u-p", role: "panitia" }).bolehBuat, false);
});

uji("peserta: selalu false, apa pun bolehBuatSoal-nya", () => {
  assert.equal(izinSoal({ uid: "u-x", role: "peserta", bolehBuatSoal: true }).bolehBuat, false);
});

uji("profil null: false", () => {
  assert.equal(izinSoal(null).bolehBuat, false);
});

uji("peran tidak dikenal: false", () => {
  assert.equal(izinSoal({ uid: "u-x", role: "bukan-peran" as never }).bolehBuat, false);
});

uji("bolehSuntingSoal: admin selalu boleh, termasuk soal tanpa dibuatOleh", () => {
  assert.equal(bolehSuntingSoal({ uid: "u-admin", role: "admin" }, {}), true);
  assert.equal(
    bolehSuntingSoal({ uid: "u-admin", role: "admin" }, { dibuatOleh: "orang-lain" }),
    true
  );
});

uji("bolehSuntingSoal: panitia dengan bolehBuatSoal, soal miliknya sendiri -> boleh", () => {
  const profil = { uid: "u-p", role: "panitia" as const, bolehBuatSoal: true };
  assert.equal(bolehSuntingSoal(profil, { dibuatOleh: "u-p" }), true);
});

uji("bolehSuntingSoal: panitia dengan bolehBuatSoal, soal milik orang lain -> ditolak", () => {
  const profil = { uid: "u-p", role: "panitia" as const, bolehBuatSoal: true };
  assert.equal(bolehSuntingSoal(profil, { dibuatOleh: "orang-lain" }), false);
});

uji("bolehSuntingSoal: panitia TANPA bolehBuatSoal -> ditolak walau dibuatOleh dirinya", () => {
  const profil = { uid: "u-p", role: "panitia" as const, bolehBuatSoal: false };
  assert.equal(bolehSuntingSoal(profil, { dibuatOleh: "u-p" }), false);
});

uji("bolehSuntingSoal: soal lama tanpa dibuatOleh sama sekali -> panitia ditolak", () => {
  const profil = { uid: "u-p", role: "panitia" as const, bolehBuatSoal: true };
  assert.equal(bolehSuntingSoal(profil, {}), false);
  assert.equal(bolehSuntingSoal(profil, null), false);
});

uji("bolehSuntingSoal: dibuatOleh bentuknya salah (bukan string) -> panitia ditolak, tidak melempar", () => {
  const profil = { uid: "u-p", role: "panitia" as const, bolehBuatSoal: true };
  assert.equal(bolehSuntingSoal(profil, { dibuatOleh: 12345 }), false);
});

uji("bolehSuntingSoal: peserta selalu ditolak", () => {
  assert.equal(bolehSuntingSoal({ uid: "u-x", role: "peserta" }, { dibuatOleh: "u-x" }), false);
});

uji("bolehSuntingSoal: profil null -> ditolak", () => {
  assert.equal(bolehSuntingSoal(null, { dibuatOleh: "siapa-saja" }), false);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
