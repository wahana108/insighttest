import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { ambilIzinKegiatan } from "@/lib/api/izin-panitia-server";
import { SertifikatRouteError } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { RiwayatSertifikat } from "@/types/sertifikat";

/**
 * Mengubah status jadi 'dicabut' — TIDAK PERNAH menghapus dokumennya.
 * Jejaknya harus tetap ada, dan halaman verifikasi publik /s/[kode] sudah
 * menyatakan TIDAK BERLAKU untuk status ini.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new SertifikatRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const uid = typeof parsed.uid === "string" ? parsed.uid : "";
    const alasan = typeof parsed.alasan === "string" ? parsed.alasan.trim() : "";
    if (!kegiatanId || !uid) {
      throw new SertifikatRouteError(400, "kegiatanId dan uid wajib diisi.");
    }
    if (!alasan) {
      throw new SertifikatRouteError(400, "Alasan pencabutan wajib diisi.");
    }

    const db = getAdminDb();

    // Slice 8.1: admin/superadmin selalu lolos; panitia hanya kalau
    // izin terbitkanSertifikat menyala untuk KEGIATAN INI — pencabutan
    // memakai saklar yang sama dengan penerbitan.
    const izin = await ambilIzinKegiatan(db, kegiatanId, user);
    if (!izin.terbitkanSertifikat) {
      throw new SertifikatRouteError(403, "Anda tidak berhak mencabut sertifikat kegiatan ini.");
    }
    const sertifikatRef = db.collection("sertifikat").doc(`${kegiatanId}_${uid}`);
    const snap = await sertifikatRef.get();
    if (!snap.exists) {
      throw new SertifikatRouteError(404, "Sertifikat tidak ditemukan.");
    }
    const data = snap.data() ?? {};
    if (data.status === "dicabut") {
      return Response.json({ id: snap.id, ...data });
    }

    const now = new Date().toISOString();
    const entriRiwayat: RiwayatSertifikat = {
      aksi: "cabut",
      pada: Timestamp.now(),
      olehUid: user.uid,
    };
    await sertifikatRef.update({
      status: "dicabut",
      dicabutPada: now,
      dicabutOleh: user.uid,
      alasanPencabutan: alasan,
      riwayat: FieldValue.arrayUnion(entriRiwayat),
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
