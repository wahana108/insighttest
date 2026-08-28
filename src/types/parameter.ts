export type ModePendaftaran = "terbuka" | "persetujuan" | "undangan";

export interface SystemParameter {
  namaPlatform: string;
  modePendaftaran: ModePendaftaran;
  pesanBeranda: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
