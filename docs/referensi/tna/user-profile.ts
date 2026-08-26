import type { User } from "firebase/auth";
import type { DocumentData } from "firebase/firestore";
import type { UserInvitation, UserProfile, UserRole, UserStatus } from "@/types";
import { isUserRole } from "./roles";

export const DEFAULT_USER_ROLE: UserRole = "pegawai";

function isUserStatus(value: unknown): value is UserStatus {
  return value === "pending" || value === "aktif" || value === "nonaktif";
}

export function mapUserProfile(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: typeof data.email === "string" ? data.email : "",
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : "Pegawai",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    nip: typeof data.nip === "string" ? data.nip : null,
    role: isUserRole(data.role) ? data.role : DEFAULT_USER_ROLE,
    // Data lama (sebelum field ini ada) dianggap "aktif" — jangan mengunci
    // akun yang sudah berjalan hanya karena field baru belum terisi.
    status: isUserStatus(data.status) ? data.status : "aktif",
    supervisorId:
      typeof data.supervisorId === "string" ? data.supervisorId : null,
    unitKerjaId: typeof data.unitKerjaId === "string" ? data.unitKerjaId : null,
    jabatanId: typeof data.jabatanId === "string" ? data.jabatanId : null,
    pangkatId: typeof data.pangkatId === "string" ? data.pangkatId : null,
    tusiIds: Array.isArray(data.tusiIds)
      ? data.tusiIds.filter((value): value is string => typeof value === "string")
      : [],
    isActive: data.isActive !== false,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

/** Pendaftaran mode "terbuka" (atau tanpa undangan cocok): status pending, role default. */
export function buildDefaultProfile(user: User, now: string): UserProfile {
  return {
    id: user.uid,
    email: user.email ?? "",
    displayName: user.displayName?.trim() || user.email || "Pegawai",
    photoURL: user.photoURL,
    nip: null,
    role: DEFAULT_USER_ROLE,
    status: "pending",
    supervisorId: null,
    unitKerjaId: null,
    jabatanId: null,
    pangkatId: null,
    tusiIds: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid,
    updatedBy: user.uid,
  };
}

/** Pendaftaran mode "tertutup" dengan undangan valid: status langsung aktif. */
export function buildInvitedProfile(
  user: User,
  invitation: UserInvitation,
  now: string
): UserProfile {
  return {
    id: user.uid,
    email: user.email ?? invitation.email,
    displayName:
      user.displayName?.trim() || invitation.namaLengkap || user.email || "Pegawai",
    photoURL: user.photoURL,
    nip: null,
    role: invitation.role,
    status: "aktif",
    supervisorId: invitation.supervisorId,
    unitKerjaId: invitation.unitKerjaId,
    jabatanId: invitation.jabatanId,
    pangkatId: null,
    tusiIds: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid,
    updatedBy: user.uid,
  };
}

function toIso(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}
