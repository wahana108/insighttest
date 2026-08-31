import type { Firestore } from "firebase-admin/firestore";
import type { SoalUntukAttempt } from "@/types/attempt";

export class AttemptRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AttemptRouteError";
    this.status = status;
  }
}

export function acakUrutan<T>(items: T[]): T[] {
  const hasil = [...items];
  for (let i = hasil.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

/**
 * ATURAN MUTLAK (KA-3): hanya membaca koleksi 'soal', TIDAK PERNAH
 * 'kunci_soal' — dipakai untuk mengirim soal ke peserta, jawaban benar
 * tidak boleh ikut. db.getAll() menjaga urutan array refs, jadi urutan
 * hasil sama persis dengan soalIds yang dibekukan di attempt.
 */
export async function muatSoalUntukAttempt(
  db: Firestore,
  soalIds: string[]
): Promise<SoalUntukAttempt[]> {
  if (soalIds.length === 0) {
    return [];
  }
  const refs = soalIds.map((id) => db.collection("soal").doc(id));
  const snaps = await db.getAll(...refs);
  return snaps.map((snap, index) => {
    const data = snap.data() ?? {};
    const opsiRaw = Array.isArray(data.opsi) ? data.opsi : [];
    const opsi = opsiRaw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : "",
        label: typeof item.label === "string" ? item.label : "",
      }));
    return {
      id: soalIds[index],
      teks: typeof data.teks === "string" ? data.teks : "",
      opsi,
    };
  });
}
