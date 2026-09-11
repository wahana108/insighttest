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
  updatedAt: string | null;
  updatedBy: string | null;
}
