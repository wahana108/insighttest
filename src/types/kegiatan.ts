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
  /**
   * default false. Kalau true, evaluasiKelayakan() (src/lib/sertifikat-syarat.ts)
   * ikut menghitung semua modul atestasi WAJIB pada modulSnapshot pendaftaran
   * ke dalam prasyaratMateri.tuntas — mensyaratkan sudah mencapai minimal
   * 'menuntaskan' (lihat src/lib/atestasi-pernyataan.ts). Slice 7.4: dihitung
   * BERSAMAAN dan independen dari wajibBukaReferensi, bukan berurutan —
   * lihat PrasyaratMateri di sertifikat-syarat.ts.
   */
  atestasiJadiSyarat: boolean;
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

/**
 * Tiga saklar kewenangan panitia UNTUK SATU KEGIATAN INI — dipilih admin
 * saat menunjuk (Slice 8.1, docs/arsitektur.md §"peran bertingkat").
 * Kepercayaan ini per orang per acara, bukan global: panitia yang sama
 * bisa punya saklar berbeda di kegiatan lain. `buatSoal` sudah bisa
 * dinyalakan admin tapi belum berfungsi — menyusul Slice 8.2, lihat
 * izinPanitia() di src/lib/izin-panitia.ts.
 */
export interface PanitiaIzin {
  terbitkanSertifikat: boolean;
  suntingKegiatan: boolean;
  buatSoal: boolean;
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
  /**
   * panitiaUids DAN panitiaIzin selalu ditulis bersamaan (lihat
   * tetapkanPanitia()/ubahIzinPanitia()/cabutPanitia() di
   * src/lib/services/kegiatan.ts) — panitiaUids untuk pemeriksaan
   * keanggotaan murah di firestore.rules, panitiaIzin untuk saklarnya.
   * Dokumen kegiatan lama tidak punya field ini sama sekali; mapKegiatan()
   * memperlakukan itu sebagai daftar/peta kosong, bukan galat. JANGAN
   * PERNAH menulis salah satu tanpa yang lain.
   */
  panitiaUids: string[];
  panitiaIzin: Record<string, PanitiaIzin>;
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

export type ModeAmbangKeterlibatan = "persen" | "menit";

/**
 * Model umum untuk "berapa banyak keterlibatan yang dianggap cukup" —
 * satu bentuk dua satuan, dipakai baik untuk video (persen dari durasi)
 * maupun game aksi tanpa durasi (menit mutlak). Satuannya (mode)
 * DITENTUKAN OTOMATIS oleh gerbang verifikasi (src/lib/verifikasi-atestasi-client.ts)
 * berdasarkan apakah game itu melaporkan durasi, BUKAN dipilih admin —
 * admin hanya boleh mengubah `nilai`. Lihat src/lib/atestasi-pernyataan.ts
 * untuk cara nilai ini dipakai menilai keterlibatan.
 */
export interface AmbangKeterlibatan {
  mode: ModeAmbangKeterlibatan;
  nilai: number;
}

/**
 * Diisi HANYA lewat gerbang pendaftaran (src/lib/verifikasi-atestasi-client.ts)
 * — admin tidak pernah mengetik gameId/gameName/versi sendiri, itu identitas
 * yang diklaim game lewat pesan CCL_READY, bukan pilihan admin. sumberUrl,
 * ambangKeterlibatan.nilai, targetSkor, dan mintaNicknameCcl adalah input
 * admin; sisanya (gameId, gameName, versi, durasiDetik, originDiizinkan,
 * diverifikasiPada, DAN ambangKeterlibatan.mode) hasil verifikasi.
 *
 * durasiDetik null berarti game ini tidak pernah melaporkan durasi lewat
 * laporan keadaan (diamati pada game aksi seperti space-commander/ccl-runner
 * yang diam sampai dimainkan) — BUKAN kegagalan. Untuk modul begini,
 * ambangKeterlibatan otomatis bermode 'menit' (default nilai 10), bukan
 * 'persen' — tidak ada durasi untuk dihitung persentasenya. Modul dengan
 * durasiDetik terisi otomatis bermode 'persen' (default nilai 90). Slice
 * 7.2 yang memakai originDiizinkan untuk memeriksa event.origin saat
 * merekam telemetri sungguhan — slice ini (7.1) hanya mendaftarkan
 * modulnya; Slice 7.3 yang memakai ambangKeterlibatan untuk menilai
 * pernyataan (src/lib/atestasi-pernyataan.ts).
 */
export interface KonfigurasiAtestasi {
  sumberUrl: string;
  gameId: string;
  gameName: string;
  versi: string;
  durasiDetik: number | null;
  ambangKeterlibatan: AmbangKeterlibatan;
  /**
   * Slice 7.5 — dihitung ulang setiap kali dibaca (src/lib/services/modul.ts,
   * lewat normalkanAmbangKeterlibatan()), TIDAK PERNAH diketik admin. true
   * berarti ambangKeterlibatan di atas SUDAH DIGANTI dari nilai tersimpan
   * yang mustahil dievaluasi (mode 'persen' tanpa durasi diketahui) ke
   * default aman (menit 10) — form admin menampilkan catatan supaya admin
   * meninjau angkanya. Selalu false lewat jalur simpan (gerbang verifikasi
   * tidak pernah menulis pasangan mode/durasi yang mustahil sejak awal).
   */
  ambangDikoreksi: boolean;
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
