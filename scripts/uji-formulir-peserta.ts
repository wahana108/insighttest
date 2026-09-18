/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji mapFormulirPeserta(), periksaFormulirPeserta(), dan
 * putuskanIdentitasPendaftaran() (src/lib/formulir-peserta.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-formulir-peserta.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  FORMULIR_PESERTA_DEFAULT,
  mapFormulirPeserta,
  periksaFormulirPeserta,
  putuskanIdentitasPendaftaran,
} from "../src/lib/formulir-peserta";
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

function semuaTidak(): FormulirPeserta {
  return {
    institusi: "tidak",
    nomorIdentitas: "tidak",
    noTelepon: "tidak",
    bolehDilengkapiSendiri: false,
  };
}

const DATA_KOSONG = { institusi: "", nomorIdentitas: "", noTelepon: "" };
const DATA_TERISI = { institusi: "Dinas A", nomorIdentitas: "12345", noTelepon: "0812" };

// --- mapFormulirPeserta(): kegiatan lama tanpa field sama sekali ---

uji("kegiatan tanpa formulirPeserta sama sekali (undefined) → default 'tidak' untuk ketiganya", () => {
  assert.deepEqual(mapFormulirPeserta(undefined), FORMULIR_PESERTA_DEFAULT);
  assert.deepEqual(FORMULIR_PESERTA_DEFAULT, semuaTidak());
});

uji("formulirPeserta null → default 'tidak' untuk ketiganya, tidak melempar", () => {
  assert.doesNotThrow(() => mapFormulirPeserta(null));
  assert.deepEqual(mapFormulirPeserta(null), semuaTidak());
});

uji("formulirPeserta bukan objek (rusak) → default 'tidak' untuk ketiganya, tidak melempar", () => {
  assert.doesNotThrow(() => mapFormulirPeserta("bukan-objek"));
  assert.deepEqual(mapFormulirPeserta("bukan-objek"), semuaTidak());
});

uji("formulirPeserta dengan nilai tidak dikenal per field → jatuh ke 'tidak' per field", () => {
  assert.deepEqual(
    mapFormulirPeserta({ institusi: "rusak", nomorIdentitas: "wajib", noTelepon: 123 }),
    { institusi: "tidak", nomorIdentitas: "wajib", noTelepon: "tidak", bolehDilengkapiSendiri: false }
  );
});

uji("formulirPeserta lengkap dan sah → dipetakan apa adanya", () => {
  const nilai: FormulirPeserta = {
    institusi: "wajib",
    nomorIdentitas: "opsional",
    noTelepon: "tidak",
    bolehDilengkapiSendiri: true,
  };
  assert.deepEqual(mapFormulirPeserta(nilai), nilai);
});

uji("formulirPeserta.bolehDilengkapiSendiri: nilai bukan boolean sah (mis. string) → default false, tidak melempar", () => {
  assert.equal(
    mapFormulirPeserta({ bolehDilengkapiSendiri: "true" }).bolehDilengkapiSendiri,
    false
  );
});

// --- periksaFormulirPeserta(): tiap field, tiap dari tiga keadaan, kosong/terisi ---

for (const field of ["institusi", "nomorIdentitas", "noTelepon"] as const) {
  for (const status of ["tidak", "opsional", "wajib"] as const) {
    const formulirPeserta: FormulirPeserta = { ...semuaTidak(), [field]: status };

    uji(`${field}='${status}', data kosong → ${status === "wajib" ? "DITOLAK" : "diterima"}`, () => {
      const hasil = periksaFormulirPeserta(formulirPeserta, DATA_KOSONG);
      if (status === "wajib") {
        assert.equal(hasil.valid, false);
        assert.equal(hasil.field, field);
        assert.ok(hasil.pesan && hasil.pesan.length > 0);
      } else {
        assert.equal(hasil.valid, true);
      }
    });

    uji(`${field}='${status}', data terisi → diterima`, () => {
      const hasil = periksaFormulirPeserta(formulirPeserta, DATA_TERISI);
      assert.equal(hasil.valid, true);
    });
  }
}

// --- Kegiatan lama tanpa field sama sekali, dijalankan lewat alur penuh ---

uji("kegiatan lama (mapFormulirPeserta(undefined)) + peserta tanpa data apa pun → tetap diterima", () => {
  const hasil = periksaFormulirPeserta(mapFormulirPeserta(undefined), DATA_KOSONG);
  assert.equal(hasil.valid, true);
});

// --- Gabungan ---

uji("gabungan: institusi wajib terisi, nomorIdentitas wajib kosong, noTelepon opsional kosong → DITOLAK pada nomorIdentitas", () => {
  const formulirPeserta: FormulirPeserta = {
    institusi: "wajib",
    nomorIdentitas: "wajib",
    noTelepon: "opsional",
    bolehDilengkapiSendiri: false,
  };
  const hasil = periksaFormulirPeserta(formulirPeserta, {
    institusi: "Dinas A",
    nomorIdentitas: "",
    noTelepon: "",
  });
  assert.equal(hasil.valid, false);
  assert.equal(hasil.field, "nomorIdentitas");
});

uji("gabungan: ketiganya wajib, ketiganya terisi → diterima", () => {
  const formulirPeserta: FormulirPeserta = {
    institusi: "wajib",
    nomorIdentitas: "wajib",
    noTelepon: "wajib",
    bolehDilengkapiSendiri: false,
  };
  const hasil = periksaFormulirPeserta(formulirPeserta, DATA_TERISI);
  assert.equal(hasil.valid, true);
});

uji("gabungan: ketiganya wajib, ketiganya kosong → DITOLAK pada institusi (urutan pertama)", () => {
  const formulirPeserta: FormulirPeserta = {
    institusi: "wajib",
    nomorIdentitas: "wajib",
    noTelepon: "wajib",
    bolehDilengkapiSendiri: false,
  };
  const hasil = periksaFormulirPeserta(formulirPeserta, DATA_KOSONG);
  assert.equal(hasil.valid, false);
  assert.equal(hasil.field, "institusi");
});

uji("gabungan: nilai berisi hanya spasi dianggap kosong (trim)", () => {
  const formulirPeserta: FormulirPeserta = { ...semuaTidak(), noTelepon: "wajib" };
  const hasil = periksaFormulirPeserta(formulirPeserta, { ...DATA_KOSONG, noTelepon: "   " });
  assert.equal(hasil.valid, false);
  assert.equal(hasil.field, "noTelepon");
});

// --- putuskanIdentitasPendaftaran(): gerbang Slice "lengkapi-sendiri" (6f) ---

const FORMULIR_INSTITUSI_WAJIB: FormulirPeserta = {
  institusi: "wajib",
  nomorIdentitas: "tidak",
  noTelepon: "tidak",
  bolehDilengkapiSendiri: true,
};
const FORMULIR_DUA_WAJIB: FormulirPeserta = {
  institusi: "wajib",
  nomorIdentitas: "wajib",
  noTelepon: "opsional",
  bolehDilengkapiSendiri: true,
};

uji("putuskanIdentitasPendaftaran: identitasBelumLengkap undefined (dokumen lama) -> lengkap, TANPA pemeriksaan apa pun", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: undefined,
    formulirPeserta: FORMULIR_DUA_WAJIB,
    profil: DATA_KOSONG,
  });
  assert.equal(hasil.lengkap, true);
  assert.deepEqual(hasil.kurang, []);
  assert.equal(hasil.pesan, null);
});

uji("putuskanIdentitasPendaftaran: identitasBelumLengkap false -> lengkap walau profil kosong", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: false,
    formulirPeserta: FORMULIR_DUA_WAJIB,
    profil: DATA_KOSONG,
  });
  assert.equal(hasil.lengkap, true);
  assert.deepEqual(hasil.kurang, []);
});

uji("putuskanIdentitasPendaftaran: true + profil lengkap -> lengkap", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: true,
    formulirPeserta: FORMULIR_INSTITUSI_WAJIB,
    profil: DATA_TERISI,
  });
  assert.equal(hasil.lengkap, true);
  assert.deepEqual(hasil.kurang, []);
  assert.equal(hasil.pesan, null);
});

uji("putuskanIdentitasPendaftaran: true + institusi wajib tapi kosong -> TIDAK lengkap, menyebut institusi", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: true,
    formulirPeserta: FORMULIR_INSTITUSI_WAJIB,
    profil: DATA_KOSONG,
  });
  assert.equal(hasil.lengkap, false);
  assert.deepEqual(hasil.kurang, ["institusi"]);
  assert.ok(hasil.pesan?.includes("Institusi"));
});

uji("putuskanIdentitasPendaftaran: true + dua kolom wajib kosong -> menyebut KEDUANYA", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: true,
    formulirPeserta: FORMULIR_DUA_WAJIB,
    profil: DATA_KOSONG,
  });
  assert.equal(hasil.lengkap, false);
  assert.deepEqual(hasil.kurang, ["institusi", "nomorIdentitas"]);
  assert.ok(hasil.pesan?.includes("Institusi"));
  assert.ok(hasil.pesan?.includes("Nomor identitas"));
});

uji("putuskanIdentitasPendaftaran: true + kolom 'opsional' kosong -> tetap lengkap (opsional tidak pernah menolak)", () => {
  const hasil = putuskanIdentitasPendaftaran({
    identitasBelumLengkap: true,
    // noTelepon 'opsional' di FORMULIR_DUA_WAJIB — kosongkan institusi DAN
    // nomorIdentitas (wajib, jadi harus terisi di kasus ini) tapi biarkan
    // noTelepon kosong untuk memastikan 'opsional' tidak ikut ditolak.
    formulirPeserta: FORMULIR_DUA_WAJIB,
    profil: { institusi: "Dinas A", nomorIdentitas: "12345", noTelepon: "" },
  });
  assert.equal(hasil.lengkap, true);
  assert.deepEqual(hasil.kurang, []);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
