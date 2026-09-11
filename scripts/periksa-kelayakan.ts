/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Slice 7.4 §1: satu perintah menjawab "kenapa orang ini layak/belum layak",
 * tanpa membuka satu halaman pun. HANYA MEMBACA — tidak pernah menulis ke
 * Firestore. Memakai Admin SDK dan .env.local, persis seperti
 * scripts/seed-uji-referensi.ts.
 *
 * Kelas masalah yang jadi alasan skrip ini ada: modulSnapshot yang beku saat
 * pendaftaran bisa diam-diam kehilangan field yang dibutuhkan gerbang (mis.
 * ambangKeterlibatan kosong karena peserta mendaftar sebelum field itu ada)
 * — evaluasiKelayakan() lalu memakai NILAI DEFAULT tanpa memberi tahu siapa
 * pun, dan peserta lama bisa lolos gerbang tanpa disadari admin. Laporan ini
 * membongkar itu secara eksplisit per peserta, bukan menyembunyikannya di
 * balik satu label "layak"/"belum layak".
 *
 * Jalankan: npx tsx scripts/periksa-kelayakan.ts <kegiatanId>
 */
import { loadEnvConfig } from "@next/env";
import { getAdminDb } from "../src/lib/firebase/admin";
import { nilaiAtestasi, normalkanAmbangKeterlibatan } from "../src/lib/atestasi-pernyataan";
import type { HasilUntukNilaiAtestasi } from "../src/lib/atestasi-pernyataan";
import {
  deskripsiPrasyaratMateri,
  evaluasiKelayakan,
  putuskanPenerbitan,
  statusPrasyaratMateri,
  tentukanJenisSertifikat,
} from "../src/lib/sertifikat-syarat";
import type { StatusPrasyaratMateri } from "../src/lib/sertifikat-syarat";
import type {
  AmbangKeterlibatan,
  JenisSyaratSertifikat,
  KategoriModul,
  ModeAmbangKeterlibatan,
} from "../src/types/kegiatan";
import type { HasilModul, ModulSnapshotItem } from "../src/types/pendaftaran";
import type { StatusSertifikat } from "../src/types/sertifikat";

loadEnvConfig(process.cwd());

// ---------------------------------------------------------------------
// Parsing defensif (KA-1) — salinan lokal yang sama semangatnya dengan
// src/lib/api/sertifikat-server.ts dan src/app/api/admin/pendaftaran/route.ts.
// Skrip baca-saja ini SENGAJA tidak mengimpor keduanya (fungsi-fungsi itu
// tidak diekspor) — mengikuti pola scripts/seed-uji-referensi.ts, yang juga
// menyalin parsingnya sendiri.
// ---------------------------------------------------------------------

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

function mapAmbangKeterlibatan(value: unknown): AmbangKeterlibatan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  return isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number"
    ? { mode: data.mode, nilai: data.nilai }
    : null;
}

function mapModulSnapshot(value: unknown): ModulSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      kategori: isKategoriModul(item.kategori) ? item.kategori : "evaluasi",
      wajib: typeof item.wajib === "boolean" ? item.wajib : true,
      nilaiMinimum: typeof item.nilaiMinimum === "number" ? item.nilaiMinimum : null,
      ambangKeterlibatan: mapAmbangKeterlibatan(item.ambangKeterlibatan),
      targetSkor: typeof item.targetSkor === "number" ? item.targetSkor : null,
      durasiDetik: typeof item.durasiDetik === "number" ? item.durasiDetik : null,
    }));
}

function mapHasilModul(value: unknown): Record<string, HasilModul> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilModul> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      skorTertinggi: typeof data.skorTertinggi === "number" ? data.skorTertinggi : 0,
      lulus: typeof data.lulus === "boolean" ? data.lulus : false,
      percobaan: typeof data.percobaan === "number" ? data.percobaan : 0,
    };
  }
  return hasil;
}

function mapAtestasi(value: unknown): Record<string, HasilUntukNilaiAtestasi> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilUntukNilaiAtestasi> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      score: typeof data.score === "number" ? data.score : 0,
      detikTersaksikan: typeof data.detikTersaksikan === "number" ? data.detikTersaksikan : 0,
    };
  }
  return hasil;
}

// ---------------------------------------------------------------------
// Format tampilan
// ---------------------------------------------------------------------

function formatAmbang(ambang: AmbangKeterlibatan | null, durasiDetik: number | null): string {
  if (!ambang) {
    return "(tidak ada ambang pada dokumen ini)";
  }
  if (ambang.mode === "persen") {
    return durasiDetik !== null && durasiDetik > 0
      ? `${ambang.nilai}% dari durasi (${durasiDetik} detik)`
      : `${ambang.nilai}% dari durasi (durasi tidak diketahui)`;
  }
  return `${ambang.nilai} menit`;
}

function formatTargetSkor(targetSkor: number | null): string {
  return targetSkor !== null ? `target skor ${targetSkor}` : "tanpa target skor (maks tingkat: menuntaskan)";
}

/**
 * Peringatan mencolok kalau modulSnapshot peserta ini tidak memuat field
 * yang dibutuhkan gerbang atestasi — inilah yang membuat peserta lama bisa
 * lolos tanpa disadari (lihat komentar berkas). Kembali kosong untuk modul
 * bukan atestasi, atau kalau semua field yang dibutuhkan lengkap.
 *
 * modul di sini SENGAJA masih mentah (ambangKeterlibatan belum dinormalkan)
 * — kalau sudah dinormalkan, tanda "tersimpan mustahil dievaluasi" di bawah
 * tidak akan pernah terdeteksi lagi (Slice 7.5: nilaiAtestasi() dan
 * tampilan ambang MEMANG menormalkan otomatis, tapi laporan ini tetap
 * perlu tahu keadaan MENTAHnYA untuk memberi tahu admin).
 */
function peringatanSnapshotAtestasi(modul: ModulSnapshotItem): string[] {
  if (modul.kategori !== "atestasi") {
    return [];
  }
  if (!modul.ambangKeterlibatan) {
    return [
      `    !! ambangKeterlibatan TIDAK ADA pada snapshot modul "${modul.judul}" — nilaiAtestasi() menormalkan ke default (menit 10) tanpa durasi diketahui, yang mungkin TIDAK SAMA dengan pengaturan modul saat ini. Peserta ini bisa lolos gerbang tanpa disadari.`,
    ];
  }
  const { dikoreksi, ambang } = normalkanAmbangKeterlibatan(modul.ambangKeterlibatan, modul.durasiDetik);
  if (dikoreksi) {
    return [
      `    !! Ambang modul "${modul.judul}" tersimpan mode persen tanpa durasi diketahui — MUSTAHIL dievaluasi apa adanya (bug migrasi 7.3). nilaiAtestasi() mengoreksi otomatis jadi menit ${ambang.nilai} saat dibaca; buka modul ini di form admin dan simpan ulang untuk meninjau angkanya.`,
    ];
  }
  return [];
}

async function main(): Promise<void> {
  const kegiatanId = process.argv[2];
  if (!kegiatanId) {
    console.error("Penggunaan: npx tsx scripts/periksa-kelayakan.ts <kegiatanId>");
    process.exit(1);
  }

  const db = getAdminDb();

  const [kegiatanSnap, modulSnap, pendaftaranSnap, sertifikatSnap] = await Promise.all([
    db.collection("kegiatan").doc(kegiatanId).get(),
    db.collection("kegiatan").doc(kegiatanId).collection("modul").orderBy("urutan").get(),
    db.collection("pendaftaran").where("kegiatanId", "==", kegiatanId).get(),
    db.collection("sertifikat").where("kegiatanId", "==", kegiatanId).get(),
  ]);

  if (!kegiatanSnap.exists) {
    console.error(`Kegiatan ${kegiatanId} tidak ditemukan.`);
    process.exit(1);
  }

  const kegiatanData = kegiatanSnap.data() ?? {};
  const syaratRaw =
    typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
      ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
      : {};
  const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis) ? syaratRaw.jenis : "manual_admin";
  const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;
  const wajibBukaReferensiSyarat =
    typeof syaratRaw.wajibBukaReferensi === "boolean" ? syaratRaw.wajibBukaReferensi : false;
  const atestasiJadiSyaratSyarat =
    typeof syaratRaw.atestasiJadiSyarat === "boolean" ? syaratRaw.atestasiJadiSyarat : false;
  const terbitkanKeikutsertaanSyarat =
    typeof syaratRaw.terbitkanKeikutsertaan === "boolean" ? syaratRaw.terbitkanKeikutsertaan : false;

  console.log("=".repeat(72));
  console.log(`Kegiatan: ${typeof kegiatanData.kode === "string" ? kegiatanData.kode : "(tanpa kode)"} — ${typeof kegiatanData.judul === "string" ? kegiatanData.judul : "(tanpa judul)"}`);
  console.log("=".repeat(72));
  console.log(
    `Mode syarat sertifikat : ${jenisSyarat}${jenisSyarat === "nilai_minimum" ? ` (nilai minimum ${nilaiMinimumSyarat})` : ""}`
  );
  console.log(`Wajib buka referensi   : ${wajibBukaReferensiSyarat ? "AKTIF" : "tidak aktif"}`);
  console.log(`Atestasi jadi syarat   : ${atestasiJadiSyaratSyarat ? "AKTIF" : "tidak aktif"}`);
  console.log(
    `Terbitkan keikutsertaan: ${terbitkanKeikutsertaanSyarat ? "AKTIF (yang tidak layak bisa dapat sertifikat keikutsertaan)" : "tidak aktif"}`
  );

  console.log("\nModul kegiatan:");
  if (modulSnap.empty) {
    console.log("  (kegiatan ini belum punya modul)");
  }
  for (const doc of modulSnap.docs) {
    const data = doc.data();
    const judul = typeof data.judul === "string" ? data.judul : "(tanpa judul)";
    const kategori: KategoriModul = isKategoriModul(data.kategori) ? data.kategori : "evaluasi";
    const wajib = typeof data.wajib === "boolean" ? data.wajib : true;
    let baris = `  [${kategori}] ${wajib ? "wajib   " : "opsional"} ${judul}`;
    if (kategori === "atestasi") {
      const atestasiRaw =
        typeof data.atestasi === "object" && data.atestasi !== null
          ? (data.atestasi as Record<string, unknown>)
          : {};
      const ambangMentah = mapAmbangKeterlibatan(atestasiRaw.ambangKeterlibatan);
      const durasiDetik = typeof atestasiRaw.durasiDetik === "number" ? atestasiRaw.durasiDetik : null;
      const targetSkor = typeof atestasiRaw.targetSkor === "number" ? atestasiRaw.targetSkor : null;
      const normalisasi = ambangMentah ? normalkanAmbangKeterlibatan(ambangMentah, durasiDetik) : null;
      baris += ` — ambang: ${formatAmbang(normalisasi?.ambang ?? null, durasiDetik)} · ${formatTargetSkor(targetSkor)}`;
      console.log(baris);
      if (normalisasi?.dikoreksi) {
        console.log(
          `    !! Ambang tersimpan mode persen tanpa durasi diketahui — MUSTAHIL dievaluasi apa adanya (bug migrasi 7.3). Dikoreksi otomatis saat dibaca jadi menit ${normalisasi.ambang.nilai}; buka modul ini di form admin dan simpan ulang untuk meninjau angkanya.`
        );
      }
      continue;
    }
    console.log(baris);
  }

  const sertifikatByUid = new Map<string, { serial: string; status: StatusSertifikat }>();
  sertifikatSnap.docs.forEach((doc) => {
    const data = doc.data();
    const uid = typeof data.uid === "string" ? data.uid : "";
    if (!uid) return;
    sertifikatByUid.set(uid, {
      serial: typeof data.serial === "string" ? data.serial : "",
      status: isStatusSertifikat(data.status) ? data.status : "berlaku",
    });
  });

  console.log(`\nPeserta terdaftar: ${pendaftaranSnap.size}`);

  const pendaftaranSorted = pendaftaranSnap.docs
    .map((doc) => ({ doc, data: doc.data() }))
    .sort((a, b) => {
      const na = typeof a.data.nomorUrut === "number" ? a.data.nomorUrut : 0;
      const nb = typeof b.data.nomorUrut === "number" ? b.data.nomorUrut : 0;
      return na - nb;
    });

  for (const { doc, data } of pendaftaranSorted) {
    const uid = typeof data.uid === "string" ? data.uid : doc.id;
    const namaLengkap = typeof data.namaLengkap === "string" ? data.namaLengkap : "(tanpa nama)";
    const nomorUrut = typeof data.nomorUrut === "number" ? data.nomorUrut : 0;

    console.log("\n" + "-".repeat(72));
    console.log(`Peserta #${nomorUrut} — ${namaLengkap} (uid: ${uid})`);
    console.log("-".repeat(72));

    const sertifikat = sertifikatByUid.get(uid);
    console.log(
      sertifikat
        ? `Sertifikat        : sudah terbit — serial ${sertifikat.serial || "(kosong)"}, status ${sertifikat.status}`
        : "Sertifikat        : belum ada"
    );

    if (!Array.isArray(data.referensiDibuka)) {
      console.log(
        "  !! referensiDibuka TIDAK ADA pada dokumen pendaftaran ini (pendaftaran dari sebelum field ini ada) — diperlakukan sebagai kosong."
      );
    }
    if (typeof data.atestasi !== "object" || data.atestasi === null) {
      console.log(
        "  !! atestasi TIDAK ADA pada dokumen pendaftaran ini (pendaftaran dari sebelum field ini ada) — diperlakukan sebagai kosong."
      );
    }

    const modulSnapshot = mapModulSnapshot(data.modulSnapshot);
    const hasilModul = mapHasilModul(data.hasilModul);
    const referensiDibuka = Array.isArray(data.referensiDibuka)
      ? data.referensiDibuka.filter((item: unknown): item is string => typeof item === "string")
      : [];
    const atestasiHasil = mapAtestasi(data.atestasi);

    console.log(`\nModulSnapshot (dibekukan saat mendaftar, ${modulSnapshot.length} modul):`);
    if (modulSnapshot.length === 0) {
      console.log("  (kosong — pendaftaran ini tidak punya modulSnapshot sama sekali)");
    }
    for (const modul of modulSnapshot) {
      let baris = `  [${modul.kategori}] ${modul.wajib ? "wajib   " : "opsional"} ${modul.judul}`;
      if (modul.kategori === "atestasi") {
        const ambangTampil = modul.ambangKeterlibatan
          ? normalkanAmbangKeterlibatan(modul.ambangKeterlibatan, modul.durasiDetik).ambang
          : null;
        baris += ` — ambang: ${formatAmbang(ambangTampil, modul.durasiDetik)} · ${formatTargetSkor(modul.targetSkor)}`;
      }
      console.log(baris);
      for (const peringatan of peringatanSnapshotAtestasi(modul)) {
        console.log(peringatan);
      }
    }

    const modulEvaluasi = modulSnapshot.filter((m) => m.kategori === "evaluasi");
    if (modulEvaluasi.length > 0) {
      console.log("\nHasil evaluasi:");
      for (const modul of modulEvaluasi) {
        const hasil = hasilModul[modul.modulId];
        console.log(
          `  ${modul.wajib ? "wajib   " : "opsional"} ${modul.judul}: ${
            hasil ? `skor ${hasil.skorTertinggi}, ${hasil.lulus ? "lulus" : "belum lulus"} (${hasil.percobaan} percobaan)` : "belum pernah dicoba"
          }`
        );
      }
    }

    const modulReferensi = modulSnapshot.filter((m) => m.kategori === "referensi");
    if (modulReferensi.length > 0) {
      console.log("\nHasil referensi:");
      for (const modul of modulReferensi) {
        const dibuka = referensiDibuka.includes(modul.modulId);
        console.log(`  ${modul.wajib ? "wajib   " : "opsional"} ${modul.judul}: ${dibuka ? "sudah dibuka" : "belum dibuka"}`);
      }
    }

    const modulAtestasi = modulSnapshot.filter((m) => m.kategori === "atestasi");
    if (modulAtestasi.length > 0) {
      console.log("\nHasil atestasi:");
      for (const modul of modulAtestasi) {
        const hasil = atestasiHasil[modul.modulId];
        const nilai = nilaiAtestasi(
          {
            ambangKeterlibatan: modul.ambangKeterlibatan ?? { mode: "persen", nilai: 90 },
            targetSkor: modul.targetSkor,
            durasiDetik: modul.durasiDetik,
          },
          hasil
        );
        console.log(
          `  ${modul.wajib ? "wajib   " : "opsional"} ${modul.judul}: detikTersaksikan=${hasil?.detikTersaksikan ?? 0}, skor=${hasil?.score ?? 0}, tingkat=${nilai.tingkat} (${nilai.alasan})`
        );
      }
    }

    const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
      { modulSnapshot, hasilModul, referensiDibuka, atestasi: atestasiHasil },
      {
        syaratSertifikat: {
          jenis: jenisSyarat,
          nilaiMinimum: nilaiMinimumSyarat,
          wajibBukaReferensi: wajibBukaReferensiSyarat,
          atestasiJadiSyarat: atestasiJadiSyaratSyarat,
          terbitkanKeikutsertaan: terbitkanKeikutsertaanSyarat,
        },
      }
    );
    const keputusan = putuskanPenerbitan(jenisSyarat, { kelayakan, prasyaratMateri });
    const hasilJenis = tentukanJenisSertifikat(true, keputusan.bisaTerbit, terbitkanKeikutsertaanSyarat);

    // Slice 7.6: TIGA keadaan, bukan dua — "tuntas" tidak boleh dipakai
    // untuk keadaan gerbang-mati-tapi-materi-nyatanya-belum (lihat komentar
    // statusPrasyaratMateri(), src/lib/sertifikat-syarat.ts).
    const labelStatusMateri: Record<StatusPrasyaratMateri, string> = {
      tuntas: "tuntas",
      belum_tuntas_menghalangi: "BELUM tuntas (menghalangi penerbitan)",
      belum_tuntas_tidak_menghalangi: "belum tuntas, TAPI gerbang tidak aktif — tidak menghalangi",
    };

    console.log(`\nKelayakan (nilai)  : ${kelayakan.status} — ${kelayakan.alasan} (nilai akhir: ${kelayakan.nilaiAkhir})`);
    console.log(
      `Prasyarat materi   : ${labelStatusMateri[statusPrasyaratMateri(prasyaratMateri)]} — ${deskripsiPrasyaratMateri(prasyaratMateri)}`
    );
    if (prasyaratMateri.referensiWajibTotal > 0) {
      console.log(
        `  Referensi        : ${prasyaratMateri.referensiWajibTotal - prasyaratMateri.referensiBelumDibuka} dari ${prasyaratMateri.referensiWajibTotal} dibuka${wajibBukaReferensiSyarat ? "" : " (gerbang tidak aktif)"}`
      );
    }
    if (prasyaratMateri.atestasiWajibTotal > 0) {
      console.log(
        `  Atestasi         : ${prasyaratMateri.atestasiWajibTotal - prasyaratMateri.atestasiBelumTuntas} dari ${prasyaratMateri.atestasiWajibTotal} tuntas${atestasiJadiSyaratSyarat ? "" : " (gerbang tidak aktif)"}`
      );
    }

    console.log(
      `\nKesimpulan: ${keputusan.bisaTerbit ? "BISA TERBIT SEKARANG" : "BELUM BISA TERBIT"} — ${keputusan.alasan}`
    );
    // Slice 6.3 — jenis yang akan dibekukan KALAU admin menerbitkan sekarang.
    // Peserta sendiri (self-issue) hanya pernah dapat 'kelulusan' atau ditolak.
    console.log(
      `Jenis sertifikat (kalau admin menerbitkan): ${
        hasilJenis.jenis ?? "(tidak boleh terbit)"
      } — ${hasilJenis.alasan}`
    );
  }

  console.log("\n" + "=".repeat(72));
  console.log("Selesai. Laporan ini hanya membaca — tidak ada dokumen yang diubah.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
