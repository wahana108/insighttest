import type { PrasyaratMateri, StatusKelayakan } from "@/lib/sertifikat-syarat";
import type { HasilModul, StatusPendaftaran, SumberPendaftaran } from "@/types/pendaftaran";
import type { ItemSertifikat, StatusSertifikat } from "@/types/sertifikat";

/**
 * Dipakai GET /api/admin/pendaftaran dan /admin/kegiatan/[id]/peserta —
 * satu baris peserta terdaftar, digabung dengan evaluasiKelayakan() dan
 * status sertifikatnya, supaya admin bisa melihat pratinjau sebelum
 * menerbitkan massal (§10, docs/arsitektur.md).
 *
 * nilaiAkhir dan items ikut disertakan (bukan cuma layak/alasan) supaya
 * pada syarat 'manual_admin' — di mana admin menerbitkan dengan menimpa
 * penilaian kelayakan — keputusannya bisa diambil sambil melihat angkanya,
 * bukan cuma label "layak"/"belum layak".
 *
 * prasyaratMateri/bisaTerbit/alasanPenerbitan ditambahkan Slice 7.4 §3:
 * pada 'manual_admin', prasyaratMateri TIDAK PERNAH menghalangi
 * (bisaTerbit selalu true) tapi keadaannya WAJIB tetap terlihat di sini —
 * itulah dasar keputusan admin ("Ditentukan admin · Atestasi: 1 dari 2
 * tuntas · ..."). Pada 'nilai_minimum', bisaTerbit mencerminkan gerbang
 * SUNGGUHAN di server (putuskanPenerbitan(), satu sumber kebenaran yang
 * sama dipakai terbitkanSertifikatUntuk()).
 */
export interface PesertaAdminRingkas {
  uid: string;
  namaLengkap: string;
  email: string;
  institusi: string;
  /**
   * Slice 6.2: 'mandiri' | 'impor' — dari mana pendaftaran ini berasal.
   * Pendaftaran lama tanpa field sumber (sebelum slice ini) dibaca sebagai
   * 'mandiri', bukan galat — lihat komentar Pendaftaran.sumber di
   * src/types/pendaftaran.ts.
   */
  sumber: SumberPendaftaran;
  nomorUrut: number;
  status: StatusPendaftaran;
  hasilModul: Record<string, HasilModul>;
  layak: boolean;
  statusKelayakan: StatusKelayakan;
  alasanKelayakan: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
  prasyaratMateri: PrasyaratMateri;
  bisaTerbit: boolean;
  alasanPenerbitan: string;
  sertifikat: {
    id: string;
    serial: string;
    status: StatusSertifikat;
    kodeVerifikasi: string;
  } | null;
}
