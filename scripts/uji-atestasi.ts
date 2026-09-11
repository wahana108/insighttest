/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji nilaiAtestasi() (src/lib/atestasi-pernyataan.ts) sebagai fungsi
 * murni, DAN gerbang atestasiJadiSyarat pada evaluasiKelayakan()
 * (src/lib/sertifikat-syarat.ts) — keduanya tanpa Firestore, tanpa
 * browser. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-atestasi.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { nilaiAtestasi } from "../src/lib/atestasi-pernyataan";
import {
  deskripsiPrasyaratMateri,
  evaluasiKelayakan,
  putuskanPenerbitan,
  statusPrasyaratMateri,
} from "../src/lib/sertifikat-syarat";
import type { AmbangKeterlibatan, SyaratSertifikat } from "../src/types/kegiatan";
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

function ambangPersen(nilai: number): AmbangKeterlibatan {
  return { mode: "persen", nilai };
}

function ambangMenit(nilai: number): AmbangKeterlibatan {
  return { mode: "menit", nilai };
}

// ---------------------------------------------------------------------
// nilaiAtestasi() — fungsi murni
// ---------------------------------------------------------------------

uji("mode persen, durasi 1546, ambang 90 — detikTersaksikan 1400 → keterlibatan tercapai", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: null, durasiDetik: 1546 },
    { score: 0, detikTersaksikan: 1400 }
  );
  assert.equal(
    hasil.keterlibatanTercapai,
    true,
    `1400/1546*100 ≈ 90.55% >= 90 — diharapkan keterlibatanTercapai=true, dapat alasan: "${hasil.alasan}"`
  );
});

uji("mode persen, durasi 1546, ambang 90 — detikTersaksikan 1300 → keterlibatan belum tercapai", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: null, durasiDetik: 1546 },
    { score: 0, detikTersaksikan: 1300 }
  );
  assert.equal(
    hasil.keterlibatanTercapai,
    false,
    `1300/1546*100 ≈ 84.09% < 90 — diharapkan keterlibatanTercapai=false, dapat tingkat "${hasil.tingkat}"`
  );
  assert.equal(hasil.tingkat, "belum", `Diharapkan tingkat "belum", dapat "${hasil.tingkat}"`);
});

uji("mode menit, ambang 10 — 540 detik (9 menit) → keterlibatan belum tercapai", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangMenit(10), targetSkor: null, durasiDetik: null },
    { score: 0, detikTersaksikan: 540 }
  );
  assert.equal(
    hasil.tingkat,
    "belum",
    `540 detik = 9 menit < ambang 10 menit — diharapkan tingkat "belum", dapat "${hasil.tingkat}"`
  );
});

uji("mode menit, ambang 10 — 660 detik (11 menit) → keterlibatan tercapai", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangMenit(10), targetSkor: null, durasiDetik: null },
    { score: 0, detikTersaksikan: 660 }
  );
  assert.equal(
    hasil.keterlibatanTercapai,
    true,
    `660 detik = 11 menit >= ambang 10 menit — diharapkan keterlibatanTercapai=true, dapat alasan: "${hasil.alasan}"`
  );
});

uji("targetSkor kosong, keterlibatan tercapai → menuntaskan, TIDAK PERNAH memahami", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: null, durasiDetik: 1000 },
    { score: 999999, detikTersaksikan: 950 }
  );
  assert.equal(
    hasil.tingkat,
    "menuntaskan",
    `Tanpa targetSkor, tingkat tertinggi yang mungkin adalah "menuntaskan" berapa pun skornya — dapat "${hasil.tingkat}"`
  );
});

uji("targetSkor 300, skor 380, keterlibatan tercapai → memahami", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: 300, durasiDetik: 1000 },
    { score: 380, detikTersaksikan: 950 }
  );
  assert.equal(
    hasil.tingkat,
    "memahami",
    `skor 380 >= targetSkor 300 dan keterlibatan tercapai — diharapkan "memahami", dapat "${hasil.tingkat}"`
  );
});

uji("targetSkor 300, skor 200, keterlibatan tercapai → menuntaskan", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: 300, durasiDetik: 1000 },
    { score: 200, detikTersaksikan: 950 }
  );
  assert.equal(
    hasil.tingkat,
    "menuntaskan",
    `skor 200 < targetSkor 300 tapi keterlibatan sudah tercapai — diharapkan "menuntaskan" (bukan "belum"), dapat "${hasil.tingkat}"`
  );
});

uji("keterlibatan belum tercapai tapi skor 9999 → tetap belum (skor tidak menutupi keterlibatan kurang)", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangPersen(90), targetSkor: 100, durasiDetik: 1000 },
    { score: 9999, detikTersaksikan: 10 }
  );
  assert.equal(
    hasil.tingkat,
    "belum",
    `Keterlibatan cuma 10/1000=1% (jauh di bawah ambang 90%) — skor tinggi tidak boleh menutupinya, diharapkan "belum", dapat "${hasil.tingkat}"`
  );
});

uji("hasil atestasi undefined (belum pernah membuka modul) → belum, tidak melempar", () => {
  let hasil: ReturnType<typeof nilaiAtestasi>;
  try {
    hasil = nilaiAtestasi(
      { ambangKeterlibatan: ambangPersen(90), targetSkor: null, durasiDetik: 1000 },
      undefined
    );
  } catch (err) {
    throw new Error(
      `Diharapkan nilaiAtestasi() TIDAK melempar error untuk hasil undefined — tapi melempar: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
  assert.equal(
    hasil.tingkat,
    "belum",
    `Diharapkan tingkat "belum" untuk peserta yang belum pernah membuka modul, dapat "${hasil.tingkat}"`
  );
});

// ---------------------------------------------------------------------
// normalkanAmbangKeterlibatan() dalam nilaiAtestasi() — Slice 7.5: mode
// persen tanpa durasi diketahui adalah syarat MUSTAHIL dipenuhi (bug
// migrasi 7.3, ditemukan scripts/periksa-kelayakan.ts pada modul "ccl
// game bermain" — 55% dari durasi yang tidak diketahui). Sistem tidak
// boleh pernah menyimpan ATAU MENGEVALUASI syarat semacam itu — kalau
// tidak bisa dievaluasi, ia diabaikan, bukan dianggap gagal selamanya.
// ---------------------------------------------------------------------

uji(
  "mode persen + durasiDetik null → dinormalkan otomatis jadi menit 10, TIDAK PERNAH menghasilkan keterlibatan yang mustahil",
  () => {
    const hasil = nilaiAtestasi(
      { ambangKeterlibatan: ambangPersen(55), targetSkor: null, durasiDetik: null },
      { score: 0, detikTersaksikan: 700 }
    );
    assert.notEqual(
      hasil.tingkat,
      "belum",
      `Bug Slice 7.5: persen tanpa durasi diketahui membuat keterlibatan mustahil tercapai (persentase dari durasi yang tidak diketahui) — seharusnya dinormalkan ke menit 10, dan 700 detik (11.67 menit) cukup, tapi dapat "belum" (alasan: ${hasil.alasan})`
    );
    assert.equal(
      hasil.tingkat,
      "menuntaskan",
      `Tanpa targetSkor, diharapkan "menuntaskan" setelah dinormalkan, dapat "${hasil.tingkat}"`
    );
  }
);

uji("mode menit + detikTersaksikan cukup → tuntas (menuntaskan)", () => {
  const hasil = nilaiAtestasi(
    { ambangKeterlibatan: ambangMenit(10), targetSkor: null, durasiDetik: null },
    { score: 0, detikTersaksikan: 700 }
  );
  assert.equal(
    hasil.tingkat,
    "menuntaskan",
    `700 detik (11.67 menit) >= ambang 10 menit — diharapkan "menuntaskan", dapat "${hasil.tingkat}"`
  );
});

uji(
  "modul tanpa durasi (tersimpan persen, dikoreksi otomatis) + skor mencapai target → memahami",
  () => {
    const hasil = nilaiAtestasi(
      { ambangKeterlibatan: ambangPersen(55), targetSkor: 300, durasiDetik: null },
      { score: 350, detikTersaksikan: 700 }
    );
    assert.equal(
      hasil.tingkat,
      "memahami",
      `Keterlibatan dinormalkan tercapai (menit 10) dan skor 350 >= target 300 — diharapkan "memahami", dapat "${hasil.tingkat}" (alasan: ${hasil.alasan})`
    );
  }
);

uji(
  "modul tanpa durasi (tersimpan persen, dikoreksi otomatis) + skor di bawah target → menuntaskan, BUKAN belum",
  () => {
    const hasil = nilaiAtestasi(
      { ambangKeterlibatan: ambangPersen(55), targetSkor: 300, durasiDetik: null },
      { score: 100, detikTersaksikan: 700 }
    );
    assert.equal(
      hasil.tingkat,
      "menuntaskan",
      `Keterlibatan dinormalkan tercapai (menit 10), skor 100 < target 300 — diharapkan "menuntaskan" (BUKAN "belum" — skor rendah tidak boleh terbaca sebagai keterlibatan kurang), dapat "${hasil.tingkat}" (alasan: ${hasil.alasan})`
    );
  }
);

// ---------------------------------------------------------------------
// evaluasiKelayakan() — prasyaratMateri.atestasi* (Slice 7.4 §3:
// atestasiJadiSyarat TIDAK LAGI menggerbang kelayakan.status — itu
// sekarang prasyaratMateri, terpisah dari nilai. Lihat scripts/uji-kelayakan.ts
// untuk kasus paralel di sisi referensi.)
// ---------------------------------------------------------------------

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

function modulAtestasi(
  modulId: string,
  opsi: { wajib?: boolean; ambang?: AmbangKeterlibatan; targetSkor?: number | null; durasiDetik?: number | null } = {}
): ModulSnapshotItem {
  return {
    modulId,
    judul: modulId,
    kategori: "atestasi",
    wajib: opsi.wajib ?? true,
    nilaiMinimum: null,
    ambangKeterlibatan: opsi.ambang ?? ambangPersen(90),
    targetSkor: opsi.targetSkor ?? null,
    durasiDetik: opsi.durasiDetik ?? 1000,
  };
}

function hasilEvaluasi(skorTertinggi: number, lulusFlag: boolean): HasilModul {
  return { skorTertinggi, lulus: lulusFlag, percobaan: 1 };
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
  "atestasiJadiSyarat=false — kelayakan layak DAN prasyaratMateri tuntas walau atestasi belum tuntas",
  () => {
    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1")],
        hasilModul: { ev1: hasilEvaluasi(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ atestasiJadiSyarat: false }) }
    );
    assert.equal(
      kelayakan.status,
      "layak",
      `Diharapkan "layak", dapat "${kelayakan.status}" (alasan: ${kelayakan.alasan})`
    );
    assert.equal(
      prasyaratMateri.tuntas,
      true,
      "atestasiJadiSyarat=false berarti atestasi tidak pernah menahan prasyaratMateri.tuntas, apa pun tingkatnya"
    );
  }
);

uji(
  "atestasiJadiSyarat=false (gerbang mati) + 1 dari 2 modul atestasi wajib belum tuntas → prasyaratMateri melaporkan KEADAAN KETIGA, BUKAN 'tuntas'",
  () => {
    const { prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1"), modulAtestasi("at2")],
        hasilModul: { ev1: hasilEvaluasi(100, true) },
        referensiDibuka: [],
        atestasi: { at1: { score: 0, detikTersaksikan: 950 } },
      },
      { syaratSertifikat: syarat({ atestasiJadiSyarat: false }) }
    );
    assert.equal(
      statusPrasyaratMateri(prasyaratMateri),
      "belum_tuntas_tidak_menghalangi",
      `Slice 7.6: at2 nyatanya belum tuntas walau gerbangnya mati — status harus membedakan ini dari "tuntas" sungguhan, dapat "${statusPrasyaratMateri(prasyaratMateri)}"`
    );
    const deskripsi = deskripsiPrasyaratMateri(prasyaratMateri);
    assert.notEqual(
      deskripsi,
      "Semua materi wajib sudah tuntas.",
      `Slice 7.6: TIDAK BOLEH mengklaim "tuntas" ketika gerbangnya mati tapi modul wajib nyatanya belum — dapat: "${deskripsi}"`
    );
    assert.equal(
      deskripsi,
      "Gerbang atestasi tidak aktif — 1 dari 2 modul atestasi wajib belum dituntaskan, tapi tidak menghalangi penerbitan.",
      `Diharapkan kalimat persis sesuai contoh Slice 7.6, dapat: "${deskripsi}"`
    );
  }
);

uji(
  "atestasiJadiSyarat=true, 1 dari 2 modul atestasi wajib belum tuntas → kelayakan TETAP layak (nilai independen), prasyaratMateri belum tuntas, angka 1",
  () => {
    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1"), modulAtestasi("at2")],
        hasilModul: { ev1: hasilEvaluasi(100, true) },
        referensiDibuka: [],
        atestasi: { at1: { score: 0, detikTersaksikan: 950 } },
      },
      { syaratSertifikat: syarat({ atestasiJadiSyarat: true }) }
    );
    assert.equal(
      kelayakan.status,
      "layak",
      `Slice 7.4: kelayakan HANYA soal nilai — atestasi belum tuntas tidak lagi membuatnya belum_layak, dapat "${kelayakan.status}"`
    );
    assert.equal(
      prasyaratMateri.tuntas,
      false,
      "at2 belum pernah dibuka (detikTersaksikan 0) — diharapkan prasyaratMateri.tuntas=false"
    );
    assert.equal(
      prasyaratMateri.atestasiBelumTuntas,
      1,
      `Diharapkan atestasiBelumTuntas=1, dapat ${prasyaratMateri.atestasiBelumTuntas}`
    );
    assert.equal(
      prasyaratMateri.atestasiWajibTotal,
      2,
      `Diharapkan atestasiWajibTotal=2, dapat ${prasyaratMateri.atestasiWajibTotal}`
    );
  }
);

uji("modul atestasi OPSIONAL belum tuntas → tidak menghalangi prasyaratMateri.tuntas", () => {
  const { prasyaratMateri } = evaluasiKelayakan(
    {
      modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1", { wajib: false })],
      hasilModul: { ev1: hasilEvaluasi(100, true) },
      referensiDibuka: [],
      atestasi: {},
    },
    { syaratSertifikat: syarat({ atestasiJadiSyarat: true }) }
  );
  assert.equal(
    prasyaratMateri.atestasiWajibTotal,
    0,
    `Modul atestasi opsional (wajib=false) tidak boleh dihitung — diharapkan atestasiWajibTotal=0, dapat ${prasyaratMateri.atestasiWajibTotal}`
  );
  assert.equal(prasyaratMateri.tuntas, true, "Diharapkan prasyaratMateri.tuntas=true — tidak ada atestasi WAJIB");
});

// ---------------------------------------------------------------------
// putuskanPenerbitan() — Slice 7.4 §3, aturan penerbitan mode otomatis
// vs. manual admin (satu sumber kebenaran dipakai juga oleh
// terbitkanSertifikatUntuk() dan scripts/periksa-kelayakan.ts)
// ---------------------------------------------------------------------

uji(
  "mode otomatis (nilai_minimum) + nilai lulus + atestasi wajib belum tuntas → TIDAK bisa terbit",
  () => {
    const hasilEval = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1")],
        hasilModul: { ev1: hasilEvaluasi(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ jenis: "nilai_minimum", atestasiJadiSyarat: true }) }
    );
    assert.equal(hasilEval.kelayakan.layak, true, "Nilai harus sudah lulus pada kasus ini (prasyarat kasus uji)");
    assert.equal(
      hasilEval.prasyaratMateri.tuntas,
      false,
      "Atestasi wajib harus belum tuntas pada kasus ini (prasyarat kasus uji)"
    );

    const keputusan = putuskanPenerbitan("nilai_minimum", hasilEval);
    assert.equal(
      keputusan.bisaTerbit,
      false,
      `Mode otomatis harus menolak penerbitan selama materi wajib belum tuntas, meskipun nilainya memenuhi — dapat bisaTerbit=true (alasan: "${keputusan.alasan}")`
    );
  }
);

uji(
  "mode manual admin + kondisi sama (nilai lulus + atestasi wajib belum tuntas) → BISA terbit, prasyaratMateri tetap terisi dan bisa dibaca",
  () => {
    const hasilEval = evaluasiKelayakan(
      {
        modulSnapshot: [modulEvaluasi("ev1"), modulAtestasi("at1")],
        hasilModul: { ev1: hasilEvaluasi(100, true) },
        referensiDibuka: [],
        atestasi: {},
      },
      { syaratSertifikat: syarat({ jenis: "manual_admin", atestasiJadiSyarat: true }) }
    );
    assert.equal(
      hasilEval.prasyaratMateri.tuntas,
      false,
      "Atestasi wajib harus belum tuntas pada kasus ini (prasyarat kasus uji)"
    );
    assert.equal(
      hasilEval.prasyaratMateri.atestasiBelumTuntas,
      1,
      "prasyaratMateri harus tetap terisi dengan angka sungguhan walau mode manual_admin (dasar keputusan admin di tabel peserta)"
    );

    const keputusan = putuskanPenerbitan("manual_admin", hasilEval);
    assert.equal(
      keputusan.bisaTerbit,
      true,
      `Mode manual admin TIDAK PERNAH dihalangi prasyaratMateri — admin tetap bisa menerbitkan, dapat bisaTerbit=false (alasan: "${keputusan.alasan}")`
    );
  }
);

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
