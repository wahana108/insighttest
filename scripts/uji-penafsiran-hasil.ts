/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji susunPenafsiranHasil() (src/lib/penafsiran-hasil.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-penafsiran-hasil.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  DISCLAIMER_PENAFSIRAN_HASIL,
  susunPenafsiranHasil,
} from "../src/lib/penafsiran-hasil";

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

uji("penafsiranHasil terisi → disclaimer tetap di atas, teks admin di bawahnya", () => {
  const hasil = susunPenafsiranHasil(
    "Kalau modul A di atas 70 dan modul C di bawah 40, itu berarti kecenderungan X."
  );
  assert.notEqual(hasil, null);
  assert.ok(hasil!.startsWith(DISCLAIMER_PENAFSIRAN_HASIL), "disclaimer harus di baris paling atas");
  assert.ok(
    hasil!.includes("Kalau modul A di atas 70"),
    "teks admin harus tetap ada di bawah disclaimer"
  );
});

uji("penafsiranHasil kosong (\"\") → null (fitur mati, tidak ada apa pun untuk ditampilkan)", () => {
  assert.equal(susunPenafsiranHasil(""), null);
});

uji("penafsiranHasil hanya berisi spasi/baris kosong → null, bukan disclaimer sendirian", () => {
  assert.equal(susunPenafsiranHasil("   \n\n  "), null);
});

uji(
  "kegiatan lama tanpa field penafsiranHasil sama sekali (mapKegiatan() membacanya sebagai \"\") → null, PERSIS seperti sengaja dikosongkan",
  () => {
    // Meniru persis apa yang mapKegiatan() kembalikan untuk dokumen yang
    // tidak punya field ini sama sekali: typeof data.penafsiranHasil ===
    // "string" ? ... : "" → selalu jatuh ke string kosong.
    const dariKegiatanLama = typeof undefined === "string" ? (undefined as never) : "";
    assert.equal(susunPenafsiranHasil(dariKegiatanLama), null);
  }
);

uji("baris baru di teks admin DIPERTAHANKAN apa adanya (bukan digabung jadi satu baris)", () => {
  const hasil = susunPenafsiranHasil("Baris satu.\nBaris dua.");
  assert.ok(hasil!.includes("Baris satu.\nBaris dua."), "baris baru harus tetap ada di hasil");
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
