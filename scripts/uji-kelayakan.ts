/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji evaluasiKelayakan() (src/lib/sertifikat-syarat.ts) sebagai fungsi
 * murni: tanpa Firestore, tanpa browser. Pakai node:assert saja, tidak ada
 * framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-kelayakan.ts
 */
import assert from "node:assert/strict";
import { evaluasiKelayakan } from "../src/lib/sertifikat-syarat";
import type { SyaratSertifikat } from "../src/types/kegiatan";
import type { HasilModul, ModulSnapshotItem } from "../src/types/pendaftaran";

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

function modulEvaluasi(modulId: string, wajib = true): ModulSnapshotItem {
  return { modulId, judul: modulId, kategori: "evaluasi", wajib, nilaiMinimum: 70 };
}

function modulReferensi(modulId: string, wajib = true): ModulSnapshotItem {
  return { modulId, judul: modulId, kategori: "referensi", wajib, nilaiMinimum: null };
}

function hasil(skorTertinggi: number, lulusFlag: boolean): HasilModul {
  return { skorTertinggi, lulus: lulusFlag, percobaan: 1 };
}

function syarat(override: Partial<SyaratSertifikat> = {}): SyaratSertifikat {
  return { jenis: "nilai_minimum", nilaiMinimum: 70, wajibBukaReferensi: false, ...override };
}

uji(
  "wajibBukaReferensi=false, referensi belum dibuka, evaluasi lulus → layak (fitur baru tidak mengubah perilaku lama)",
  () => {
    const hasilKelayakan = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1")],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: false }) }
    );
    assert.equal(
      hasilKelayakan.status,
      "layak",
      `Diharapkan status "layak" karena wajibBukaReferensi=false, dapat "${hasilKelayakan.status}" (alasan: ${hasilKelayakan.alasan})`
    );
    assert.equal(hasilKelayakan.layak, true, "Diharapkan layak=true");
  }
);

uji(
  "wajibBukaReferensi=true, 2 referensi wajib, referensiDibuka=[] → belum_layak, alasan menyebut angka 2",
  () => {
    const hasilKelayakan = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      hasilKelayakan.status,
      "belum_layak",
      `Diharapkan status "belum_layak" karena 2 referensi wajib belum dibuka sama sekali, dapat "${hasilKelayakan.status}"`
    );
    assert.ok(
      hasilKelayakan.alasan.includes("2"),
      `Diharapkan alasan menyebut angka 2 (jumlah referensi wajib yang belum dibuka), dapat: "${hasilKelayakan.alasan}"`
    );
  }
);

uji(
  "sama, referensiDibuka berisi satu → belum_layak, alasan menyebut angka 1",
  () => {
    const hasilKelayakan = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: ["ref1"],
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      hasilKelayakan.status,
      "belum_layak",
      `Diharapkan status "belum_layak" karena masih 1 dari 2 referensi wajib belum dibuka, dapat "${hasilKelayakan.status}"`
    );
    assert.ok(
      hasilKelayakan.alasan.includes("1"),
      `Diharapkan alasan menyebut angka 1 (jumlah referensi wajib yang belum dibuka), dapat: "${hasilKelayakan.alasan}"`
    );
  }
);

uji("sama, keduanya dibuka → layak", () => {
  const hasilKelayakan = evaluasiKelayakan(
    {
      modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
      hasilModul: { ev1: hasil(100, true) },
      referensiDibuka: ["ref1", "ref2"],
    },
    { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
  );
  assert.equal(
    hasilKelayakan.status,
    "layak",
    `Diharapkan status "layak" setelah kedua referensi wajib tercatat dibuka, dapat "${hasilKelayakan.status}" (alasan: ${hasilKelayakan.alasan})`
  );
  assert.equal(hasilKelayakan.layak, true, "Diharapkan layak=true");
});

uji(
  "wajibBukaReferensi=true, referensi ada tapi semuanya opsional, belum dibuka → layak (yang opsional tidak dihitung)",
  () => {
    const hasilKelayakan = evaluasiKelayakan(
      {
        modulSnapshot: [
          modulEvaluasi("ev1"),
          modulReferensi("ref1", false),
          modulReferensi("ref2", false),
        ],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      hasilKelayakan.status,
      "layak",
      `Diharapkan status "layak" karena modul referensi yang ada semuanya opsional (wajib=false), dapat "${hasilKelayakan.status}" (alasan: ${hasilKelayakan.alasan})`
    );
  }
);

uji(
  "referensiDibuka tidak ada sama sekali pada dokumen pendaftaran (undefined, seperti pendaftaran lama) → tidak melempar, diperlakukan sebagai daftar kosong",
  () => {
    const pendaftaranLegacy = {
      modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1")],
      hasilModul: { ev1: hasil(100, true) },
      referensiDibuka: undefined,
    } as unknown as Parameters<typeof evaluasiKelayakan>[0];

    let hasilKelayakan: ReturnType<typeof evaluasiKelayakan>;
    try {
      hasilKelayakan = evaluasiKelayakan(pendaftaranLegacy, {
        syaratSertifikat: syarat({ wajibBukaReferensi: true }),
      });
    } catch (err) {
      throw new Error(
        `Diharapkan evaluasiKelayakan() TIDAK melempar error walau referensiDibuka tidak ada pada dokumen (pendaftaran lama, sebelum field ini ada) — tapi melempar: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    assert.equal(
      hasilKelayakan.status,
      "belum_layak",
      `referensiDibuka undefined harus diperlakukan sebagai daftar kosong — dengan 1 referensi wajib yang berarti belum tercatat dibuka, diharapkan status "belum_layak", dapat "${hasilKelayakan.status}"`
    );
  }
);

uji(
  "wajibBukaReferensi=true, semua referensi dibuka tapi evaluasi belum lulus → tetap belum_layak dengan alasan nilai, bukan alasan referensi",
  () => {
    const hasilKelayakan = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1")],
        hasilModul: { ev1: hasil(40, false) },
        referensiDibuka: ["ref1"],
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      hasilKelayakan.status,
      "belum_layak",
      `Diharapkan status "belum_layak" karena evaluasi belum lulus, dapat "${hasilKelayakan.status}"`
    );
    assert.ok(
      hasilKelayakan.alasan.startsWith("Belum lulus modul:"),
      `Diharapkan alasan tentang modul yang belum lulus (gerbang evaluasi harus diperiksa SEBELUM gerbang referensi, urutannya tidak boleh tertukar), dapat: "${hasilKelayakan.alasan}"`
    );
  }
);

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
