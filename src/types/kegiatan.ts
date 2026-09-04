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
 * Diisi HANYA lewat gerbang pendaftaran (src/lib/verifikasi-atestasi-client.ts)
 * — admin tidak pernah mengetik gameId/gameName/versi sendiri, itu identitas
 * yang diklaim game lewat pesan CCL_READY, bukan pilihan admin. sumberUrl,
 * ambangKreditPersen, targetSkor, dan mintaNicknameCcl adalah input admin;
 * sisanya (gameId, gameName, versi, durasiDetik, originDiizinkan,
 * diverifikasiPada) hasil verifikasi.
 *
 * durasiDetik null berarti game ini tidak pernah melaporkan durasi lewat
 * laporan keadaan (diamati pada game aksi seperti space-commander/ccl-runner
 * yang diam sampai dimainkan) — BUKAN kegagalan. Untuk modul begini,
 * ambangKreditPersen tidak berlaku (tidak ada durasi untuk dihitung
 * persentasenya); hanya targetSkor yang berarti. Slice 7.2 yang memakai
 * originDiizinkan untuk memeriksa event.origin saat merekam telemetri
 * sungguhan — slice ini (7.1) hanya mendaftarkan modulnya.
 */
export interface KonfigurasiAtestasi {
  sumberUrl: string;
  gameId: string;
  gameName: string;
  versi: string;
  durasiDetik: number | null;
  ambangKreditPersen: number;
  targetSkor: number | null;
  originDiizinkan: string;
  mintaNicknameCcl: boolean;
  diverifikasiPada: string;
}

/**
 * Ketiga kategori punya UI mulai slice ini (atestasi sejak Slice 7.1).
 *
 * Modul referensi DAN atestasi TIDAK PERNAH punya skor yang dihitung
 * evaluasiKelayakan() (lihat src/lib/sertifikat-syarat.ts) — fungsi itu
 * hanya menghitung modul berkategori 'evaluasi', jadi keduanya otomatis
 * tidak masuk perhitungan nilai maupun daftar item di sertifikat
 * (ARSITEKTUR §9: modul yang tidak diuji tidak boleh tercetak di
 * sertifikat). Perekaman skor atestasi dan syarat kelulusannya menyusul di
 * Slice 7.2 — Slice 7.1 hanya pendaftaran modulnya.
 */
export interface ModulKegiatan {
  id: string;
  judul: string;
  kategori: KategoriModul;
  urutan: number;
  wajib: boolean;
  evaluasi: KonfigurasiEvaluasi | null;
  referensi: KonfigurasiReferensi | null;
  atestasi: KonfigurasiAtestasi | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
