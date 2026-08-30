export type UserRole = "superadmin" | "admin" | "panitia" | "peserta";

export type UserStatus = "pending" | "aktif" | "nonaktif";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  status: UserStatus;
  /** Nama yang akan tercetak di sertifikat (§11, docs/arsitektur.md) — beda dari displayName Google yang sering informal. */
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  createdAt: string;
  updatedAt: string;
}
