export type ModePendaftaran = "terbuka" | "undangan";

export interface SystemParameter {
  namaPlatform: string;
  modePendaftaran: ModePendaftaran;
  pesanBeranda: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
