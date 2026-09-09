import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { buildSertifikatDetail, SertifikatRouteError } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { normalisasiKodeVerifikasi } from "@/lib/kode-verifikasi";

/**
 * Untuk /sertifikat/cetak/[kodeVerifikasi] — alamat cetak yang bersih.
 * Dicari lewat kodeVerifikasi (bukan id dokumen, yang memuat uid peserta),
 * tapi penjagaan aksesnya SAMA dengan GET /api/sertifikat/[id]: hanya
 * pemilik sertifikat itu atau admin/superadmin.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kodeVerifikasi: string }> }
) {
  try {
    const user = await verifyRequest(request);
    const { kodeVerifikasi } = await params;

    const db = getAdminDb();
    const snapshot = await db
      .collection("sertifikat")
      .where("kodeVerifikasi", "==", normalisasiKodeVerifikasi(kodeVerifikasi))
      .limit(1)
      .get();
    if (snapshot.empty) {
      throw new SertifikatRouteError(404, "Sertifikat tidak ditemukan.");
    }
    const snap = snapshot.docs[0];
    const data = snap.data();

    const isOwner = data.uid === user.uid;
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isOwner && !isAdminRole) {
      throw new SertifikatRouteError(403, "Anda tidak berhak membuka sertifikat ini.");
    }

    const kegiatanId = typeof data.kegiatanId === "string" ? data.kegiatanId : "";
    const kegiatanSnap = kegiatanId ? await db.collection("kegiatan").doc(kegiatanId).get() : null;
    const kegiatanData = kegiatanSnap?.exists ? (kegiatanSnap.data() ?? {}) : {};

    return Response.json(buildSertifikatDetail(snap.id, kegiatanId, data, kegiatanData));
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
