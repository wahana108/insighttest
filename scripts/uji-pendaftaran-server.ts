/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji susunTulisanBalikIdentitasPendaftaran()
 * (src/lib/api/pendaftaran-server.ts) sebagai fungsi murni. Pakai
 * node:assert saja, tidak ada framework tes baru, TANPA Firestore.
 *
 * buatModulSnapshot() di berkas yang sama TIDAK diuji di sini — ia
 * menerima Transaction Admin SDK sungguhan, tidak bisa dipanggil tanpa
 * Firestore.
 *
 * Jalankan: npx tsx scripts/uji-pendaftaran-server.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { susunTulisanBalikIdentitasPendaftaran } from "../src/lib/api/pendaftaran-server";

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

// --- susunTulisanBalikIdentitasPendaftaran(): pagar namaLengkap kosong ---

uji("profil.namaLengkap kosong (\"\") -> objek update TIDAK memuat namaLengkap sama sekali", () => {
  const hasil = susunTulisanBalikIdentitasPendaftaran({
    namaLengkap: "",
    institusi: "Dinas A",
    nomorIdentitas: "12345",
    noTelepon: "0812",
  });
  assert.equal("namaLengkap" in hasil, false);
});

uji("profil.namaLengkap hanya spasi (\"   \") -> tetap TIDAK memuat namaLengkap (trim)", () => {
  const hasil = susunTulisanBalikIdentitasPendaftaran({
    namaLengkap: "   ",
    institusi: "Dinas A",
    nomorIdentitas: "12345",
    noTelepon: "0812",
  });
  assert.equal("namaLengkap" in hasil, false);
});

uji("profil.namaLengkap terisi -> objek update MEMUAT namaLengkap apa adanya", () => {
  const hasil = susunTulisanBalikIdentitasPendaftaran({
    namaLengkap: "Budi Santoso",
    institusi: "Dinas A",
    nomorIdentitas: "12345",
    noTelepon: "0812",
  });
  assert.equal("namaLengkap" in hasil, true);
  assert.equal(hasil.namaLengkap, "Budi Santoso");
});

uji("institusi/nomorIdentitas/noTelepon TETAP ditulis apa adanya, termasuk saat kosong (BUKAN dipagari seperti namaLengkap)", () => {
  const hasil = susunTulisanBalikIdentitasPendaftaran({
    namaLengkap: "Budi Santoso",
    institusi: "",
    nomorIdentitas: "",
    noTelepon: "",
  });
  assert.equal(hasil.institusi, "");
  assert.equal(hasil.nomorIdentitas, "");
  assert.equal(hasil.noTelepon, "");
});

uji("identitasBelumLengkap SELALU false di objek update, apa pun isi profil", () => {
  const hasil = susunTulisanBalikIdentitasPendaftaran({
    namaLengkap: "",
    institusi: "",
    nomorIdentitas: "",
    noTelepon: "",
  });
  assert.equal(hasil.identitasBelumLengkap, false);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
