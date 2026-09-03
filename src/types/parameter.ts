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
  updatedAt: string | null;
  updatedBy: string | null;
}
