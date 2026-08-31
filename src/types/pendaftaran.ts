import type { KategoriModul } from "@/types/kegiatan";

export type StatusPendaftaran = "terdaftar" | "selesai";

/**
 * KA-5 (docs/arsitektur.md): cuplikan modul saat peserta mendaftar — bukan
 * rujukan hidup ke kegiatan/{id}/modul. Mengedit modul setelahnya tidak
 * boleh mengubah apa yang tercatat di sini.
 */
export interface ModulSnapshotItem {
  modulId: string;
  judul: string;
  kategori: KategoriModul;
  wajib: boolean;
  nilaiMinimum: number | null;
}

/**
 * Skor yang dipakai adalah TERTINGGI antar percobaan. Diperbarui oleh
 * POST /api/attempt/[id]/submit dalam transaksi yang sama dengan attempt
 * itu sendiri.
 */
export interface HasilModul {
  skorTertinggi: number;
  lulus: boolean;
  percobaan: number;
}

export interface Pendaftaran {
  id: string;
  kegiatanId: string;
  uid: string;
  email: string;
  namaLengkap: string;
  institusi: string;
  nomorUrut: number;
  modulSnapshot: ModulSnapshotItem[];
  status: StatusPendaftaran;
  daftarPada: string;
  /** Kunci = modulId. Kosong sampai peserta menyelesaikan attempt pertamanya di modul itu. */
  hasilModul: Record<string, HasilModul>;
}

export type PendaftaranRingkas = Pick<
  Pendaftaran,
  "id" | "kegiatanId" | "nomorUrut" | "status" | "daftarPada" | "hasilModul" | "modulSnapshot"
>;
