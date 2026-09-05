import type { AmbangKeterlibatan } from "@/types/kegiatan";

export type TingkatAtestasi = "belum" | "menuntaskan" | "memahami";

/**
 * Satu kosakata dari layar peserta (modul atestasi, halaman kegiatan) sampai
 * ke pernyataan sertifikat (Slice 7.6) — supaya kata yang dibaca peserta
 * SAAT MENGERJAKAN persis sama dengan kata yang dicetak di sertifikatnya.
 * sertifikat-server.ts sengaja TIDAK mencetak 'belum' (modul yang belum
 * tuntas tidak dicetak sama sekali di sertifikat) tapi tetap memakai label
 * yang sama untuk 'menuntaskan'/'memahami' dari sini — satu sumber.
 */
export const LABEL_TINGKAT_ATESTASI: Record<TingkatAtestasi, string> = {
  belum: "Belum menuntaskan",
  menuntaskan: "Telah menuntaskan",
  memahami: "Telah menuntaskan dan memahami",
};

export interface HasilNormalisasiAmbang {
  ambang: AmbangKeterlibatan;
  /** true kalau nilai tersimpan diabaikan dan diganti default — modul ini perlu ditinjau admin. */
  dikoreksi: boolean;
}

/**
 * Fungsi murni — Slice 7.5. Prinsipnya: sistem tidak boleh pernah menyimpan
 * ATAU MENGEVALUASI syarat yang mustahil dipenuhi. Mode 'persen' berarti
 * "sekian persen dari durasi" — mustahil dihitung kalau durasinya sendiri
 * tidak diketahui (durasiDetik kosong/nol). Ini persis bug yang ditemukan
 * scripts/periksa-kelayakan.ts pada modul "ccl game bermain" (55% dari
 * durasi yang tidak diketahui): migrasi 7.3 memetakan ambangKreditPersen
 * lama ke mode 'persen' tanpa memeriksa apakah durasinya ada.
 *
 * Dipakai di SEMUA titik baca ambangKeterlibatan (services/modul.ts, kedua
 * route pendaftaran, sertifikat-server.ts, nilaiAtestasi() di bawah, dan
 * scripts/periksa-kelayakan.ts) — bukan cuma satu tempat — supaya
 * modulSnapshot peserta LAMA ikut terkoreksi saat dibaca, tanpa migrasi
 * data (dokumen pendaftaran tidak pernah ditulis ulang oleh normalisasi
 * ini).
 *
 * Kalau durasiDetik kosong/nol dan mode tersimpan sudah 'menit', tidak ada
 * yang perlu dikoreksi (durasi memang tidak relevan untuk mode itu).
 */
export function normalkanAmbangKeterlibatan(
  ambang: AmbangKeterlibatan,
  durasiDetik: number | null
): HasilNormalisasiAmbang {
  const durasiValid = typeof durasiDetik === "number" && durasiDetik > 0;
  if (ambang.mode === "persen" && !durasiValid) {
    return { ambang: { mode: "menit", nilai: 10 }, dikoreksi: true };
  }
  return { ambang, dikoreksi: false };
}

export interface HasilNilaiAtestasi {
  tingkat: TingkatAtestasi;
  alasan: string;
  keterlibatanTercapai: boolean;
  skorTercapai: boolean;
}

/**
 * Konfigurasi yang dibutuhkan nilaiAtestasi() — cocok baik dengan
 * KonfigurasiAtestasi penuh (kegiatan/{id}/modul/{mid}.atestasi, dipakai
 * sertifikat-server.ts untuk kalimat pernyataan) maupun dengan field beku
 * di ModulSnapshotItem (dipakai evaluasiKelayakan()) — struktural, tidak
 * terikat salah satu tipe secara eksplisit.
 */
export interface KonfigurasiUntukNilaiAtestasi {
  ambangKeterlibatan: AmbangKeterlibatan;
  targetSkor: number | null;
  durasiDetik: number | null;
}

/**
 * Hanya dua field HasilAtestasi yang dipakai di sini — score TERTINGGI
 * yang tersimpan, dan detikTersaksikan (BUKAN watchCreditSec mentah).
 */
export interface HasilUntukNilaiAtestasi {
  score: number;
  detikTersaksikan: number;
}

/**
 * Fungsi murni — tidak menyentuh Firestore. Satu sumber kebenaran untuk
 * "apa yang bisa dinyatakan tentang atestasi ini", dipakai BERSAMA oleh
 * evaluasiKelayakan() (gerbang atestasiJadiSyarat) dan sertifikat-server.ts
 * (kalimat pernyataan yang dibekukan saat terbit).
 *
 * Keterlibatan dihitung dari detikTersaksikan — TIDAK PERNAH dari
 * watchCreditSec mentah (prinsip Slice 7.2a: portal hanya mengakui apa
 * yang ia saksikan sendiri). Mode 'persen': detikTersaksikan / durasiDetik
 * × 100 >= nilai. Mode 'menit': detikTersaksikan / 60 >= nilai.
 *
 * Skor tinggi TIDAK BISA menutupi keterlibatan yang kurang — kalau
 * keterlibatan belum tercapai, tingkatnya 'belum' berapa pun skornya.
 * Tanpa targetSkor, tingkat tertinggi yang mungkin adalah 'menuntaskan' —
 * 'memahami' tidak pernah tercapai tanpa target (ARSITEKTUR §11: "kalau
 * dikosongkan, hanya pernyataan 'menuntaskan' yang tersedia").
 *
 * hasil undefined (peserta belum pernah membuka modul ini) menghasilkan
 * 'belum' tanpa melempar error — pola yang sama seperti referensiDibuka
 * (Slice 5.2).
 *
 * Slice 7.5: ambangKeterlibatan SELALU dinormalkan (normalkanAmbangKeterlibatan())
 * sebelum dipakai — pemanggil yang lupa menormalkan tetap aman, ini garis
 * pertahanan terakhir. Kalau SETELAH normalisasi keterlibatan tetap tidak
 * bisa dievaluasi (seharusnya tidak pernah terjadi — dijaga defensif, KA-1),
 * keterlibatan diperlakukan TIDAK BERLAKU: yang menentukan hanya target
 * skor, bukan 'belum' selamanya — sesuai janji form admin (§1, Slice 7.1)
 * bahwa ambang diabaikan untuk game tanpa durasi.
 */
export function nilaiAtestasi(
  konfigurasi: KonfigurasiUntukNilaiAtestasi,
  hasil: HasilUntukNilaiAtestasi | undefined
): HasilNilaiAtestasi {
  if (!hasil) {
    return {
      tingkat: "belum",
      alasan: "Belum pernah membuka modul ini.",
      keterlibatanTercapai: false,
      skorTercapai: false,
    };
  }

  const { targetSkor, durasiDetik } = konfigurasi;
  const { ambang } = normalkanAmbangKeterlibatan(konfigurasi.ambangKeterlibatan, durasiDetik);
  const detikTersaksikan = hasil.detikTersaksikan;
  const skorTercapai = targetSkor !== null && hasil.score >= targetSkor;

  // Setelah normalisasi, mode 'persen' hanya mungkin muncul berbarengan
  // durasi valid — tapi tetap diperiksa di sini, bukan diasumsikan.
  const durasiValid = typeof durasiDetik === "number" && durasiDetik > 0;
  const keterlibatanBerlaku = ambang.mode === "menit" || durasiValid;

  if (!keterlibatanBerlaku) {
    if (targetSkor !== null && skorTercapai) {
      return {
        tingkat: "memahami",
        alasan:
          "Keterlibatan tidak bisa dinilai (durasi modul tidak diketahui) — dinilai dari skor saja, dan skor sudah mencapai target.",
        keterlibatanTercapai: true,
        skorTercapai: true,
      };
    }
    return {
      tingkat: "menuntaskan",
      alasan:
        targetSkor !== null
          ? "Keterlibatan tidak bisa dinilai (durasi modul tidak diketahui) — dinilai dari skor saja, skor belum mencapai target."
          : "Keterlibatan tidak bisa dinilai (durasi modul tidak diketahui) — dinilai dari skor saja.",
      keterlibatanTercapai: true,
      skorTercapai,
    };
  }

  const keterlibatanTercapai =
    ambang.mode === "persen"
      ? (detikTersaksikan / (durasiDetik as number)) * 100 >= ambang.nilai
      : detikTersaksikan / 60 >= ambang.nilai;

  if (!keterlibatanTercapai) {
    return {
      tingkat: "belum",
      alasan: "Keterlibatan belum mencapai ambang.",
      keterlibatanTercapai: false,
      skorTercapai,
    };
  }

  if (targetSkor !== null && skorTercapai) {
    return {
      tingkat: "memahami",
      alasan: "Keterlibatan dan skor sudah mencapai ambang.",
      keterlibatanTercapai: true,
      skorTercapai: true,
    };
  }

  return {
    tingkat: "menuntaskan",
    alasan:
      targetSkor !== null
        ? "Keterlibatan tercapai, skor belum mencapai target."
        : "Keterlibatan tercapai.",
    keterlibatanTercapai: true,
    skorTercapai,
  };
}
