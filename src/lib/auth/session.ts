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
import { createProfileForNewAccount } from "./user-profile";
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

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User; profile: UserProfile }> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  const name = displayName?.trim();
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }

  try {
    const profile = await createProfileForNewAccount(credential.user);
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
 * untuk Google). Kalau users/{uid} belum ada, buat lewat
 * createProfileForNewAccount() dengan rollback yang sama seperti daftar
 * email. Login berikutnya tidak menulis apa pun.
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);

  const ref = doc(db, "users", credential.user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    try {
      await createProfileForNewAccount(credential.user);
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
