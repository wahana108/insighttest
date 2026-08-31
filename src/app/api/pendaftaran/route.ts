import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { KategoriModul } from "@/types/kegiatan";
import type { ModulSnapshotItem } from "@/types/pendaftaran";

class PendaftaranRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PendaftaranRouteError";
    this.status = status;
  }
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

/**
 * Semua pemeriksaan kelayakan pendaftaran ada di server — klien tidak
 * pernah menentukan nomorUrut atau menulis pendaftaran langsung (KA-7 di
 * semangat yang sama, firestore.rules menolak semua tulisan klien ke
 * pendaftaran/{id}).
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PendaftaranRouteError(400, "Body permintaan harus JSON.");
    }
    const kegiatanId =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>).kegiatanId
        : undefined;
    if (typeof kegiatanId !== "string" || !kegiatanId) {
      throw new PendaftaranRouteError(400, "kegiatanId wajib diisi.");
    }

    if (!user.namaLengkap.trim()) {
      throw new PendaftaranRouteError(
        400,
        "Lengkapi nama lengkap di halaman Profil sebelum mendaftar."
      );
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);

    let nomorUrutHasil = 0;

    await db.runTransaction(async (tx) => {
      const kegiatanSnap = await tx.get(kegiatanRef);
      if (!kegiatanSnap.exists) {
        throw new PendaftaranRouteError(404, "Kegiatan tidak ditemukan.");
      }
      const kegiatanData = kegiatanSnap.data() ?? {};
      if (kegiatanData.isPublished !== true) {
        throw new PendaftaranRouteError(400, "Kegiatan ini belum diterbitkan.");
      }
      if (kegiatanData.isArchived === true) {
        throw new PendaftaranRouteError(400, "Kegiatan ini sudah diarsipkan.");
      }

      const now = new Date();
      const dibukaPada =
        typeof kegiatanData.dibukaPada === "string" ? new Date(kegiatanData.dibukaPada) : null;
      const ditutupPada =
        typeof kegiatanData.ditutupPada === "string" ? new Date(kegiatanData.ditutupPada) : null;
      if (dibukaPada && now < dibukaPada) {
        throw new PendaftaranRouteError(400, "Pendaftaran untuk kegiatan ini belum dibuka.");
      }
      if (ditutupPada && now > ditutupPada) {
        throw new PendaftaranRouteError(400, "Pendaftaran untuk kegiatan ini sudah ditutup.");
      }

      const pendaftaranSnap = await tx.get(pendaftaranRef);
      if (pendaftaranSnap.exists) {
        throw new PendaftaranRouteError(409, "Anda sudah terdaftar di kegiatan ini.");
      }

      const modulSnap = await tx.get(kegiatanRef.collection("modul"));
      const modulSnapshot: ModulSnapshotItem[] = modulSnap.docs.map((modulDoc) => {
        const data = modulDoc.data();
        const evaluasi =
          typeof data.evaluasi === "object" && data.evaluasi !== null
            ? (data.evaluasi as Record<string, unknown>)
            : null;
        return {
          modulId: modulDoc.id,
          judul: typeof data.judul === "string" ? data.judul : "",
          kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
          wajib: typeof data.wajib === "boolean" ? data.wajib : true,
          nilaiMinimum:
            evaluasi && typeof evaluasi.nilaiMinimum === "number" ? evaluasi.nilaiMinimum : null,
        };
      });

      const nomorUrutTerakhir =
        typeof kegiatanData.nomorUrutTerakhir === "number" ? kegiatanData.nomorUrutTerakhir : 0;
      const nomorUrut = nomorUrutTerakhir + 1;
      nomorUrutHasil = nomorUrut;

      tx.update(kegiatanRef, { nomorUrutTerakhir: nomorUrut });
      tx.set(pendaftaranRef, {
        kegiatanId,
        uid: user.uid,
        email: user.email,
        namaLengkap: user.namaLengkap,
        institusi: user.institusi,
        nomorUrut,
        modulSnapshot,
        status: "terdaftar",
        daftarPada: now.toISOString(),
        hasilModul: {},
      });
    });

    return Response.json({ ok: true, nomorUrut: nomorUrutHasil });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof PendaftaranRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
