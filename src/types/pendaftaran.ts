import type { KategoriModul } from "@/types/kegiatan";

export type StatusPendaftaran = "terdaftar";

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
}

export type PendaftaranRingkas = Pick<
  Pendaftaran,
  "id" | "kegiatanId" | "nomorUrut" | "status" | "daftarPada"
>;
