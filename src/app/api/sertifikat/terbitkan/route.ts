import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { SertifikatRouteError, terbitkanSertifikatUntuk } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Tanpa `uid`: peserta menerbitkan sertifikatnya sendiri. Dengan `uid`:
 * hanya admin/superadmin, untuk pengguna lain. Logika kelayakan dan
 * penulisan sesungguhnya ada di terbitkanSertifikatUntuk()
 * (src/lib/api/sertifikat-server.ts) — dipakai bersama dengan
 * POST /api/sertifikat/terbitkan-massal, tidak diduplikasi di sini.
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
    if (!kegiatanId) {
      throw new SertifikatRouteError(400, "kegiatanId wajib diisi.");
    }
    const requestedUid = typeof parsed.uid === "string" && parsed.uid ? parsed.uid : null;
    const isSelfIssue = !requestedUid;
    const targetUid = requestedUid ?? user.uid;

    if (!isSelfIssue) {
      const isAdminRole = user.role === "admin" || user.role === "superadmin";
      if (!isAdminRole) {
        throw new SertifikatRouteError(
          403,
          "Hanya admin yang boleh menerbitkan sertifikat untuk pengguna lain."
        );
      }
    }

    const db = getAdminDb();
    const hasil = await terbitkanSertifikatUntuk(db, {
      kegiatanId,
      targetUid,
      isSelfIssue,
      actingUid: user.uid,
    });

    return Response.json(hasil);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
