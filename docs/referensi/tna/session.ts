import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getClientAuth, getClientDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { getSystemParameters } from "@/lib/services/system-parameter";
import {
  getInvitationByEmail,
  markInvitationUsedInBatch,
  normalizeEmail,
} from "@/lib/services/user-invitation";
import type { AuthSession, UserProfile, UserRole } from "@/types";
import {
  ADMIN_PATH,
  AUTH_COOKIE_NAME,
  AUTH_ROLE_COOKIE_NAME,
  DASHBOARD_PATH,
  LOGIN_PATH,
  REGISTER_PATH,
} from "./constants";
import { mapAuthError } from "./errors";
import { canAccessAdmin, getPostLoginPath } from "./roles";
import { buildDefaultProfile, buildInvitedProfile, mapUserProfile } from "./user-profile";

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationError";
  }
}

export {
  ADMIN_PATH,
  AUTH_COOKIE_NAME,
  AUTH_ROLE_COOKIE_NAME,
  DASHBOARD_PATH,
  LOGIN_PATH,
  REGISTER_PATH,
};

export function requireFirebaseAuth() {
  const auth = getClientAuth();
  if (!auth) {
    throw new Error("Firebase Auth belum dikonfigurasi. Isi file .env.local.");
  }
  return auth;
}

export function requireFirebaseDb() {
  const db = getClientDb();
  if (!db) {
    throw new Error("Cloud Firestore belum dikonfigurasi. Isi file .env.local.");
  }
  return db;
}

export function toAuthSession(profile: UserProfile | null): AuthSession | null {
  if (!profile) {
    return null;
  }

  return {
    uid: profile.id,
    email: profile.email,
    role: profile.role,
    displayName: profile.displayName,
  };
}

export function getClientAuthUser(): User | null {
  return getClientAuth()?.currentUser ?? null;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const db = requireFirebaseDb();
  const snapshot = await getDoc(doc(db, COLLECTIONS.users, uid));
  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data());
}

/**
 * SATU-SATUNYA tempat yang membuat dokumen users/{uid} baru. Dipanggil dari
 * registerWithEmail() dan signInWithGoogle() (login Google pertama kali —
 * itu juga "pendaftaran", tidak ada form daftar terpisah untuk Google).
 * `auth-provider.tsx` TIDAK PERNAH memanggil ini — dia cuma membaca profil
 * lewat `onSnapshot`, supaya tidak pernah ada dua penulis yang balapan
 * menulis dokumen users/{uid} yang sama (itu akar race condition sebelumnya:
 * onAuthStateChanged di auth-provider dan registerWithEmail sama-sama
 * memanggil pembuat profil untuk event sign-up yang sama).
 */
async function createProfileForNewAccount(user: User): Promise<UserProfile> {
  const db = requireFirebaseDb();
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const now = new Date().toISOString();

  let built: { profile: UserProfile; invitationEmail: string | null };

  try {
    built = await buildNewProfile(user, now);
  } catch (error) {
    await rollbackFailedRegistration(user);
    throw error;
  }

  try {
    const batch = writeBatch(db);
    batch.set(ref, built.profile);
    if (built.invitationEmail) {
      markInvitationUsedInBatch(batch, db, built.invitationEmail, now);
    }
    await batch.commit();
  } catch (error) {
    await rollbackFailedRegistration(user);
    throw error;
  }

  return built.profile;
}

/** Login Google: buat profil kalau ini kali pertama, atau sinkronkan kalau sudah ada. */
async function getOrCreateProfileForSignIn(user: User): Promise<UserProfile> {
  const db = requireFirebaseDb();
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return createProfileForNewAccount(user);
  }

  return syncExistingProfile(user, ref, mapUserProfile(snapshot.id, snapshot.data()));
}

/** Menyamakan displayName/email/photoURL dari Firebase Auth ke profil Firestore yang sudah ada. */
async function syncExistingProfile(
  user: User,
  ref: ReturnType<typeof doc>,
  existing: UserProfile
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const nextDisplayName = user.displayName?.trim() || existing.displayName;
  const nextEmail = user.email ?? existing.email;
  const nextPhotoURL = user.photoURL ?? existing.photoURL;

  const changed =
    nextDisplayName !== existing.displayName ||
    nextEmail !== existing.email ||
    nextPhotoURL !== existing.photoURL;

  if (!changed) {
    return existing;
  }

  await updateDoc(ref, {
    displayName: nextDisplayName,
    email: nextEmail,
    photoURL: nextPhotoURL,
    updatedAt: now,
    updatedBy: user.uid,
  });

  return {
    ...existing,
    displayName: nextDisplayName,
    email: nextEmail,
    photoURL: nextPhotoURL,
    updatedAt: now,
    updatedBy: user.uid,
  };
}

/**
 * Menentukan profil untuk akun yang BENAR-BENAR baru (dokumen users/{uid}
 * belum ada). Dicek terhadap parameter sistem (domain + mode pendaftaran)
 * satu kali di sini — bukan di tempat lain — supaya berlaku sama baik lewat
 * form daftar maupun login Google pertama kali.
 */
async function buildNewProfile(
  user: User,
  now: string
): Promise<{ profile: UserProfile; invitationEmail: string | null }> {
  const email = normalizeEmail(user.email ?? "");
  if (!email) {
    throw new RegistrationError("Akun tidak memiliki alamat email yang valid.");
  }

  const params = await getSystemParameters();

  if (params.domainDiizinkan.length > 0) {
    const domain = email.split("@")[1] ?? "";
    if (!params.domainDiizinkan.includes(domain)) {
      throw new RegistrationError(
        `Domain email "${domain}" tidak diizinkan mendaftar. Domain yang diizinkan: ${params.domainDiizinkan.join(", ")}.`
      );
    }
  }

  if (params.modePendaftaran === "tertutup") {
    const invitation = await getInvitationByEmail(email);
    if (!invitation || invitation.usedAt) {
      throw new RegistrationError(
        "Email ini belum diundang admin. Hubungi admin untuk didaftarkan terlebih dahulu."
      );
    }

    return {
      profile: buildInvitedProfile(user, invitation, now),
      invitationEmail: email,
    };
  }

  return { profile: buildDefaultProfile(user, now), invitationEmail: null };
}

/**
 * Rollback kalau gagal lolos gerbang pendaftaran, supaya akun Auth tidak
 * menggantung tanpa profil. Pengaman berlapis: dicek dulu apakah
 * users/{uid} SUDAH tersimpan sebelum menghapus akunnya — kalau sudah ada,
 * JANGAN dihapus (menghapus akun yang sudah punya profil valid selalu
 * salah), cukup dicatat untuk pemeriksaan manual.
 */
async function rollbackFailedRegistration(user: User): Promise<void> {
  try {
    const db = requireFirebaseDb();
    const snapshot = await getDoc(doc(db, COLLECTIONS.users, user.uid));
    if (snapshot.exists()) {
      console.error(
        `[auth] Pendaftaran user ${user.uid} gagal setelah profilnya sudah tersimpan — akun TIDAK dihapus untuk menghindari kehilangan profil valid. Periksa manual.`
      );
      return;
    }
  } catch {
    // Pengecekan sendiri gagal — lanjut ke percobaan hapus di bawah sebagai upaya terakhir.
  }

  try {
    await deleteUser(user);
  } catch {
    try {
      await signOut(requireFirebaseAuth());
    } catch {
      // Abaikan — sudah upaya terbaik.
    }
  }
}

export async function getClientSession(): Promise<AuthSession | null> {
  const user = getClientAuthUser();
  if (!user) {
    return null;
  }

  const profile = await fetchUserProfile(user.uid);
  return toAuthSession(profile);
}

/**
 * Login biasa TIDAK PERNAH membuat profil baru — kalau users/{uid} belum
 * ada, itu anomali (akun Auth ada tapi profilnya hilang/belum dibuat),
 * bukan pendaftaran. Membiarkan login membuat profil akan membuka jalan
 * pintas yang melewati gerbang domain/undangan di buildNewProfile().
 */
export async function signInWithEmail(email: string, password: string) {
  const auth = requireFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const db = requireFirebaseDb();
  const ref = doc(db, COLLECTIONS.users, credential.user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new RegistrationError(
      "Profil pengguna untuk akun ini tidak ditemukan. Hubungi admin."
    );
  }

  const profile = await syncExistingProfile(
    credential.user,
    ref,
    mapUserProfile(snapshot.id, snapshot.data())
  );
  setAuthCookies(profile.role);
  return { user: credential.user, profile };
}

export async function signInWithGoogle() {
  const auth = requireFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  const profile = await getOrCreateProfileForSignIn(credential.user);
  setAuthCookies(profile.role);
  return { user: credential.user, profile };
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
) {
  const auth = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizeEmail(email),
    password
  );
  const name = displayName?.trim();

  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }

  const profile = await createProfileForNewAccount(credential.user);

  // Dikirim SETELAH profil berhasil dibuat (bukan sebelum) — kalau
  // createProfileForNewAccount gagal, akun sudah di-rollback (dihapus),
  // jadi tidak ada gunanya mengirim tautan verifikasi untuk akun yang
  // sudah tidak ada. Kegagalan kirim email SENGAJA tidak digagalkan ke
  // pemanggil — pendaftaran tetap dianggap berhasil, pengguna masih bisa
  // klik "Kirim Ulang" di halaman /verifikasi-email.
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // Diabaikan — lihat komentar di atas.
  }

  setAuthCookies(profile.role);
  return { user: credential.user, profile };
}

/**
 * Tidak mengembalikan info apakah email terdaftar — pemanggil (halaman
 * /lupa-password) SENGAJA menampilkan pesan yang sama persis baik email
 * ditemukan atau tidak (menangkap kode "auth/user-not-found" secara
 * khusus), supaya halaman ini tidak bisa dipakai menebak email pengguna
 * mana yang punya akun.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const auth = requireFirebaseAuth();
  await sendPasswordResetEmail(auth, normalizeEmail(email));
}

/** Dipakai tombol "Kirim Ulang" di /verifikasi-email — akun yang sedang login saja. */
export async function resendEmailVerification(): Promise<void> {
  const user = getClientAuthUser();
  if (!user) {
    throw new RegistrationError("Sesi tidak ditemukan. Silakan masuk ulang.");
  }

  await sendEmailVerification(user);
}

export async function signOutCurrentUser() {
  const auth = getClientAuth();
  if (auth) {
    await signOut(auth);
  }
  clearAuthCookies();
}

export function setAuthCookies(role: UserRole) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=1; Path=/; SameSite=Lax`;
  document.cookie = `${AUTH_ROLE_COOKIE_NAME}=${role}; Path=/; SameSite=Lax`;
}

export function clearAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${AUTH_ROLE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${AUTH_COOKIE_NAME}=1`));
}

export function safeNextPath(
  next: string | null | undefined,
  role: UserRole | null | undefined
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return getPostLoginPath(role);
  }

  if (next.startsWith(ADMIN_PATH) && !canAccessAdmin(role)) {
    return DASHBOARD_PATH;
  }

  if (next === LOGIN_PATH || next === REGISTER_PATH) {
    return getPostLoginPath(role);
  }

  return next;
}

export function getFirebaseReadyState() {
  return {
    configured: isFirebaseConfigured(),
  };
}

export { mapAuthError, mapUserProfile };
