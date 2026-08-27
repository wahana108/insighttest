import type { User } from "firebase/auth";
import { doc, setDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserProfile, UserRole, UserStatus } from "@/types/user";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "superadmin" ||
    value === "admin" ||
    value === "panitia" ||
    value === "peserta"
  );
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "pending" || value === "aktif" || value === "nonaktif";
}

export function mapUserProfile(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName
        : "Peserta",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    role: isUserRole(data.role) ? data.role : "peserta",
    status: isUserStatus(data.status) ? data.status : "aktif",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

/**
 * SATU-SATUNYA fungsi di seluruh project yang membuat atau menulis dokumen
 * users/{uid}. Dipanggil dari setiap jalur pendaftaran di session.ts.
 * Gerbang undangan (siapa boleh mendaftar) menyusul di slice 1.3 — untuk
 * sekarang setiap akun baru langsung role 'peserta', status 'aktif'.
 * Auth provider TIDAK PERNAH memanggil ini — lihat KA-2 di docs/arsitektur.md.
 */
export async function createProfileForNewAccount(user: User): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName?.trim() || user.email || "Peserta",
    photoURL: user.photoURL,
    role: "peserta",
    status: "aktif",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "users", user.uid), profile);
  return profile;
}
