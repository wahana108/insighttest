/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji tentukanJenisSertifikat() (src/lib/sertifikat-syarat.ts) sebagai
 * fungsi murni, plus dua "bawaan" terkait Slice 6.3: mapSyaratSertifikat()
 * (kegiatan lama tanpa field terbitkanKeikutsertaan) dan
 * buildSertifikatDetail() (sertifikat lama tanpa field jenis). Pakai
 * node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-jenis-sertifikat.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { buildSertifikatDetail } from "../src/lib/api/sertifikat-server";
import {
  evaluasiKelayakan,
  putuskanPenerbitan,
  tentukanJenisSertifikat,
} from "../src/lib/sertifikat-syarat";
import type { HasilModul, ModulSnapshotItem } from "../src/types/pendaftaran";
import type { SyaratSertifikat } from "../src/types/kegiatan";

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

// ---------------------------------------------------------------------
// tentukanJenisSertifikat() — langsung, tujuh kasus yang diminta.
// ---------------------------------------------------------------------

uji("tentukanJenisSertifikat: layak + parameter MATI -> kelulusan", () => {
  const hasil = tentukanJenisSertifikat(true, true, false);
  assert.equal(hasil.bolehTerbit, true);
  assert.equal(hasil.jenis, "kelulusan");
});

uji("tentukanJenisSertifikat: layak + parameter NYALA -> TETAP kelulusan (admin tidak bisa menurunkan)", () => {
  const hasil = tentukanJenisSertifikat(true, true, true);
  assert.equal(hasil.bolehTerbit, true);
  assert.equal(hasil.jenis, "kelulusan");
});

uji("tentukanJenisSertifikat: tidak layak + parameter MATI -> tidak boleh terbit (persis perilaku sekarang)", () => {
  const hasil = tentukanJenisSertifikat(true, false, false);
  assert.equal(hasil.bolehTerbit, false);
  assert.equal(hasil.jenis, null);
});

uji("tentukanJenisSertifikat: tidak layak + parameter NYALA -> keikutsertaan", () => {
  const hasil = tentukanJenisSertifikat(true, false, true);
  assert.equal(hasil.bolehTerbit, true);
  assert.equal(hasil.jenis, "keikutsertaan");
});

uji("tentukanJenisSertifikat: BELUM TERDAFTAR -> tidak boleh terbit SELAMANYA, apa pun parameter lain", () => {
  assert.equal(tentukanJenisSertifikat(false, true, true).bolehTerbit, false);
  assert.equal(tentukanJenisSertifikat(false, true, true).jenis, null);
  assert.equal(tentukanJenisSertifikat(false, false, false).bolehTerbit, false);
  assert.equal(tentukanJenisSertifikat(false, false, true).bolehTerbit, false);
});

uji("tentukanJenisSertifikat: admin TIDAK BISA menaikkan yang tidak layak jadi kelulusan (parameter nyala tetap keikutsertaan, tidak kelulusan)", () => {
  const hasil = tentukanJenisSertifikat(true, false, true);
  assert.notEqual(hasil.jenis, "kelulusan");
  assert.equal(hasil.jenis, "keikutsertaan");
});

// ---------------------------------------------------------------------
// Kegiatan lama tanpa field terbitkanKeikutsertaan -> bawaan false.
// ---------------------------------------------------------------------

function syaratUntukKegiatanLama(): SyaratSertifikat {
  // Meniru kegiatan/{id}.syaratSertifikat SEBELUM Slice 6.3 — field ini
  // secara harfiah tidak ada pada dokumennya.
  const dataLama = {
    jenis: "nilai_minimum",
    nilaiMinimum: 70,
    wajibBukaReferensi: false,
    atestasiJadiSyarat: false,
  } as Record<string, unknown>;
  return {
    jenis: dataLama.jenis as "nilai_minimum",
    nilaiMinimum: dataLama.nilaiMinimum as number,
    wajibBukaReferensi: dataLama.wajibBukaReferensi as boolean,
    atestasiJadiSyarat: dataLama.atestasiJadiSyarat as boolean,
    // Baris di bawah PERSIS logika mapSyaratSertifikat() di
    // src/lib/services/kegiatan.ts — didemonstrasikan di sini (bukan
    // import langsung, fungsi itu memakai firebase/firestore klien).
    terbitkanKeikutsertaan:
      typeof dataLama.terbitkanKeikutsertaan === "boolean" ? dataLama.terbitkanKeikutsertaan : false,
  };
}

uji("kegiatan lama tanpa field terbitkanKeikutsertaan -> bawaan false, tidak melempar", () => {
  const syarat = syaratUntukKegiatanLama();
  assert.equal(syarat.terbitkanKeikutsertaan, false);
});

uji("integrasi: kegiatan lama (bawaan terbitkanKeikutsertaan=false) + peserta tidak layak -> tidak boleh terbit, PERSIS perilaku sebelum Slice 6.3", () => {
  const syarat = syaratUntukKegiatanLama();
  const modulSnapshot: ModulSnapshotItem[] = [
    {
      modulId: "eval-1",
      judul: "Evaluasi Satu",
      kategori: "evaluasi",
      wajib: true,
      nilaiMinimum: 70,
      ambangKeterlibatan: null,
      targetSkor: null,
      durasiDetik: null,
    },
  ];
  const hasilModul: Record<string, HasilModul> = {
    "eval-1": { skorTertinggi: 40, lulus: false, percobaan: 1, kedaluwarsa: false },
  };
  const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
    { modulSnapshot, hasilModul, referensiDibuka: [], atestasi: {} },
    { syaratSertifikat: syarat }
  );
  const keputusan = putuskanPenerbitan(syarat.jenis, { kelayakan, prasyaratMateri });
  const hasilJenis = tentukanJenisSertifikat(true, keputusan.bisaTerbit, syarat.terbitkanKeikutsertaan);
  assert.equal(hasilJenis.bolehTerbit, false);
  assert.equal(hasilJenis.jenis, null);
});

// ---------------------------------------------------------------------
// Sertifikat lama tanpa field jenis -> bawaan 'kelulusan'.
// ---------------------------------------------------------------------

uji("sertifikat lama tanpa field jenis -> buildSertifikatDetail() membaca sebagai 'kelulusan', tidak melempar", () => {
  const dataLama = {
    serial: "KEG-1/2026/0001",
    kodeVerifikasi: "ABCDEF1234",
    namaLengkap: "Peserta Lama",
    judulKegiatan: "Kegiatan Lama",
    // 'jenis' SENGAJA tidak ada — meniru dokumen dari sebelum Slice 6.3.
    nilaiAkhir: 88,
    items: [],
    pernyataanAtestasi: [],
    status: "berlaku",
    terbitPada: "2026-01-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => buildSertifikatDetail("sert-1", "keg-1", dataLama, {}));
  const detail = buildSertifikatDetail("sert-1", "keg-1", dataLama, {});
  assert.equal(detail.jenis, "kelulusan");
});

uji("sertifikat BARU dengan field jenis 'keikutsertaan' -> buildSertifikatDetail() membacanya apa adanya", () => {
  const data = {
    serial: "KEG-1/2026/0002",
    kodeVerifikasi: "GHIJKL5678",
    namaLengkap: "Peserta Baru",
    judulKegiatan: "Kegiatan Baru",
    jenis: "keikutsertaan",
    nilaiAkhir: 40,
    items: [],
    pernyataanAtestasi: [],
    status: "berlaku",
    terbitPada: "2026-09-01T00:00:00.000Z",
  };
  const detail = buildSertifikatDetail("sert-2", "keg-1", data, {});
  assert.equal(detail.jenis, "keikutsertaan");
});

uji("field jenis rusak (bukan 'kelulusan'/'keikutsertaan') -> buildSertifikatDetail() jatuh ke 'kelulusan', tidak melempar", () => {
  const data = {
    serial: "KEG-1/2026/0003",
    kodeVerifikasi: "MNOPQR9012",
    namaLengkap: "Peserta",
    judulKegiatan: "Kegiatan",
    jenis: "entah-apa",
    nilaiAkhir: 0,
    items: [],
    pernyataanAtestasi: [],
    status: "berlaku",
    terbitPada: "2026-09-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => buildSertifikatDetail("sert-3", "keg-1", data, {}));
  assert.equal(buildSertifikatDetail("sert-3", "keg-1", data, {}).jenis, "kelulusan");
});

// ---------------------------------------------------------------------
// Integrasi manual_admin — bisaTerbit SELALU true, jenis SELALU kelulusan,
// terbitkanKeikutsertaan tidak pernah relevan di mode ini.
// ---------------------------------------------------------------------

uji("integrasi: mode manual_admin -> bisaTerbit selalu true -> jenis SELALU kelulusan, terlepas dari terbitkanKeikutsertaan", () => {
  const syaratMati: SyaratSertifikat = {
    jenis: "manual_admin",
    nilaiMinimum: 0,
    wajibBukaReferensi: false,
    atestasiJadiSyarat: false,
    terbitkanKeikutsertaan: false,
  };
  const syaratNyala: SyaratSertifikat = { ...syaratMati, terbitkanKeikutsertaan: true };
  const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
    { modulSnapshot: [], hasilModul: {}, referensiDibuka: [], atestasi: {} },
    { syaratSertifikat: syaratMati }
  );
  const keputusan = putuskanPenerbitan("manual_admin", { kelayakan, prasyaratMateri });
  assert.equal(keputusan.bisaTerbit, true, "manual_admin selalu bisaTerbit true");
  assert.equal(
    tentukanJenisSertifikat(true, keputusan.bisaTerbit, syaratMati.terbitkanKeikutsertaan).jenis,
    "kelulusan"
  );
  assert.equal(
    tentukanJenisSertifikat(true, keputusan.bisaTerbit, syaratNyala.terbitkanKeikutsertaan).jenis,
    "kelulusan"
  );
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
