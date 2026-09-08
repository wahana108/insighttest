import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { ambilIzinKegiatan } from "@/lib/api/izin-panitia-server";
import { SertifikatRouteError, terbitkanSertifikatUntuk } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * §10 (docs/arsitektur.md): penerbitan massal berpratinjau — admin sudah
 * melihat siapa yang layak/tidak di /admin/kegiatan/[id]/peserta dan
 * memilih sendiri siapa yang diterbitkan, jadi di sini TIDAK digerbangi
 * evaluasiKelayakan() (sama seperti jalur admin di POST /api/sertifikat/terbitkan).
 *
 * BATAS 25 uid per permintaan — menerbitkan ratusan sekaligus akan
 * melewati batas waktu fungsi serverless. Klien mengirim dalam potongan.
 */
const BATAS_UID_PER_PERMINTAAN = 25;

interface HasilBarisTerbitkan {
  uid: string;
  ok: boolean;
  serial?: string;
  error?: string;
}

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
    const uids = Array.isArray(parsed.uids)
      ? parsed.uids.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    if (uids.length === 0) {
      throw new SertifikatRouteError(400, "uids wajib diisi minimal satu.");
    }
    if (uids.length > BATAS_UID_PER_PERMINTAAN) {
      throw new SertifikatRouteError(
        400,
        `Maksimal ${BATAS_UID_PER_PERMINTAAN} peserta per permintaan — kirim dalam beberapa potongan.`
      );
    }

    const db = getAdminDb();

    // Slice 8.1: admin/superadmin selalu lolos lewat izinPanitia(); panitia
    // butuh terbitkanSertifikat menyala untuk KEGIATAN INI.
    const izin = await ambilIzinKegiatan(db, kegiatanId, user);
    if (!izin.terbitkanSertifikat) {
      throw new SertifikatRouteError(
        403,
        "Anda tidak berhak menerbitkan sertifikat massal di kegiatan ini."
      );
    }
    const hasil: HasilBarisTerbitkan[] = await Promise.all(
      uids.map(async (uid): Promise<HasilBarisTerbitkan> => {
        try {
          const record = await terbitkanSertifikatUntuk(db, {
            kegiatanId,
            targetUid: uid,
            isSelfIssue: false,
            actingUid: user.uid,
          });
          return { uid, ok: true, serial: record.serial };
        } catch (err) {
          return {
            uid,
            ok: false,
            error: err instanceof SertifikatRouteError ? err.message : "Gagal menerbitkan.",
          };
        }
      })
    );

    return Response.json({ hasil });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
