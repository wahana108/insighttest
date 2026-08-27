export type UserRole = "superadmin" | "admin" | "panitia" | "peserta";

export type UserStatus = "pending" | "aktif" | "nonaktif";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
