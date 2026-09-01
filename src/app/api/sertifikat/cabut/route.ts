import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { SertifikatRouteError } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Mengubah status jadi 'dicabut' — TIDAK PERNAH menghapus dokumennya.
 * Jejaknya harus tetap ada, dan halaman verifikasi publik /s/[kode] sudah
 * menyatakan TIDAK BERLAKU untuk status ini.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isAdminRole) {
      throw new SertifikatRouteError(403, "Hanya admin yang boleh mencabut sertifikat.");
    }

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
    await sertifikatRef.update({
      status: "dicabut",
      dicabutPada: now,
      dicabutOleh: user.uid,
      alasanPencabutan: alasan,
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
