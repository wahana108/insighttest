import type { AmbangKeterlibatan, KategoriModul } from "@/types/kegiatan";

export type StatusPendaftaran = "terdaftar" | "selesai";

/**
 * KA-5 (docs/arsitektur.md): cuplikan modul saat peserta mendaftar — bukan
 * rujukan hidup ke kegiatan/{id}/modul. Mengedit modul setelahnya tidak
 * boleh mengubah apa yang tercatat di sini.
 *
 * ambangKeterlibatan/targetSkor/durasiDetik (Slice 7.3) mengikuti pola
 * nilaiMinimum yang sudah ada — DIBEKUKAN dari kegiatan/{id}/modul/{mid}.atestasi
 * saat pendaftaran, supaya admin mengubah ambang sesudahnya tidak
 * mendadak mengubah kelayakan peserta yang sudah terdaftar. null untuk
 * modul bukan atestasi, atau untuk pendaftaran dari sebelum field ini ada.
 */
export interface ModulSnapshotItem {
  modulId: string;
  judul: string;
  kategori: KategoriModul;
  wajib: boolean;
  nilaiMinimum: number | null;
  ambangKeterlibatan: AmbangKeterlibatan | null;
  targetSkor: number | null;
  durasiDetik: number | null;
}

/**
 * Skor yang dipakai adalah TERTINGGI antar percobaan. Diperbarui oleh
 * POST /api/attempt/[id]/submit dalam transaksi yang sama dengan attempt
 * itu sendiri.
 */
export interface HasilModul {
  skorTertinggi: number;
  lulus: boolean;
  percobaan: number;
}

export interface Pendaftaran {
  id: string;
  kegiatanId: string;
  uid: string;
  email: string;
  namaLengkap: string;
  institusi: string;
  nomorUrut: number;
  modulSnapshot: ModulSnapshotItem[];
  status: StatusPendaftaran;
  daftarPada: string;
  /** Kunci = modulId. Kosong sampai peserta menyelesaikan attempt pertamanya di modul itu. */
  hasilModul: Record<string, HasilModul>;
  /**
   * modulId modul referensi yang sudah dibuka peserta — ditulis HANYA oleh
   * POST /api/modul/dibuka (server), sekali per modulId (FieldValue.arrayUnion,
   * jadi idempoten). Dipakai evaluasiKelayakan() saat
   * syaratSertifikat.wajibBukaReferensi true.
   */
  referensiDibuka: string[];
  /**
   * Kunci = modulId modul atestasi. Ditulis HANYA lewat
   * POST /api/atestasi/mulai (dimulaiPada saja) dan POST /api/atestasi/lapor
   * (sisanya) — klien tidak pernah menulis ke pendaftaran langsung. Lihat
   * HasilAtestasi untuk detail per field.
   */
  atestasi: Record<string, HasilAtestasi>;
}

/**
 * watchCreditSec dan score adalah TERTINGGI antar sesi (kebijakan
 * percobaan ARSITEKTUR §11, sama semangatnya dengan HasilModul.skorTertinggi)
 * — MENTAH dari CCL, ditampilkan ke peserta apa adanya, TIDAK dipakai
 * untuk keputusan kelayakan (lihat detikTersaksikan). currentTimeSec/
 * durationSec/chapterIndex/gameId adalah dari laporan TERAKHIR yang
 * tersimpan — itu posisi dalam game, bukan capaian, jadi tidak masuk akal
 * diambil yang "tertinggi".
 *
 * gameBerubah true kalau gameId yang dilaporkan berbeda dari yang
 * dibekukan di kegiatan/{id}/modul/{mid}.atestasi.gameId saat verifikasi
 * terakhir (Slice 7.1) — game di URL yang sama mungkin sudah diganti
 * isinya; admin perlu tahu, laporannya tetap disimpan, bukan ditolak.
 *
 * Slice 7.2a — prinsip "portal hanya mengakui apa yang ia saksikan
 * sendiri": detikTersaksikan (BUKAN watchCreditSec mentah) yang akan
 * dipakai Slice 7.3 untuk menilai ambang. Dihitung KLIEN, bukan server:
 * bertambah di antara dua pesan telemetri hanya kalau salah satu dari
 * watch_credit_sec/score/wave/hp berbeda dari pesan sebelumnya (bukti
 * keterlibatan nyata). Server hanya membatasi laju pertambahannya
 * terhadap laporTerakhirPada (toleransi 10%) — memangkas dan menandai
 * (adaPemangkasan, detikDipangkas KUMULATIF), TIDAK PERNAH menolak
 * (§4/§Penyimpanan, Slice 7.2a — beda dari desain awal yang sempat
 * menolak dengan 400 dan ternyata menolak tontonan yang sah).
 * detikTersaksikanSesiTerakhir murni pembukuan server: nilai
 * detikTersaksikan KUMULATIF-SESI terakhir yang diterima, dipakai untuk
 * menghitung pertambahan yang benar pada laporan berikutnya dan mendeteksi
 * sesi baru (nilai baru lebih kecil dari ini → sesi klien mulai ulang dari
 * 0, seluruh nilainya dihitung sebagai pertambahan, bukan dikurangi).
 */
export interface HasilAtestasi {
  gameId: string;
  hp: number;
  score: number;
  watchCreditSec: number;
  currentTimeSec: number;
  durationSec: number | null;
  chapterIndex: number;
  nicknameCcl: string;
  dimulaiPada: string;
  laporTerakhirPada: string;
  gameBerubah: boolean;
  detikTersaksikan: number;
  detikTersaksikanSesiTerakhir: number;
  adaPemangkasan: boolean;
  detikDipangkas: number;
}

export type PendaftaranRingkas = Pick<
  Pendaftaran,
  | "id"
  | "kegiatanId"
  | "nomorUrut"
  | "status"
  | "daftarPada"
  | "hasilModul"
  | "modulSnapshot"
  | "referensiDibuka"
  | "atestasi"
>;
