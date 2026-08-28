export type UndanganRole = "admin" | "panitia" | "peserta";

export interface Undangan {
  email: string;
  role: UndanganRole;
  catatan: string;
  createdAt: string;
  createdBy: string;
  usedAt: string | null;
  usedBy: string | null;
}
