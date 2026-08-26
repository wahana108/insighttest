import type { Activatable, Auditable, IsoDateString } from "./common";

/**
 * Role akun. Atasan bukan role — relasi atasan-bawahan memakai `supervisorId`.
 */
export type UserRole = "super_admin" | "admin" | "moderator" | "pegawai";

/**
 * Status akses akun. Hanya "aktif" yang boleh masuk ke dashboard/admin.
 * "pending" diarahkan ke halaman tunggu persetujuan admin.
 */
export type UserStatus = "pending" | "aktif" | "nonaktif";

export interface UserProfile extends Activatable, Auditable {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  nip: string | null;
  role: UserRole;
  status: UserStatus;
  supervisorId: string | null;
  unitKerjaId: string | null;
  jabatanId: string | null;
  pangkatId: string | null;
  tusiIds: string[];
}

export interface AuthSession {
  uid: string;
  email: string | null;
  role: UserRole | null;
  displayName: string | null;
}

export interface UserAssignmentSnapshot {
  unitKerjaId: string | null;
  jabatanId: string | null;
  pangkatId: string | null;
  tusiIds: string[];
  capturedAt: IsoDateString | null;
}

/**
 * Undangan pendaftaran untuk mode "tertutup". ID dokumen = email huruf kecil.
 * `usedAt` null berarti belum dipakai untuk mendaftar.
 */
export interface UserInvitation {
  email: string;
  namaLengkap: string;
  unitKerjaId: string | null;
  jabatanId: string | null;
  supervisorId: string | null;
  role: UserRole;
  createdAt: IsoDateString | null;
  createdBy: string | null;
  usedAt: IsoDateString | null;
}
