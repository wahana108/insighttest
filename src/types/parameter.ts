export type ModePendaftaran = "terbuka" | "persetujuan" | "undangan";

export interface SystemParameter {
  namaPlatform: string;
  modePendaftaran: ModePendaftaran;
  pesanBeranda: string;
  /**
   * Fallback kalau NEXT_PUBLIC_SITE_URL tidak diisi — lihat
   * src/lib/sertifikat-url.ts untuk alasan kenapa alamat verifikasi
   * sertifikat tidak boleh diambil dari window.location.
   */
  urlPublik: string;
  /**
   * Slice "kuota-peserta" §LAPIS 2 — 0 berarti tak terbatas (BAWAAN).
   * Menghitung pendaftaran BARU KE KEGIATAN (bukan pembuatan akun) lewat
   * jalur mandiri saja — impor daftar hadir admin dikecualikan (lihat
   * komentar di POST /api/pendaftaran). Melindungi kuota Firestore paket
   * Spark (§5, docs/arsitektur.md).
   */
  batasPendaftaranBaruPerHari: number;
  /**
   * Slice "daftar-tanpa-sandi" (docs/kickoff.md §R, SLICE 2) — default
   * false. Berlaku HANYA saat modePendaftaran === 'terbuka' (lihat
   * pendaftaranTanpaSandiAktif(), src/lib/pendaftaran-tanpa-sandi.ts) —
   * mode 'persetujuan'/'undangan' punya gerbangnya sendiri dan tidak
   * disentuh field ini.
   */
  pendaftaranTanpaKataSandi: boolean;
  /**
   * Slice "akses-kegiatan" (docs/kickoff.md §R, SLICE 4) — JALUR APRESIASI.
   * Kosong (bawaan) berarti fitur mati — tampilan saat kuota harian penuh
   * persis seperti sebelum slice ini. Diisi, /daftar dan halaman kegiatan
   * menawarkan tautan ini alih-alih sekadar "coba lagi besok"; kode akses
   * (kegiatan_kode/{id}) yang didapat lewat urlDukungan MELEWATI batas
   * harian tapi TETAP terikat kuota kegiatan (lihat putuskanAksesMandiri(),
   * src/lib/akses-kegiatan.ts).
   */
  urlDukungan: string;
  /** Teks pendek yang bisa disunting admin, ditampilkan di atas tautan urlDukungan. */
  pesanDukungan: string;
  /**
   * mis. mailto: atau wa.me/... — jalan terakhir bagi yang kehilangan kode
   * aksesnya. Kosong berarti baris "hubungi admin" tidak ditampilkan sama
   * sekali (bukan galat) — admin belum sempat mengisinya.
   */
  kontakAdmin: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
