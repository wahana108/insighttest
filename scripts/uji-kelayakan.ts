/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji evaluasiKelayakan() (src/lib/sertifikat-syarat.ts) sebagai fungsi
 * murni: tanpa Firestore, tanpa browser. Pakai node:assert saja, tidak ada
 * framework tes baru.
 *
 * Slice 7.4 §3: evaluasiKelayakan() sekarang mengembalikan DUA hal
 * terpisah — { kelayakan, prasyaratMateri } — bukan satu objek gabungan
 * seperti sebelumnya. Berkas ini menguji keduanya: kelayakan (murni soal
 * nilai) dan prasyaratMateri (keadaan referensi/atestasi wajib, SELALU
 * dihitung terlepas dari kelayakan). Kasus atestasiJadiSyarat dan aturan
 * penerbitan mode otomatis/manual ada di scripts/uji-atestasi.ts.
 *
 * Jalankan: npx tsx scripts/uji-kelayakan.ts
 */
import assert from "node:assert/strict";
import {
  deskripsiPrasyaratMateri,
  evaluasiKelayakan,
  statusPrasyaratMateri,
} from "../src/lib/sertifikat-syarat";
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
  return {
    modulId,
    judul: modulId,
    kategori: "evaluasi",
    wajib,
    nilaiMinimum: 70,
    ambangKeterlibatan: null,
    targetSkor: null,
    durasiDetik: null,
  };
}

function modulReferensi(modulId: string, wajib = true): ModulSnapshotItem {
  return {
    modulId,
    judul: modulId,
    kategori: "referensi",
    wajib,
    nilaiMinimum: null,
    ambangKeterlibatan: null,
    targetSkor: null,
    durasiDetik: null,
  };
}

function hasil(skorTertinggi: number, lulusFlag: boolean, kedaluwarsa = false): HasilModul {
  return { skorTertinggi, lulus: lulusFlag, percobaan: 1, kedaluwarsa };
}

function syarat(override: Partial<SyaratSertifikat> = {}): SyaratSertifikat {
  return {
    jenis: "nilai_minimum",
    nilaiMinimum: 70,
    wajibBukaReferensi: false,
    atestasiJadiSyarat: false,
    terbitkanKeikutsertaan: false,
    ...override,
  };
}

uji(
  "wajibBukaReferensi=false, referensi belum dibuka, evaluasi lulus → kelayakan layak DAN prasyaratMateri tuntas (fitur baru tidak mengubah perilaku lama)",
  () => {
    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1")],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: false }) }
    );
    assert.equal(
      kelayakan.status,
      "layak",
      `Diharapkan status "layak", dapat "${kelayakan.status}" (alasan: ${kelayakan.alasan})`
    );
    assert.equal(kelayakan.layak, true, "Diharapkan layak=true");
    assert.equal(
      prasyaratMateri.tuntas,
      true,
      "wajibBukaReferensi=false berarti referensi tidak pernah menahan prasyaratMateri.tuntas, apa pun isi referensiDibuka"
    );
    assert.equal(
      statusPrasyaratMateri(prasyaratMateri),
      "belum_tuntas_tidak_menghalangi",
      `Slice 7.6: referensi wajib NYATANYA belum dibuka walau gerbangnya mati — status harus membedakan ini dari "tuntas" sungguhan, dapat "${statusPrasyaratMateri(prasyaratMateri)}"`
    );
    const deskripsi = deskripsiPrasyaratMateri(prasyaratMateri);
    assert.notEqual(
      deskripsi,
      "Semua materi wajib sudah tuntas.",
      `Slice 7.6: TIDAK BOLEH mengklaim "tuntas" ketika gerbangnya mati tapi modul wajib nyatanya belum — dapat: "${deskripsi}"`
    );
    assert.equal(
      deskripsi,
      "Gerbang referensi tidak aktif — 1 dari 1 modul referensi wajib belum dibuka, tapi tidak menghalangi penerbitan.",
      `Diharapkan kalimat keadaan ketiga sesuai contoh Slice 7.6, dapat: "${deskripsi}"`
    );
  }
);

uji(
  "wajibBukaReferensi=true, 2 referensi wajib, referensiDibuka=[] → kelayakan TETAP layak (nilai independen dari materi), prasyaratMateri belum tuntas, angka 2",
  () => {
    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      kelayakan.status,
      "layak",
      `Slice 7.4: kelayakan HANYA soal nilai — referensi belum dibuka tidak lagi membuatnya belum_layak, dapat "${kelayakan.status}"`
    );
    assert.equal(
      prasyaratMateri.tuntas,
      false,
      "Diharapkan prasyaratMateri.tuntas=false karena 2 referensi wajib belum dibuka sama sekali"
    );
    assert.equal(
      prasyaratMateri.referensiBelumDibuka,
      2,
      `Diharapkan referensiBelumDibuka=2, dapat ${prasyaratMateri.referensiBelumDibuka}`
    );
    assert.equal(
      prasyaratMateri.referensiWajibTotal,
      2,
      `Diharapkan referensiWajibTotal=2, dapat ${prasyaratMateri.referensiWajibTotal}`
    );
  }
);

uji("sama, referensiDibuka berisi satu → referensiBelumDibuka=1, prasyaratMateri belum tuntas", () => {
  const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
    {
      modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
      hasilModul: { ev1: hasil(100, true) },
      referensiDibuka: ["ref1"],
      atestasi: {},
    },
    { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
  );
  assert.equal(kelayakan.status, "layak", `Diharapkan kelayakan "layak", dapat "${kelayakan.status}"`);
  assert.equal(
    prasyaratMateri.tuntas,
    false,
    "Diharapkan prasyaratMateri.tuntas=false karena masih 1 dari 2 referensi wajib belum dibuka"
  );
  assert.equal(
    prasyaratMateri.referensiBelumDibuka,
    1,
    `Diharapkan referensiBelumDibuka=1, dapat ${prasyaratMateri.referensiBelumDibuka}`
  );
});

uji("sama, keduanya dibuka → prasyaratMateri tuntas", () => {
  const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
    {
      modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1"), modulReferensi("ref2")],
      hasilModul: { ev1: hasil(100, true) },
      referensiDibuka: ["ref1", "ref2"],
      atestasi: {},
    },
    { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
  );
  assert.equal(kelayakan.status, "layak", `Diharapkan kelayakan "layak", dapat "${kelayakan.status}"`);
  assert.equal(kelayakan.layak, true, "Diharapkan layak=true");
  assert.equal(
    prasyaratMateri.tuntas,
    true,
    `Diharapkan prasyaratMateri.tuntas=true setelah kedua referensi wajib tercatat dibuka, dapat referensiBelumDibuka=${prasyaratMateri.referensiBelumDibuka}`
  );
});

uji(
  "wajibBukaReferensi=true, referensi ada tapi semuanya opsional, belum dibuka → prasyaratMateri tuntas (yang opsional tidak dihitung)",
  () => {
    const { prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [
          modulEvaluasi("ev1"),
          modulReferensi("ref1", false),
          modulReferensi("ref2", false),
        ],
        hasilModul: { ev1: hasil(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      prasyaratMateri.referensiWajibTotal,
      0,
      `Diharapkan referensiWajibTotal=0 karena modul referensi yang ada semuanya opsional (wajib=false), dapat ${prasyaratMateri.referensiWajibTotal}`
    );
    assert.equal(
      prasyaratMateri.tuntas,
      true,
      "Diharapkan prasyaratMateri.tuntas=true karena tidak ada referensi WAJIB yang dihitung"
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
      atestasi: undefined,
    } as unknown as Parameters<typeof evaluasiKelayakan>[0];

    let hasilEvaluasi: ReturnType<typeof evaluasiKelayakan>;
    try {
      hasilEvaluasi = evaluasiKelayakan(pendaftaranLegacy, {
        syaratSertifikat: syarat({ wajibBukaReferensi: true }),
      });
    } catch (err) {
      throw new Error(
        `Diharapkan evaluasiKelayakan() TIDAK melempar error walau referensiDibuka/atestasi tidak ada pada dokumen (pendaftaran lama, sebelum field-field ini ada) — tapi melempar: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    assert.equal(
      hasilEvaluasi.prasyaratMateri.tuntas,
      false,
      "referensiDibuka undefined harus diperlakukan sebagai daftar kosong — dengan 1 referensi wajib, diharapkan prasyaratMateri.tuntas=false"
    );
    assert.equal(
      hasilEvaluasi.prasyaratMateri.referensiBelumDibuka,
      1,
      `Diharapkan referensiBelumDibuka=1, dapat ${hasilEvaluasi.prasyaratMateri.referensiBelumDibuka}`
    );
  }
);

uji(
  "wajibBukaReferensi=true, semua referensi dibuka tapi evaluasi belum lulus → kelayakan belum_layak dengan alasan nilai; prasyaratMateri tetap tuntas (dua hal independen)",
  () => {
    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulReferensi("ref1")],
        hasilModul: { ev1: hasil(40, false) },
        referensiDibuka: ["ref1"],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ wajibBukaReferensi: true }) }
    );
    assert.equal(
      kelayakan.status,
      "belum_layak",
      `Diharapkan status "belum_layak" karena evaluasi belum lulus, dapat "${kelayakan.status}"`
    );
    assert.ok(
      kelayakan.alasan.startsWith("Belum lulus modul:"),
      `Diharapkan alasan tentang modul yang belum lulus, dapat: "${kelayakan.alasan}"`
    );
    assert.equal(
      prasyaratMateri.tuntas,
      true,
      "referensi sudah dibuka semua — prasyaratMateri.tuntas harus true TERLEPAS dari kelayakan.status (dua hal terpisah, Slice 7.4 §3)"
    );
  }
);

// ---------------------------------------------------------------------
// Slice "ujian-berwaktu" §BAGIAN b — hasil kedaluwarsa TIDAK melayakkan
// otomatis, walau skornya di atas ambang dan hasilModul.lulus tersimpan
// true. Skor sendiri TIDAK disentuh (tetap tampil di items[].skor).
// ---------------------------------------------------------------------

uji(
  "modul wajib dengan hasilModul.lulus=true TAPI kedaluwarsa=true → kelayakan belum_layak (lulus dipaksa false untuk otomatis), skor TETAP tercatat di items",
  () => {
    const { kelayakan } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1")],
        hasilModul: { ev1: hasil(95, true, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat() }
    );
    assert.equal(
      kelayakan.status,
      "belum_layak",
      `Hasil kedaluwarsa tidak boleh melayakkan otomatis walau skor 95 ≥ ambang, dapat "${kelayakan.status}"`
    );
    assert.equal(kelayakan.items[0].skor, 95, "Skor TIDAK boleh dihapus/diubah walau kedaluwarsa");
    assert.equal(
      kelayakan.items[0].lulus,
      false,
      "items[].lulus harus dipaksa false untuk keputusan otomatis walau hasilModul.lulus tersimpan true"
    );
  }
);

uji(
  "modul wajib dengan hasilModul.lulus=true DAN kedaluwarsa=false (bawaan) → kelayakan layak seperti biasa (tidak ada regresi)",
  () => {
    const { kelayakan } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1")],
        hasilModul: { ev1: hasil(95, true, false) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat() }
    );
    assert.equal(kelayakan.status, "layak");
    assert.equal(kelayakan.items[0].lulus, true);
  }
);

uji(
  "modul wajib TIDAK lulus (skor rendah) DAN kedaluwarsa=true → tetap belum_layak (kedua alasan konsisten, bukan saling menutupi)",
  () => {
    const { kelayakan } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1")],
        hasilModul: { ev1: hasil(40, false, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat() }
    );
    assert.equal(kelayakan.status, "belum_layak");
    assert.equal(kelayakan.items[0].skor, 40);
    assert.equal(kelayakan.items[0].lulus, false);
  }
);

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
