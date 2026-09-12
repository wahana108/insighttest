export type StatusAttempt = "berlangsung" | "selesai" | "kadaluarsa";

export interface JawabanAttempt {
  soalId: string;
  opsiId: string;
}

/**
 * §5 (docs/arsitektur.md): jawaban disimpan sebagai ARRAY di dalam dokumen
 * attempt, BUKAN dokumen per soal — 500 peserta x 40 soal per-dokumen akan
 * menghabiskan kuota tulis gratis harian (20.000) dalam satu hari evaluasi.
 * Satu attempt = paling banyak dua tulis sepanjang hidupnya (mulai, submit).
 */
export interface Attempt {
  id: string;
  kegiatanId: string;
  modulId: string;
  uid: string;
  attemptKe: number;
  status: StatusAttempt;
  mulaiPada: string;
  kadaluarsaPada: string | null;
  selesaiPada: string | null;
  /** Dibekukan saat attempt dibuat — memuat ulang halaman tidak mengacak ulang soal. */
  soalIds: string[];
  jawaban: JawabanAttempt[];
  skor: number | null;
  benar: number | null;
  total: number | null;
  lulus: boolean | null;
  /**
   * Slice "ujian-berwaktu" — true kalau jawaban tiba di server SETELAH
   * ditutupPada kegiatan + KELONGGARAN_JARINGAN_DETIK (src/lib/ujian-berwaktu.ts).
   * BERBEDA dari status 'kadaluarsa' (itu batasWaktuMenit PER-MODUL) — field
   * ini tentang jendela KEGIATAN. selesaiPada di atas adalah waktu kirim
   * sebenarnya, dicatat server; tidak perlu field waktu terpisah. Jawaban
   * TETAP dinilai dan skor TETAP tersimpan seperti biasa — lihat komentar
   * evaluasiKelayakan() untuk akibatnya pada kelayakan otomatis.
   */
  kedaluwarsa: boolean;
}

export interface SoalUntukAttempt {
  id: string;
  teks: string;
  opsi: { id: string; label: string }[];
}

export interface MulaiAttemptResponse {
  attemptId: string;
  kadaluarsaPada: string | null;
  soal: SoalUntukAttempt[];
}

export interface AttemptDetailResponse {
  attemptId: string;
  status: StatusAttempt;
  kadaluarsaPada: string | null;
  soal: SoalUntukAttempt[];
  jawaban: JawabanAttempt[];
  skor: number | null;
  benar: number | null;
  total: number | null;
  lulus: boolean | null;
  kedaluwarsa: boolean;
}

export interface SubmitAttemptResponse {
  skor: number;
  benar: number;
  total: number;
  lulus: boolean;
  kedaluwarsa: boolean;
}
