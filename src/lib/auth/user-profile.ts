import type { User } from "firebase/auth";
import { doc, setDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { markUndanganUsedInBatch } from "@/lib/services/user-invitation";
import type { SystemParameter } from "@/types/parameter";
import type { Undangan } from "@/types/undangan";
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
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    institusi: typeof data.institusi === "string" ? data.institusi : "",
    nomorIdentitas: typeof data.nomorIdentitas === "string" ? data.nomorIdentitas : "",
    noTelepon: typeof data.noTelepon === "string" ? data.noTelepon : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

function baseProfile(user: User, role: UserRole, status: UserStatus): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName?.trim() || user.email || "Peserta",
    photoURL: user.photoURL,
    role,
    status,
    namaLengkap: "",
    institusi: "",
    nomorIdentitas: "",
    noTelepon: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * SATU-SATUNYA fungsi di seluruh project yang MEMBUAT dokumen users/{uid}
 * (langsung, atau lewat writeBatch untuk mode undangan). Dipanggil dari
 * gerbang pendaftaran di session.ts, yang membaca parameter/global SEKALI
 * dan mengopernya ke sini — fungsi ini TIDAK membaca ulang parameter.
 * Auth provider TIDAK PERNAH memanggil ini — lihat KA-2 di docs/arsitektur.md.
 *
 * Update administratif atas dokumen yang SUDAH ADA (ubah status/role oleh
 * admin/superadmin) adalah jalur terpisah dan sah: lihat
 * src/lib/services/user-management.ts. Jalur itu tidak pernah membuat
 * dokumen baru dan tidak berjalan bersamaan dengan registrasi, jadi tidak
 * membuka kembali race condition yang dicegah KA-2 — tapi itu berarti
 * "satu-satunya penulis" di sini spesifik untuk PEMBUATAN profil, bukan
 * setiap tulisan ke users/{uid}.
 *
 * `undangan` wajib diisi (dan sudah divalidasi belum terpakai) kalau
 * `parameter.modePendaftaran === 'undangan'` — pengecekan itu jadi tanggung
 * jawab pemanggil di session.ts.
 */
export async function createProfileForNewAccount(
  user: User,
  parameter: SystemParameter,
  undangan?: Undangan
): Promise<UserProfile> {
  if (parameter.modePendaftaran === "undangan") {
    if (!undangan) {
      throw new Error("Undangan wajib diisi untuk mode pendaftaran 'undangan'.");
    }

    const profile = baseProfile(user, undangan.role, "aktif");
    const batch = writeBatch(db);
    batch.set(doc(db, "users", user.uid), profile);
    markUndanganUsedInBatch(batch, undangan.email, user.uid);
    await batch.commit();
    return profile;
  }

  const status: UserStatus =
    parameter.modePendaftaran === "persetujuan" ? "pending" : "aktif";
  const profile = baseProfile(user, "peserta", status);
  await setDoc(doc(db, "users", user.uid), profile);
  return profile;
}
