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
  /**
   * default false. Kalau true, evaluasiKelayakan() (src/lib/sertifikat-syarat.ts)
   * juga mensyaratkan semua modul referensi WAJIB pada modulSnapshot
   * pendaftaran sudah tercatat dibuka (Pendaftaran.referensiDibuka) sebelum
   * peserta dianggap layak — lihat komentar di evaluasiKelayakan() untuk
   * kenapa modulSnapshot, bukan modul kegiatan saat ini, yang dipakai.
   */
  wajibBukaReferensi: boolean;
}

/**
 * Semua opsional (§11, docs/arsitektur.md) — sertifikat minimum tetap sah
 * kalau semuanya kosong. Gambar ditautkan lewat URL, tidak diunggah; belum
 * perlu Cloud Storage. Ini template LIVE di level kegiatan, bukan snapshot
 * per sertifikat — beda dari namaLengkap/judulKegiatan/items di
 * src/types/sertifikat.ts yang memang dibekukan (KA-6). Menyunting logo
 * atau penandatangan kegiatan mengubah tampilan semua sertifikatnya,
 * termasuk yang sudah terbit — itu wajar untuk identitas resmi/branding,
 * beda dengan fakta personal seperti nama dan skor.
 */
export interface TemplateSertifikat {
  logoUrl: string;
  kopUrl: string;
  penandatanganNama: string;
  penandatanganJabatan: string;
  tandaTanganUrl: string;
  teksTambahan: string;
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
  templateSertifikat: TemplateSertifikat;
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

export type TipeReferensi = "youtube" | "tautan" | "teks";

/**
 * sumber berarti beda per tipe: URL video untuk 'youtube', URL tujuan untuk
 * 'tautan', isi teksnya sendiri untuk 'teks'. Untuk 'youtube', sumber
 * menyimpan URL ASLI yang dimasukkan admin (salah satu dari tiga bentuk
 * yang diterima) — ID video dihitung ulang saat render (lihat
 * src/lib/youtube.ts), tidak disimpan terpisah, supaya tidak ada dua sumber
 * kebenaran yang bisa saling tidak sinkron.
 */
export interface KonfigurasiReferensi {
  tipe: TipeReferensi;
  sumber: string;
  deskripsi: string;
}

/**
 * Kategori 'referensi' dan 'evaluasi' punya UI mulai slice ini. 'atestasi'
 * sudah masuk tipe (§2, docs/arsitektur.md) supaya tidak perlu migrasi
 * nanti, tapi field konfigurasinya menyusul saat UI-nya dibangun.
 *
 * Modul referensi TIDAK PERNAH punya skor — evaluasiKelayakan() (lihat
 * src/lib/sertifikat-syarat.ts) hanya menghitung modul berkategori
 * 'evaluasi', jadi modul referensi otomatis tidak masuk perhitungan nilai
 * maupun daftar item di sertifikat (ARSITEKTUR §9: modul yang tidak diuji
 * tidak boleh tercetak di sertifikat).
 */
export interface ModulKegiatan {
  id: string;
  judul: string;
  kategori: KategoriModul;
  urutan: number;
  wajib: boolean;
  evaluasi: KonfigurasiEvaluasi | null;
  referensi: KonfigurasiReferensi | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
