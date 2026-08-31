export type JenisSyaratSertifikat = "nilai_minimum" | "manual_admin";

/**
 * KA-4 (docs/arsitektur.md): syarat kelulusan adalah parameter, tidak
 * pernah hardcode. Baru dua jenis yang diimplementasikan; jenis lain
 * (formulir_terisi, kehadiran_terverifikasi, atestasi_tuntas, kombinasi)
 * menyusul di tahap berikutnya tanpa perlu migrasi karena bentuknya sudah
 * berupa data, bukan kode.
 */
export interface SyaratSertifikat {
  jenis: JenisSyaratSertifikat;
  nilaiMinimum: number;
}

export interface Kegiatan {
  id: string;
  /** Menyusun nomor serial sertifikat — lihat §10, docs/arsitektur.md. */
  kode: string;
  judul: string;
  deskripsi: string;
  dibukaPada: string | null;
  ditutupPada: string | null;
  isPublished: boolean;
  isArchived: boolean;
  syaratSertifikat: SyaratSertifikat;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type KategoriModul = "referensi" | "atestasi" | "evaluasi";

export type ModePemilihanSoal = "tetap" | "acak";

/**
 * KA-6: rujukan ke soal, tidak pernah salinan isinya. Mode 'tetap' memakai
 * soalIds eksplisit; mode 'acak' memakai topikKode + jumlah ("N soal acak
 * dari topik X").
 */
export interface PemilihanSoal {
  mode: ModePemilihanSoal;
  soalIds: string[];
  topikKode: string | null;
  jumlah: number | null;
}

export interface KonfigurasiEvaluasi {
  pemilihanSoal: PemilihanSoal;
  nilaiMinimum: number;
  maksPercobaan: number;
  batasWaktuMenit: number | null;
  acakUrutanSoal: boolean;
}

/**
 * Hanya kategori 'evaluasi' yang punya UI di slice ini. 'referensi' dan
 * 'atestasi' sudah masuk tipe (§2, docs/arsitektur.md) supaya tidak perlu
 * migrasi nanti, tapi field konfigurasinya menyusul saat UI-nya dibangun.
 */
export interface ModulKegiatan {
  id: string;
  judul: string;
  kategori: KategoriModul;
  urutan: number;
  wajib: boolean;
  evaluasi: KonfigurasiEvaluasi | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
