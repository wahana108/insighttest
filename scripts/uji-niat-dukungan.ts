/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji idNiatDukungan() + putuskanBatasNiatHarian() +
 * putuskanBatasDukunganAdminHarian() + petakanNiatDukunganKeBarisImpor()
 * (src/lib/niat-dukungan.ts), putuskanCatatanDukunganWajib() +
 * putuskanAksesMandiri() (src/lib/akses-kegiatan.ts), dan
 * templatEmailKodeAkses() (src/lib/email/templat.ts) sebagai fungsi murni.
 * Pakai node:assert saja, tidak ada framework tes baru, TANPA jaringan dan
 * TANPA Firestore.
 *
 * Jalankan: npx tsx scripts/uji-niat-dukungan.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  putuskanAksesMandiri,
  putuskanCatatanDukunganWajib,
} from "../src/lib/akses-kegiatan";
import { templatEmailKodeAkses } from "../src/lib/email/templat";
import {
  BATAS_DUKUNGAN_ADMIN_PER_HARI,
  BATAS_NIAT_PER_HARI,
  idNiatDukungan,
  petakanNiatDukunganKeBarisImpor,
  putuskanBatasDukunganAdminHarian,
  putuskanBatasNiatHarian,
} from "../src/lib/niat-dukungan";
import { headerTemplatImporCsv } from "../src/lib/services/impor-hadir";
import type { HasilKeputusanKuota } from "../src/lib/kuota-peserta";
import type { FormulirPeserta } from "../src/types/kegiatan";

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
const BATAS_HARIAN_OK: HasilKeputusanKuota = { ok: true, pesan: null };
const BATAS_PEMAKAIAN_KODE_OK: HasilKeputusanKuota = { ok: true, pesan: null };

// --- idNiatDukungan(): ID deterministik ---

uji("idNiatDukungan: stabil — pasangan (kegiatanId, uid) yang sama selalu menghasilkan ID yang sama", () => {
  assert.equal(idNiatDukungan("keg1", "uid1"), idNiatDukungan("keg1", "uid1"));
});

uji("idNiatDukungan: memuat kegiatanId dan uid apa adanya, dipisah '__'", () => {
  assert.equal(idNiatDukungan("keg1", "uid1"), "keg1__uid1");
});

uji("idNiatDukungan: uid berbeda pada kegiatan yang sama -> ID berbeda", () => {
  assert.notEqual(idNiatDukungan("keg1", "uidA"), idNiatDukungan("keg1", "uidB"));
});

uji("idNiatDukungan: kegiatan berbeda untuk uid yang sama -> ID berbeda", () => {
  assert.notEqual(idNiatDukungan("keg1", "uid1"), idNiatDukungan("keg2", "uid1"));
});

uji("idNiatDukungan: tidak ada tabrakan silang antar 4 kombinasi berbeda", () => {
  const kombinasi = [
    idNiatDukungan("keg1", "uid1"),
    idNiatDukungan("keg1", "uid2"),
    idNiatDukungan("keg2", "uid1"),
    idNiatDukungan("keg2", "uid2"),
  ];
  assert.equal(new Set(kombinasi).size, kombinasi.length);
});

// --- putuskanBatasNiatHarian(): batas 5/hari POST /api/dukungan/niat ---

uji("putuskanBatasNiatHarian: BATAS_NIAT_PER_HARI bernilai 5 (dipakai pesan galat di bawah)", () => {
  assert.equal(BATAS_NIAT_PER_HARI, 5);
});

uji("putuskanBatasNiatHarian: jumlahSaatIni 0 -> BOLEH", () => {
  assert.equal(putuskanBatasNiatHarian(0).ok, true);
});

uji("putuskanBatasNiatHarian: jumlahSaatIni di bawah batas (4) -> BOLEH", () => {
  assert.equal(putuskanBatasNiatHarian(BATAS_NIAT_PER_HARI - 1).ok, true);
});

uji("putuskanBatasNiatHarian: jumlahSaatIni TEPAT di batas (5) -> DITOLAK (percobaan ke-6 yang ditolak, bukan ke-5)", () => {
  const hasil = putuskanBatasNiatHarian(BATAS_NIAT_PER_HARI);
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Anda sudah mengisi 5 formulir dukungan hari ini. Coba lagi besok.");
});

uji("putuskanBatasNiatHarian: jumlahSaatIni melewati batas (6) -> DITOLAK", () => {
  assert.equal(putuskanBatasNiatHarian(BATAS_NIAT_PER_HARI + 1).ok, false);
});

// --- putuskanBatasDukunganAdminHarian(): batas 20/hari POST /api/dukungan/admin ---

uji("putuskanBatasDukunganAdminHarian: BATAS_DUKUNGAN_ADMIN_PER_HARI bernilai 20 (dipakai pesan galat di bawah)", () => {
  assert.equal(BATAS_DUKUNGAN_ADMIN_PER_HARI, 20);
});

uji("putuskanBatasDukunganAdminHarian: jumlahSaatIni 0 -> BOLEH", () => {
  assert.equal(putuskanBatasDukunganAdminHarian(0).ok, true);
});

uji("putuskanBatasDukunganAdminHarian: jumlahSaatIni di bawah batas (19) -> BOLEH", () => {
  assert.equal(putuskanBatasDukunganAdminHarian(BATAS_DUKUNGAN_ADMIN_PER_HARI - 1).ok, true);
});

uji("putuskanBatasDukunganAdminHarian: jumlahSaatIni TEPAT di batas (20) -> DITOLAK (percobaan ke-21 yang ditolak, bukan ke-20)", () => {
  const hasil = putuskanBatasDukunganAdminHarian(BATAS_DUKUNGAN_ADMIN_PER_HARI);
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Anda sudah membuat 20 catatan dukungan hari ini. Coba lagi besok.");
});

uji("putuskanBatasDukunganAdminHarian: jumlahSaatIni melewati batas (21) -> DITOLAK", () => {
  assert.equal(putuskanBatasDukunganAdminHarian(BATAS_DUKUNGAN_ADMIN_PER_HARI + 1).ok, false);
});

// --- petakanNiatDukunganKeBarisImpor(): jembatan ke importir peserta (Slice 6d) ---

const FORMULIR_TIDAK_ADA: FormulirPeserta = {
  institusi: "tidak",
  nomorIdentitas: "tidak",
  noTelepon: "tidak",
};
const FORMULIR_CAMPURAN: FormulirPeserta = {
  institusi: "wajib",
  nomorIdentitas: "opsional",
  noTelepon: "tidak",
};

uji("petakanNiatDukunganKeBarisImpor: email dan namaDipakai masuk ke dua kolom pertama, apa adanya", () => {
  const baris = petakanNiatDukunganKeBarisImpor(
    { email: "budi@contoh.com", namaDipakai: "Budi Santoso" },
    FORMULIR_TIDAK_ADA
  );
  assert.deepEqual(baris, ["budi@contoh.com", "Budi Santoso"]);
});

uji("petakanNiatDukunganKeBarisImpor: panjang & urutan baris SAMA PERSIS dengan headerTemplatImporCsv() (formulir tanpa kolom tambahan)", () => {
  const header = headerTemplatImporCsv(FORMULIR_TIDAK_ADA);
  const baris = petakanNiatDukunganKeBarisImpor(
    { email: "budi@contoh.com", namaDipakai: "Budi Santoso" },
    FORMULIR_TIDAK_ADA
  );
  assert.equal(baris.length, header.length);
});

uji("petakanNiatDukunganKeBarisImpor: kolom tambahan (institusi wajib, nomorIdentitas opsional) dikosongkan, BUKAN dikarang — panjang tetap sama dengan header", () => {
  const header = headerTemplatImporCsv(FORMULIR_CAMPURAN);
  const baris = petakanNiatDukunganKeBarisImpor(
    { email: "siti@contoh.com", namaDipakai: "Siti" },
    FORMULIR_CAMPURAN
  );
  assert.equal(baris.length, header.length);
  assert.deepEqual(baris, ["siti@contoh.com", "Siti", "", ""]);
});

uji("petakanNiatDukunganKeBarisImpor: namaDipakai kosong -> kolom nama ikut kosong, TIDAK dikarang dari mana pun", () => {
  const baris = petakanNiatDukunganKeBarisImpor(
    { email: "kosong@contoh.com", namaDipakai: "" },
    FORMULIR_TIDAK_ADA
  );
  assert.deepEqual(baris, ["kosong@contoh.com", ""]);
});

uji("petakanNiatDukunganKeBarisImpor: field lain pada item (nominal null, catatan, dll) sama sekali tidak memengaruhi hasil — hanya email & namaDipakai yang dibaca", () => {
  const itemLengkap = {
    id: "keg1__uid1",
    kegiatanId: "keg1",
    uid: "uid1",
    email: "andi@contoh.com",
    namaDipakai: "Andi",
    nominal: null,
    catatan: "",
    dibuatPada: "2026-01-01T00:00:00.000Z",
    dibuatOleh: "sendiri" as const,
    status: "tercatat" as const,
    alasanGagal: "",
    dikirimPada: null,
    jumlahKirim: 0,
  };
  const baris = petakanNiatDukunganKeBarisImpor(itemLengkap, FORMULIR_TIDAK_ADA);
  assert.deepEqual(baris, ["andi@contoh.com", "Andi"]);
});

// --- putuskanCatatanDukunganWajib(): fungsi murni gerbang #6 ---

uji("putuskanCatatanDukunganWajib: wajibCatatan false -> selalu BOLEH, apa pun punyaCatatan", () => {
  assert.equal(putuskanCatatanDukunganWajib({ wajibCatatan: false, punyaCatatan: false }).ok, true);
  assert.equal(putuskanCatatanDukunganWajib({ wajibCatatan: false, punyaCatatan: true }).ok, true);
});

uji("putuskanCatatanDukunganWajib: wajibCatatan true + punyaCatatan false -> DITOLAK", () => {
  const hasil = putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: false });
  assert.equal(hasil.ok, false);
  assert.equal(
    hasil.pesan,
    "Kode ini baru berlaku setelah Anda mengisi formulir dukungan pada kegiatan ini."
  );
});

uji("putuskanCatatanDukunganWajib: wajibCatatan true + punyaCatatan true -> BOLEH", () => {
  assert.equal(putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: true }).ok, true);
});

// --- putuskanAksesMandiri() + hasilCatatanDukungan: empat kasus persis diminta ---

uji("kode benar + wajibCatatan false + tanpa catatan -> BOLEH", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SAWERIA2026",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
    hasilBatasPemakaianKode: BATAS_PEMAKAIAN_KODE_OK,
    hasilCatatanDukungan: putuskanCatatanDukunganWajib({ wajibCatatan: false, punyaCatatan: false }),
  });
  assert.equal(hasil.ok, true, `Diharapkan BOLEH, dapat ditolak: ${hasil.pesan}`);
});

uji("kode benar + wajibCatatan true + tanpa catatan -> DITOLAK", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SAWERIA2026",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
    hasilBatasPemakaianKode: BATAS_PEMAKAIAN_KODE_OK,
    hasilCatatanDukungan: putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: false }),
  });
  assert.equal(hasil.ok, false);
  assert.equal(
    hasil.pesan,
    "Kode ini baru berlaku setelah Anda mengisi formulir dukungan pada kegiatan ini."
  );
});

uji("kode benar + wajibCatatan true + ada catatan -> BOLEH", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SAWERIA2026",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
    hasilBatasPemakaianKode: BATAS_PEMAKAIAN_KODE_OK,
    hasilCatatanDukungan: putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: true }),
  });
  assert.equal(hasil.ok, true, `Diharapkan BOLEH, dapat ditolak: ${hasil.pesan}`);
});

uji("kode salah + ada catatan -> DITOLAK (catatan tidak bisa menggantikan kode yang benar)", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "kode",
    kodeDimasukkan: "SALAH",
    kodeTersimpan: "SAWERIA2026",
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
    hasilBatasPemakaianKode: BATAS_PEMAKAIAN_KODE_OK,
    hasilCatatanDukungan: putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: true }),
  });
  assert.equal(hasil.ok, false);
  assert.equal(hasil.pesan, "Kode akses salah atau belum diisi.");
});

uji("caraMasuk 'terbuka' + wajibCatatan true tanpa catatan (diabaikan, hanya relevan untuk 'kode') -> tetap LOLOS", () => {
  const hasil = putuskanAksesMandiri({
    caraMasuk: "terbuka",
    kodeDimasukkan: "",
    kodeTersimpan: null,
    hasilKuotaKegiatan: KUOTA_OK,
    hasilBatasHarian: BATAS_HARIAN_OK,
    hasilBatasPemakaianKode: BATAS_PEMAKAIAN_KODE_OK,
    hasilCatatanDukungan: putuskanCatatanDukunganWajib({ wajibCatatan: true, punyaCatatan: false }),
  });
  assert.equal(hasil.ok, true, `hasilCatatanDukungan hanya relevan untuk caraMasuk 'kode': ${hasil.pesan}`);
});

// --- templatEmailKodeAkses(): fungsi murni, tidak boleh bocor data peserta lain ---

uji("templatEmailKodeAkses: isiTeks memuat nama kegiatan dan kode", () => {
  const templat = templatEmailKodeAkses("Budi", "Diklat Penulisan 2026", "SAWERIA-XYZ");
  assert.match(templat.isiTeks, /Diklat Penulisan 2026/);
  assert.match(templat.isiTeks, /SAWERIA-XYZ/);
});

uji("templatEmailKodeAkses: isiHtml memuat nama kegiatan dan kode", () => {
  const templat = templatEmailKodeAkses("Budi", "Diklat Penulisan 2026", "SAWERIA-XYZ");
  assert.match(templat.isiHtml, /Diklat Penulisan 2026/);
  assert.match(templat.isiHtml, /SAWERIA-XYZ/);
});

uji("templatEmailKodeAkses: subjek memuat nama kegiatan", () => {
  const templat = templatEmailKodeAkses("Budi", "Diklat Penulisan 2026", "SAWERIA-XYZ");
  assert.match(templat.subjek, /Diklat Penulisan 2026/);
});

uji("templatEmailKodeAkses: HANYA tiga parameter (nama, judul, kode) — tidak ada jalur untuk data peserta lain ikut serta, dua pemanggilan dengan data berbeda tidak saling membocorkan isi", () => {
  const a = templatEmailKodeAkses("Andi", "Kegiatan A", "KODE-A");
  const b = templatEmailKodeAkses("Siti", "Kegiatan B", "KODE-B");
  assert.doesNotMatch(a.isiTeks, /Siti|Kegiatan B|KODE-B/);
  assert.doesNotMatch(b.isiTeks, /Andi|Kegiatan A|KODE-A/);
});

uji("templatEmailKodeAkses: nama penerima kosong -> jatuh ke 'Pendukung', tidak melempar", () => {
  const templat = templatEmailKodeAkses("   ", "Kegiatan", "KODE");
  assert.match(templat.isiTeks, /Pendukung/);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
