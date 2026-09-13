/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji putuskanAksesMandiri(), mapCaraMasuk(), normalisasiKodeAkses(),
 * dan bolehTampilDiKatalog() (src/lib/akses-kegiatan.ts) sebagai fungsi
 * murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-akses-kegiatan.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  bolehTampilDiKatalog,
  mapCaraMasuk,
  normalisasiKodeAkses,
  putuskanAksesMandiri,
} from "../src/lib/akses-kegiatan";
import type { HasilKeputusanKuota } from "../src/lib/kuota-peserta";

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

const KUOTA_OK: HasilKeputusanKuota = { ok: true, pesan: null };
const KUOTA_PENUH: HasilKeputusanKuota = { ok: false, pesan: "Kuota peserta kegiatan ini sudah penuh." };
const BATAS_HARIAN_OK: HasilKeputusanKuota = { ok: true, pesan: null };
const BATAS_HARIAN_PENUH: HasilKeputusanKuota = {
  ok: false,
  pesan: "Kuota pendaftaran hari ini sudah penuh. Coba lagi besok.",
};

uji("terbuka + kuota kegiatan penuh → DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "terbuka",
    kodeDimasukkan: "",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_PENUH,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kuota peserta kegiatan ini sudah penuh.");
});

uji("terbuka + batas harian penuh → DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "terbuka",
    kodeDimasukkan: "",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_PENUH,
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kuota pendaftaran hari ini sudah penuh. Coba lagi besok.");
});

uji("kode + kode benar + batas harian penuh → LOLOS (melewati batas harian)", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SAWERIA2026",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_PENUH,
  });
  assert.equal(hasil.ok, true, `Diharapkan lolos, dapat ditolak: ${hasil.pesan}`);
});

uji("kode + kode benar + kuota kegiatan penuh → DITOLAK (tetap terikat kuota kegiatan)", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SAWERIA2026",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_PENUH,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kuota peserta kegiatan ini sudah penuh.");
});

uji("kode + kode salah → DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SALAH",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kode akses salah atau belum diisi.");
});

uji("kode + kode kosong → DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kode akses salah atau belum diisi.");
});

uji("kode + kegiatan_kode belum pernah diisi admin (kodeTersimpan null) → DITOLAK, bukan galat", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "APA-SAJA",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
});

uji("kode dengan spasi dan huruf kecil → tetap cocok setelah dinormalkan", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "  saweria-2026  ",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, true, `Diharapkan lolos setelah normalisasi, dapat ditolak: ${hasil.pesan}`);
});

uji("hanya_admin + pendaftaran mandiri → DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "hanya_admin",
    kodeDimasukkan: "",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, false);
  assert.match(hasil.pesan ?? "", /admin/i);
});

uji("kegiatan lama tanpa field caraMasuk (mapCaraMasuk(undefined)) → diperlakukan 'terbuka'", () => {
  assert.equal(mapCaraMasuk(undefined), "terbuka");
  assert.equal(mapCaraMasuk(null), "terbuka");
  assert.equal(mapCaraMasuk("sesuatu-yang-rusak"), "terbuka");
  const hasil = putuskanAksesMandiri({
    caraMasuk: mapCaraMasuk(undefined),
    kodeDimasukkan: "",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
  });
  assert.equal(hasil.ok, true, "kegiatan lama harus berperilaku persis 'terbuka'");
});

uji("mapCaraMasuk: nilai valid dipetakan apa adanya", () => {
  assert.equal(mapCaraMasuk("kode"), "kode");
  assert.equal(mapCaraMasuk("hanya_admin"), "hanya_admin");
  assert.equal(mapCaraMasuk("terbuka"), "terbuka");
});

// --- normalisasiKodeAkses() ---

uji("normalisasiKodeAkses: trim, buang tanda hubung, huruf besar", () => {
  assert.equal(normalisasiKodeAkses("  saweria-sept-2026  "), "SAWERIASEPT2026");
});

uji("normalisasiKodeAkses: string kosong tidak melempar", () => {
  assert.doesNotThrow(() => normalisasiKodeAkses(""));
  assert.equal(normalisasiKodeAkses(""), "");
});

// --- bolehTampilDiKatalog() (jadwal publikasi) ---

uji("bolehTampilDiKatalog: caraMasuk 'hanya_admin' → TIDAK PERNAH tampil, apa pun jendelanya", () => {
  assert.equal(
    bolehTampilDiKatalog({ dibukaPada: null, ditutupPada: null, caraMasuk: "hanya_admin" }),
    false
  );
});

uji("bolehTampilDiKatalog: 'terbuka' tanpa jendela sama sekali → tampil", () => {
  assert.equal(
    bolehTampilDiKatalog({ dibukaPada: null, ditutupPada: null, caraMasuk: "terbuka" }),
    true
  );
});

uji("bolehTampilDiKatalog: dibukaPada di masa depan → TIDAK tampil", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(
    bolehTampilDiKatalog(
      { dibukaPada: "2026-07-01T00:00:00.000Z", ditutupPada: null, caraMasuk: "terbuka" },
      now
    ),
    false
  );
});

uji("bolehTampilDiKatalog: ditutupPada sudah lewat → TIDAK tampil", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(
    bolehTampilDiKatalog(
      { dibukaPada: null, ditutupPada: "2026-05-01T00:00:00.000Z", caraMasuk: "terbuka" },
      now
    ),
    false
  );
});

uji("bolehTampilDiKatalog: caraMasuk 'kode' dengan jendela sedang terbuka → tetap tampil (kodenya sendiri tidak disembunyikan dari katalog)", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(
    bolehTampilDiKatalog(
      {
        dibukaPada: "2026-05-01T00:00:00.000Z",
        ditutupPada: "2026-07-01T00:00:00.000Z",
        caraMasuk: "kode",
      },
      now
    ),
    true
  );
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
