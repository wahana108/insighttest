import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Undangan, UndanganRole } from "@/types/undangan";

export class UndanganError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UndanganError";
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function undanganRef(email: string) {
  return doc(db, "undangan", normalizeEmail(email));
}

function isUndanganRole(value: unknown): value is UndanganRole {
  return value === "admin" || value === "panitia" || value === "peserta";
}

function mapUndangan(email: string, data: DocumentData): Undangan {
  return {
    email,
    role: isUndanganRole(data.role) ? data.role : "peserta",
    catatan: typeof data.catatan === "string" ? data.catatan : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    usedAt: typeof data.usedAt === "string" ? data.usedAt : null,
    usedBy: typeof data.usedBy === "string" ? data.usedBy : null,
  };
}

/**
 * ID dokumen = email ternormalisasi (trim + lowercase) — deterministik supaya
 * firestore.rules bisa exists()/get() tanpa query (KA-3, docs/arsitektur.md).
 */
export async function getUndanganByEmail(email: string): Promise<Undangan | null> {
  const normalized = normalizeEmail(email);
  const snapshot = await getDoc(undanganRef(normalized));
  if (!snapshot.exists()) {
    return null;
  }
  return mapUndangan(normalized, snapshot.data());
}

export async function createUndangan(
  input: { email: string; role: UndanganRole; catatan: string },
  actorId: string
): Promise<Undangan> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new UndanganError("Email tidak valid.");
  }

  const record: Undangan = {
    email,
    role: input.role,
    catatan: input.catatan.trim(),
    createdAt: new Date().toISOString(),
    createdBy: actorId,
    usedAt: null,
    usedBy: null,
  };

  await setDoc(undanganRef(email), record);
  return record;
}

export async function deleteUndangan(email: string): Promise<void> {
  await deleteDoc(undanganRef(email));
}

/**
 * Menandai undangan terpakai lewat writeBatch yang sama dengan pembuatan
 * users/{uid} di gerbang pendaftaran (src/lib/auth/session.ts) — semua atau
 * tidak sama sekali. firestore.rules membaca usedAt dengan
 * .get('usedAt', null), tidak pernah .data.usedAt (KA-1).
 */
export function markUndanganUsedInBatch(
  batch: WriteBatch,
  email: string,
  usedBy: string
): void {
  batch.update(undanganRef(email), {
    usedAt: new Date().toISOString(),
    usedBy,
  });
}
