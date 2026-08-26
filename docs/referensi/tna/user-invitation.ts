import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentData,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { UserInvitation, UserRole } from "@/types";

export class UserInvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInvitationError";
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mapUserInvitationError(error: unknown): string {
  if (error instanceof UserInvitationError) {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code: string }).code);
    if (code === "permission-denied") {
      return "Anda tidak berhak mengelola undangan pendaftaran.";
    }
    if (code === "unavailable") {
      return "Layanan Firestore tidak tersedia. Pastikan emulator berjalan.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Terjadi kesalahan. Coba lagi.";
}

export type UserInvitationWriteInput = {
  email: string;
  namaLengkap: string;
  unitKerjaId: string | null;
  jabatanId: string | null;
  supervisorId: string | null;
  role: UserRole;
};

export async function listInvitations(): Promise<UserInvitation[]> {
  const db = requireDb();
  const snapshot = await getDocs(collection(db, COLLECTIONS.userInvitations));
  return snapshot.docs
    .map((item) => mapInvitation(item.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getInvitationByEmail(
  email: string
): Promise<UserInvitation | null> {
  const db = requireDb();
  const snapshot = await getDoc(
    doc(db, COLLECTIONS.userInvitations, normalizeEmail(email))
  );
  if (!snapshot.exists()) {
    return null;
  }

  return mapInvitation(snapshot.data());
}

export async function createInvitation(
  input: UserInvitationWriteInput,
  actorId: string
): Promise<UserInvitation> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new UserInvitationError("Email tidak valid.");
  }

  const namaLengkap = input.namaLengkap.trim();
  if (namaLengkap.length < 2) {
    throw new UserInvitationError("Nama lengkap minimal 2 karakter.");
  }

  const db = requireDb();
  const existing = await getInvitationByEmail(email);
  if (existing?.usedAt) {
    throw new UserInvitationError(
      "Undangan untuk email ini sudah dipakai untuk mendaftar dan tidak bisa diubah."
    );
  }

  const now = new Date().toISOString();
  const record: UserInvitation = {
    email,
    namaLengkap,
    unitKerjaId: input.unitKerjaId,
    jabatanId: input.jabatanId,
    supervisorId: input.supervisorId,
    role: input.role,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? actorId,
    usedAt: null,
  };

  await setDoc(doc(db, COLLECTIONS.userInvitations, email), record);
  return record;
}

/** Ditandai dari alur pendaftaran (self-write) via writeBatch bersama pembuatan users/{uid}. */
export function markInvitationUsedInBatch(
  batch: WriteBatch,
  db: Firestore,
  email: string,
  usedAt: string
): void {
  batch.update(doc(db, COLLECTIONS.userInvitations, normalizeEmail(email)), {
    usedAt,
  });
}

function requireDb() {
  const db = getClientDb();
  if (!db) {
    throw new UserInvitationError(
      "Cloud Firestore belum dikonfigurasi. Isi file .env.local."
    );
  }

  return db;
}

function mapInvitation(data: DocumentData): UserInvitation {
  return {
    email: typeof data.email === "string" ? data.email : "",
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    unitKerjaId: typeof data.unitKerjaId === "string" ? data.unitKerjaId : null,
    jabatanId: typeof data.jabatanId === "string" ? data.jabatanId : null,
    supervisorId:
      typeof data.supervisorId === "string" ? data.supervisorId : null,
    role: isUserRoleValue(data.role) ? data.role : "pegawai",
    createdAt: toIso(data.createdAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    usedAt: toIso(data.usedAt),
  };
}

function isUserRoleValue(value: unknown): value is UserRole {
  return (
    value === "super_admin" ||
    value === "admin" ||
    value === "moderator" ||
    value === "pegawai"
  );
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
