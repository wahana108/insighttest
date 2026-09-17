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
  /**
   * Slice 6.3 — default false SELALU (KA-4: syarat adalah data, bukan
   * tebakan kode; kegiatan yang sudah ada tidak boleh mendadak bisa
   * menerbitkan jenis sertifikat yang tidak pernah dimaksudkan
   * penyelenggaranya). Kalau true, peserta yang TERDAFTAR tapi tidak
   * memenuhi syarat kelayakan (lihat tentukanJenisSertifikat(),
   * src/lib/sertifikat-syarat.ts) boleh diterbitkan sertifikat
   * **keikutsertaan** — bukan kelulusan — sebagai pengganti "tidak bisa
   * terbit sama sekali". Diletakkan di sini (bukan field kegiatan
   * terpisah) SENGAJA: syaratSertifikat sudah masuk
   * panitiaKegiatanKunciDiizinkan() di firestore.rules sebagai satu objek,
   * jadi menambah field wajib di sini TIDAK memerlukan perubahan rules.
   */
  terbitkanKeikutsertaan: boolean;
  /**
   * Slice "sertifikat-tanpa-nilai" (SLICE 5a) — default false. Kalau true,
   * tentukanJenisSertifikat() (src/lib/sertifikat-syarat.ts) SELALU
   * mengembalikan 'keikutsertaan' bagi siapa pun yang berhak menerima
   * sertifikat sama sekali — tidak ada jalur ke 'kelulusan' pada kegiatan
   * ini, termasuk penerbitan mandiri maupun massal. Untuk kegiatan seperti
   * kuis refleksi diri (Slice "penafsiran-hasil"): sertifikat keikutsertaan
   * tidak memuat nilai maupun tabel modul, jadi skor psikologis peserta
   * tidak pernah tampil di halaman verifikasi publik /s/[kode].
   *
   * Diletakkan di sini (bukan field kegiatan terpisah) SENGAJA, persis
   * alasan terbitkanKeikutsertaan di atas: syaratSertifikat sudah satu
   * kesatuan di panitiaKegiatanKunciDiizinkan() (firestore.rules), jadi
   * field baru di sini TIDAK memerlukan perubahan rules.
   *
   * Sertifikat yang SUDAH TERBIT tidak berubah — jenisnya beku sejak
   * terbit (KA-6). Menyalakan ini TIDAK berlaku surut; admin harus
   * mencabut lalu menerbitkan ulang kalau ingin sertifikat lama berhenti
   * menampilkan nilai.
   */
  hanyaKeikutsertaan: boolean;
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
 * Dua saklar kewenangan panitia UNTUK SATU KEGIATAN INI — dipilih admin
 * saat menunjuk (Slice 8.1, docs/arsitektur.md §"peran bertingkat").
 * Kepercayaan ini per orang per acara, bukan global: panitia yang sama
 * bisa punya saklar berbeda di kegiatan lain.
 *
 * Slice 8.2: `buatSoal` DIPINDAHKAN dari sini ke users/{uid}.bolehBuatSoal
 * (src/types/user.ts) — bank soal itu global (KA-6, tidak terikat
 * kegiatan), jadi izin membuatnya juga harus global. firestore.rules cuma
 * bisa memeriksa satu dokumen sekaligus; ia tidak bisa menelusuri semua
 * kegiatan tempat seseorang jadi panitia untuk mencari salah satu yang
 * menyalakan buatSoal, jadi saklar per-kegiatan tidak bisa dipakai untuk
 * menggerbangi resource global seperti bank soal.
 */
export interface PanitiaIzin {
  terbitkanSertifikat: boolean;
  suntingKegiatan: boolean;
}

export type StatusFieldFormulir = "tidak" | "opsional" | "wajib";

/**
 * Slice 6.1 — apakah institusi/nomorIdentitas/noTelepon diminta saat
 * peserta mendaftar ke KEGIATAN INI, dan apakah wajib. Berlaku hanya untuk
 * pendaftaran baru (src/lib/formulir-peserta.ts, POST /api/pendaftaran) —
 * tidak pernah memvalidasi ulang peserta yang sudah terdaftar. Kegiatan
 * lama tidak punya field ini; mapKegiatan() memperlakukan itu sebagai
 * 'tidak' untuk ketiganya (lihat FORMULIR_PESERTA_DEFAULT), bukan galat.
 */
export interface FormulirPeserta {
  institusi: StatusFieldFormulir;
  nomorIdentitas: StatusFieldFormulir;
  noTelepon: StatusFieldFormulir;
}

export type CaraMasukKegiatan = "terbuka" | "kode" | "hanya_admin";

/**
 * Slice "niat-dukungan" (6b) — formulir niat dukungan per kegiatan, satu
 * peta ini adalah SATU kunci tingkat atas pada dokumen kegiatan (bukan
 * empat field terpisah) — WAJIB ada di panitiaKegiatanKunciDiizinkan()
 * (firestore.rules), tapi cuma SATU entri, bukan empat, karena hasOnly()
 * menghitung per kunci tingkat atas.
 *
 * Kosong/tidak ada field ini sama sekali pada kegiatan lama HARUS berjalan
 * persis seperti sebelum slice ini — mapDukungan() (src/lib/services/kegiatan.ts)
 * memetakan itu ke { aktif: false, urlSaweria: "", pesan: "",
 * wajibCatatan: false } (KA-1), bukan galat.
 */
export interface DukunganKegiatan {
  /** Bawaan false — formulir dukungan tidak tampil sama sekali kalau ini false. */
  aktif: boolean;
  /** Divalidasi https:// di form admin (src/app/(admin)/admin/kegiatan/[id]/page.tsx) — TIDAK PERNAH dirender ke peserta sebelum formulir dikirim. */
  urlSaweria: string;
  /** Ditampilkan di halaman kegiatan (blok dukungan) DAN di layar setelah formulir dikirim. */
  pesan: string;
  /**
   * Bawaan false. true berarti kode akses yang benar TIDAK CUKUP untuk
   * mendaftar mandiri — WAJIB juga sudah ada dokumen
   * niat_dukungan/{kegiatanId}__{uid} (lihat putuskanCatatanDukunganWajib(),
   * src/lib/akses-kegiatan.ts, dipanggil dari POST /api/pendaftaran).
   */
  wajibCatatan: boolean;
  /**
   * Slice "persetujuan-dukungan" (6e) — bawaan false, kegiatan lama/tanpa
   * field ini berperilaku PERSIS seperti sebelum slice ini (KA-1). true
   * berarti POST /api/dukungan/niat membuat dokumen berstatus 'menunggu'
   * (bukan 'tercatat') dan POST /api/dukungan/kirim-kode menolak mengirim
   * sendiri — kode HANYA dikirim lewat POST /api/dukungan/setujui (admin/
   * panitia), setelah mencocokkan dengan daftar donatur. Kalau wajibCatatan
   * DAN ini sama-sama true, putuskanCatatanDukunganWajib() juga mensyaratkan
   * status 'terkirim', bukan cukup 'menunggu' — lihat komentar di sana.
   */
  perluPersetujuan: boolean;
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
  formulirPeserta: FormulirPeserta;
  /**
   * Slice "kuota-peserta" §LAPIS 1 — 0 berarti tak terbatas (BAWAAN, KA-4).
   * Berlaku untuk SEMUA jalur masuk (mandiri maupun impor admin) —
   * ditegakkan di server di dalam transaksi pembuatan pendaftaran
   * (src/lib/kuota-peserta.ts), bukan cuma di sini. Field baru pada
   * dokumen kegiatan — WAJIB ada di panitiaKegiatanKunciDiizinkan()
   * (firestore.rules), persis jebakan hasOnly yang sama dengan
   * formulirPeserta di atas.
   */
  kuotaPeserta: number;
  /**
   * Slice "akses-kegiatan" (docs/kickoff.md §R, SLICE 4) — bawaan 'terbuka'
   * (kegiatan lama tanpa field ini sama sekali, lihat mapCaraMasuk() di
   * src/lib/akses-kegiatan.ts). BOLEH ada di dokumen yang dibaca publik —
   * tidak apa-apa orang tahu sebuah kegiatan butuh kode. KODENYA SENDIRI
   * TIDAK PERNAH di sini — lihat koleksi terpisah kegiatan_kode/{id} di
   * firestore.rules (server-only, KA-3).
   *
   * 'terbuka': seperti sebelum slice ini, terikat kuota kegiatan DAN batas
   * harian. 'kode': peserta memasukkan kode akses untuk mendaftar mandiri —
   * melewati batas harian, TETAP terikat kuota kegiatan (putuskanAksesMandiri()).
   * 'hanya_admin': tidak ada pendaftaran mandiri sama sekali, hanya lewat
   * impor daftar hadir — disembunyikan dari katalog publik
   * (bolehTampilDiKatalog()) tapi tetap terlihat peserta yang sudah
   * terdaftar (lewat /beranda, bukan lewat use-kegiatan-list.ts yang
   * dipakai katalog — lihat komentar bolehTampilDiKatalog()).
   */
  caraMasuk: CaraMasukKegiatan;
  /** Slice "niat-dukungan" (6b) — lihat DukunganKegiatan di atas. */
  dukungan: DukunganKegiatan;
  /**
   * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — sampul kegiatan,
   * opsional, kosong berarti tidak ada gambar (KA-1). LIVE, dibaca langsung
   * saat render (katalog /kegiatan dan halaman kegiatan/[id]) — persis
   * seperti templateSertifikat.logoUrl/kopUrl, TIDAK PERNAH dibekukan ke
   * pendaftaran/sertifikat mana pun, jadi tidak perlu pagar server terpisah
   * seperti tandaTanganUrl (lihat KA-8, docs/arsitektur.md). Field baru
   * tingkat atas pada kegiatan — WAJIB ada di panitiaKegiatanKunciDiizinkan()
   * (firestore.rules), persis jebakan hasOnly yang sama dengan kuotaPeserta
   * di atas.
   */
  urlGambar: string;
  /**
   * Slice "penafsiran-hasil" (docs/kickoff.md §R, SLICE 5) — kosong berarti
   * fitur mati (BAWAAN, KA-4; kegiatan lama tanpa field ini sama sekali
   * dibaca sebagai string kosong, bukan galat). Untuk kegiatan "kuis
   * refleksi diri": beberapa modul evaluasi yang masing-masing mewakili
   * satu kecenderungan, dan teks ini membantu PESERTA SENDIRI menafsirkan
   * gabungan skornya — TIDAK ADA logika penilaian baru, mesin evaluasi
   * yang ada dipakai apa adanya.
   *
   * TAMPIL HANYA di /kegiatan/[id] bagi peserta yang SUDAH TERDAFTAR (lihat
   * susunPenafsiranHasil(), src/lib/penafsiran-hasil.ts) — TIDAK PERNAH di
   * /s/[kode], halaman cetak sertifikat, atau rekap admin: field ini sama
   * sekali tidak disebut di SertifikatPublik/SertifikatDetail
   * (src/types/sertifikat.ts) maupun buildSertifikatDetail()
   * (src/lib/api/sertifikat-server.ts), jadi tidak ada jalur untuknya bocor
   * ke sana. Dirender sebagai TEKS BIASA (whitespace-pre-line) — TIDAK
   * PERNAH sebagai HTML, field ini bisa disunting panitia juga.
   */
  penafsiranHasil: string;
  /**
   * Slice "kuota-peserta" — jumlah pendaftar kumulatif kegiatan ini,
   * dipetakan dari field `nomorUrutTerakhir` yang SUDAH ADA sejak awal
   * (dinaikkan tepat +1 di dalam transaksi pendaftaran, pendaftaran tidak
   * pernah dihapus — lihat POST /api/pendaftaran). Dipetakan ke sini HANYA
   * untuk ditampilkan ("Kuota: 12 dari 20 terisi") — bukan penghitung baru,
   * dan TIDAK PERNAH ditulis dari klien (tidak ada di
   * panitiaKegiatanKunciDiizinkan(), sengaja).
   */
  nomorUrutTerakhir: number;
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
