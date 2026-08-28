import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserRole, UserStatus } from "@/types/user";

/**
 * Ditulis terpisah dari updateUserRole() supaya tiap panggilan hanya
 * menyentuh field yang diizinkan rules untuk perannya masing-masing —
 * admin: status saja, superadmin: role dan/atau status (firestore.rules,
 * match /users/{uid} allow update).
 *
 * Ini jalur update administratif atas dokumen users/{uid} yang SUDAH ADA —
 * terpisah dari createProfileForNewAccount() di src/lib/auth/user-profile.ts,
 * yang tetap satu-satunya fungsi yang boleh MEMBUAT dokumen itu (KA-2,
 * docs/arsitektur.md). Kedua fungsi di sini tidak pernah create, hanya update,
 * dan tidak berjalan bersamaan dengan alur registrasi.
 */
export async function updateUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: new Date().toISOString(),
  });
}
