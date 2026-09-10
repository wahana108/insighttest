import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import { getAdminDb } from "@/lib/firebase/admin";
import { mapFormulirPeserta, periksaFormulirPeserta } from "@/lib/formulir-peserta";
import type { AmbangKeterlibatan, KategoriModul, ModeAmbangKeterlibatan } from "@/types/kegiatan";
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

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

/**
 * Sama seperti mapAmbangKeterlibatan() di src/lib/services/modul.ts (tidak
 * bisa dipakai bersama — itu memakai firebase/firestore klien, ini Admin
 * SDK server) — migrasi ambangKreditPersen lama ke { mode, nilai } baru
 * (Slice 7.3), supaya modul lama tidak jadi tak terbaca saat pendaftaran
 * membekukan snapshotnya.
 *
 * Slice 7.5: nilai mentah di sini bisa mustahil dievaluasi (persen tanpa
 * durasi diketahui) — pemanggil WAJIB memanggil normalkanAmbangKeterlibatan()
 * pada hasilnya sebelum membekukan ke modulSnapshot (lihat pemanggilnya
 * di bawah). Ini titik bekunya (KA-5): kalau tidak dinormalkan di sini,
 * peserta yang MENDAFTAR SETELAH modul rusak akan membekukan syarat yang
 * sama mustahilnya untuk selamanya.
 */
function ambangKeterlibatanUntukSnapshot(
  value: unknown,
  dataLegacy: Record<string, unknown>
): AmbangKeterlibatan {
  if (typeof value === "object" && value !== null) {
    const data = value as Record<string, unknown>;
    if (isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number") {
      return { mode: data.mode, nilai: data.nilai };
    }
  }
  if (typeof dataLegacy.ambangKreditPersen === "number") {
    return { mode: "persen", nilai: dataLegacy.ambangKreditPersen };
  }
  return { mode: "persen", nilai: 90 };
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

      // Slice 6.1: penegakan SESUNGGUHNYA formulirPeserta ada di sini, bukan
      // di klien — penjaga di src/app/kegiatan/[id]/page.tsx cuma
      // kenyamanan. Hanya dijalankan saat pendaftaran BARU dibuat; peserta
      // yang sudah terdaftar tidak pernah divalidasi ulang lewat jalur ini
      // (KA-5, semangat yang sama dengan modulSnapshot).
      const hasilFormulir = periksaFormulirPeserta(mapFormulirPeserta(kegiatanData.formulirPeserta), {
        institusi: user.institusi,
        nomorIdentitas: user.nomorIdentitas,
        noTelepon: user.noTelepon,
      });
      if (!hasilFormulir.valid) {
        throw new PendaftaranRouteError(400, hasilFormulir.pesan ?? "Data belum lengkap.");
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
        // Slice 7.3: ambangKeterlibatan/targetSkor/durasiDetik DIBEKUKAN di
        // sini juga (KA-5) — sama seperti nilaiMinimum evaluasi di atas —
        // supaya admin mengubah ambang atestasi setelah peserta terdaftar
        // tidak mengubah kelayakan yang sudah dievaluasi untuk mereka.
        const atestasi =
          typeof data.atestasi === "object" && data.atestasi !== null
            ? (data.atestasi as Record<string, unknown>)
            : null;
        const durasiDetik =
          atestasi && typeof atestasi.durasiDetik === "number" ? atestasi.durasiDetik : null;
        return {
          modulId: modulDoc.id,
          judul: typeof data.judul === "string" ? data.judul : "",
          kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
          wajib: typeof data.wajib === "boolean" ? data.wajib : true,
          nilaiMinimum:
            evaluasi && typeof evaluasi.nilaiMinimum === "number" ? evaluasi.nilaiMinimum : null,
          ambangKeterlibatan: atestasi
            ? normalkanAmbangKeterlibatan(
                ambangKeterlibatanUntukSnapshot(atestasi.ambangKeterlibatan, atestasi),
                durasiDetik
              ).ambang
            : null,
          targetSkor:
            atestasi && typeof atestasi.targetSkor === "number" ? atestasi.targetSkor : null,
          durasiDetik,
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
        referensiDibuka: [],
        atestasi: {},
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
