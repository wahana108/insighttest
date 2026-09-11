/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji putuskanKuotaKegiatan(), putuskanBatasHarian(), dan
 * tanggalJakarta() (src/lib/kuota-peserta.ts) sebagai fungsi murni. Pakai
 * node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-kuota-peserta.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  putuskanBatasHarian,
  putuskanKuotaKegiatan,
  tanggalJakarta,
} from "../src/lib/kuota-peserta";

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

// --- LAPIS 1: putuskanKuotaKegiatan() ---

uji("kuota 0 (tak terbatas) → selalu diterima, berapa pun nomorUrutBaru", () => {
  assert.equal(putuskanKuotaKegiatan(0, 1).ok, true);
  assert.equal(putuskanKuotaKegiatan(0, 999999).ok, true);
});

uji("kuota 20, kegiatan lama tanpa field kuotaPeserta (dibaca sebagai 0) → tak terbatas", () => {
  // Simulasi mapKegiatan()/kegiatanData.kuotaPeserta default 0 untuk
  // dokumen lama — bukan tanggung jawab fungsi murni ini, tapi memastikan
  // 0 dari sumber mana pun diperlakukan sama: tak terbatas.
  const kuotaDefaultKegiatanLama = 0;
  assert.equal(putuskanKuotaKegiatan(kuotaDefaultKegiatanLama, 500).ok, true);
});

uji("kuota 20, belum penuh (nomorUrutBaru 19) → diterima", () => {
  const hasil = putuskanKuotaKegiatan(20, 19);
  assert.equal(hasil.ok, true);
  assert.equal(hasil.pesan, null);
});

uji("kuota 20, TEPAT penuh (nomorUrutBaru 20, pendaftar ke-20) → diterima (pas)", () => {
  const hasil = putuskanKuotaKegiatan(20, 20);
  assert.equal(hasil.ok, true);
});

uji("kuota 20, terlampaui (nomorUrutBaru 21, pendaftar ke-21) → DITOLAK dengan pesan tepat", () => {
  const hasil = putuskanKuotaKegiatan(20, 21);
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kuota peserta kegiatan ini sudah penuh.");
});

uji("kuota 1, pendaftar pertama (nomorUrutBaru 1) → diterima", () => {
  assert.equal(putuskanKuotaKegiatan(1, 1).ok, true);
});

uji("kuota 1, pendaftar kedua (nomorUrutBaru 2) → DITOLAK", () => {
  assert.equal(putuskanKuotaKegiatan(1, 2).ok, false);
});

// --- LAPIS 2: putuskanBatasHarian() ---

uji("batas harian 0 (tak terbatas) → selalu diterima", () => {
  assert.equal(putuskanBatasHarian(0, 1).ok, true);
  assert.equal(putuskanBatasHarian(0, 999999).ok, true);
});

uji("parameter lama tanpa field batasPendaftaranBaruPerHari (dibaca sebagai 0) → tak terbatas", () => {
  const batasDefaultParameterLama = 0;
  assert.equal(putuskanBatasHarian(batasDefaultParameterLama, 100).ok, true);
});

uji("batas harian 50, belum tercapai (jumlahBaruHariIni 49) → diterima", () => {
  assert.equal(putuskanBatasHarian(50, 49).ok, true);
});

uji("batas harian 50, TEPAT tercapai (jumlahBaruHariIni 50) → diterima (pas)", () => {
  assert.equal(putuskanBatasHarian(50, 50).ok, true);
});

uji("batas harian 50, terlampaui (jumlahBaruHariIni 51) → DITOLAK, pesan menyebut 'coba lagi besok'", () => {
  const hasil = putuskanBatasHarian(50, 51);
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kuota pendaftaran hari ini sudah penuh. Coba lagi besok.");
});

// --- tanggalJakarta(): zona waktu WAJIB Asia/Jakarta, bukan UTC ---

uji("tanggalJakarta: 23:30 UTC (=06:30 Jakarta, hari berikutnya) → tanggal Jakarta, bukan tanggal UTC", () => {
  // 2026-03-04T23:30:00Z → Jakarta (UTC+7) = 2026-03-05T06:30:00 → 05, bukan 04.
  const hasil = tanggalJakarta(new Date("2026-03-04T23:30:00Z"));
  assert.equal(hasil, "2026-03-05");
});

uji("tanggalJakarta: 16:59 UTC (=23:59 Jakarta, hari YANG SAMA) → tanggal UTC itu sendiri", () => {
  const hasil = tanggalJakarta(new Date("2026-03-04T16:59:00Z"));
  assert.equal(hasil, "2026-03-04");
});

uji("tanggalJakarta: 17:00 UTC TEPAT (=00:00 Jakarta, tengah malam, hari berikutnya)", () => {
  const hasil = tanggalJakarta(new Date("2026-03-04T17:00:00Z"));
  assert.equal(hasil, "2026-03-05");
});

uji("tanggalJakarta: format selalu YYYY-MM-DD (dua digit bulan/tanggal)", () => {
  const hasil = tanggalJakarta(new Date("2026-01-01T00:00:00Z"));
  assert.match(hasil, /^\d{4}-\d{2}-\d{2}$/);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
