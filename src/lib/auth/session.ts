import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { getSystemParameter } from "@/lib/services/system-parameter";
import { getUndanganByEmail } from "@/lib/services/user-invitation";
import { createProfileForNewAccount } from "./user-profile";
import type { SystemParameter } from "@/types/parameter";
import type { UserProfile } from "@/types/user";

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationError";
  }
}

/**
 * Rollback kalau pembuatan profil gagal, supaya akun Firebase Auth tidak
 * menggantung tanpa dokumen users/{uid} (akun yatim). Dicek dulu apakah
 * profil sudah tersimpan sebelum menghapus — kalau sudah ada, jangan
 * dihapus, itu berarti kegagalan terjadi setelah tulis berhasil.
 */
async function rollbackFailedRegistration(user: User): Promise<void> {
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (snapshot.exists()) {
      console.error(
        `[auth] Pendaftaran user ${user.uid} gagal setelah profil tersimpan — akun TIDAK dihapus. Periksa manual.`
      );
      return;
    }
  } catch {
    // Pengecekan sendiri gagal — lanjut ke percobaan hapus di bawah.
  }

  try {
    await deleteUser(user);
  } catch {
    try {
      await signOut(auth);
    } catch {
      // Abaikan — sudah upaya terbaik.
    }
  }
}

/**
 * Gerbang pendaftaran. `parameter` dioper dari pemanggil (dibaca SEKALI di
 * awal alur pendaftaran) — fungsi ini dan createProfileForNewAccount() TIDAK
 * boleh membaca ulang parameter/global.
 *
 * Mode 'undangan': undangan harus ada dan belum terpakai, kalau tidak
 * langsung ditolak di sini (sebelum ada tulisan apa pun) supaya pemanggil
 * melakukan rollback akun Auth yang baru dibuat.
 */
async function completeRegistration(
  user: User,
  parameter: SystemParameter
): Promise<UserProfile> {
  if (parameter.modePendaftaran === "undangan") {
    const undangan = await getUndanganByEmail(user.email ?? "");
    if (!undangan || undangan.usedAt) {
      throw new RegistrationError(
        "Email Anda belum diundang untuk mendaftar, atau undangan sudah dipakai. Hubungi admin."
      );
    }
    return createProfileForNewAccount(user, parameter, undangan);
  }

  return createProfileForNewAccount(user, parameter);
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User; profile: UserProfile }> {
  const parameter = await getSystemParameter();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  const name = displayName?.trim();
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }

  try {
    const profile = await completeRegistration(credential.user, parameter);
    return { user: credential.user, profile };
  } catch (error) {
    await rollbackFailedRegistration(credential.user);
    throw error;
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Login Google pertama kali = pendaftaran (tidak ada form daftar terpisah
 * untuk Google). Kalau users/{uid} belum ada, baca parameter SEKALI lalu
 * jalankan gerbang pendaftaran yang sama seperti daftar email. Login
 * berikutnya tidak menulis apa pun dan tidak menyentuh parameter.
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);

  const ref = doc(db, "users", credential.user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    try {
      const parameter = await getSystemParameter();
      await completeRegistration(credential.user, parameter);
    } catch (error) {
      await rollbackFailedRegistration(credential.user);
      throw error;
    }
  }

  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
