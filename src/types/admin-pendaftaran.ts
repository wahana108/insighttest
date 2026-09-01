import type { StatusKelayakan } from "@/lib/sertifikat-syarat";
import type { HasilModul, StatusPendaftaran } from "@/types/pendaftaran";
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
 */
export interface PesertaAdminRingkas {
  uid: string;
  namaLengkap: string;
  email: string;
  institusi: string;
  nomorUrut: number;
  status: StatusPendaftaran;
  hasilModul: Record<string, HasilModul>;
  layak: boolean;
  statusKelayakan: StatusKelayakan;
  alasanKelayakan: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
  sertifikat: { id: string; serial: string; status: StatusSertifikat } | null;
}
